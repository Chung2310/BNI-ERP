import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { setRateLimitRedisClientForTesting } from '../../infrastructure/rate-limit-redis';
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { createCheckInQr, getCheckInQr } = await import('./meeting.service');
const { MeetingModel } = await import('./meeting.model');
process.env.APP_ENCRYPTION_KEY = '11'.repeat(32);
function setup(t: any) {
  let saves = 0;
  const item: any = { _id: 'meeting-a', companyCode: 'ACME', title: 'Test', status: 'live', latitude: 10, longitude: 106, save: async () => { saves++; } };
  const queries: any[] = [];
  t.mock.method(MeetingModel, 'findOne', (query: any) => {
    queries.push(query);
    const value = query.companyCode === 'ACME' ? item : null;
    return Object.assign(Promise.resolve(value), { select: async () => value });
  });
  return { item, saves: () => saves, queries };
}
test('new QR is encrypted and restored repeatedly without changing token or expiry', async t => {
  const { item, saves } = setup(t);
  const generated = await createCheckInQr('ACME', 'meeting-a', 1);
  assert.ok(item.checkInQrTokenEncrypted);
  assert.notEqual(item.checkInQrTokenEncrypted, generated.token);
  const first = await getCheckInQr('ACME', 'meeting-a');
  const second = await getCheckInQr('ACME', 'meeting-a');
  assert.deepEqual(first, second);
  assert.equal(first?.checkInUrl, '/meeting-checkin/' + generated.token);
  assert.equal(first?.expiresAt, generated.expiresAt);
  assert.equal(saves(), 1);
  assert.equal(MeetingModel.schema.path('checkInQrTokenEncrypted').options.select, false);
});
test('old cached token can be migrated only if it matches the current hash', async t => {
  const { item, saves } = setup(t);
  const token = 'A'.repeat(43);
  item.checkInQrTokenHash = createHash('sha256').update(token).digest('hex');
  item.checkInQrExpiresAt = new Date(Date.now() + 60000);
  assert.equal((await getCheckInQr('ACME', 'meeting-a'))?.legacy, true);
  await assert.rejects(getCheckInQr('ACME', 'meeting-a', 'B'.repeat(43)), { status: 409 });
  const restored = await getCheckInQr('ACME', 'meeting-a', token);
  assert.equal(restored?.checkInUrl, '/meeting-checkin/' + token);
  assert.equal(saves(), 1);
  assert.deepEqual(await getCheckInQr('ACME', 'meeting-a'), restored);
});
test('expired and closed QR cannot be recovered; explicit replacement rotates it', async t => {
  const { item } = setup(t);
  const old = await createCheckInQr('ACME', 'meeting-a', 1);
  const replacement = await createCheckInQr('ACME', 'meeting-a', 1);
  assert.notEqual(old.token, replacement.token);
  await assert.rejects(getCheckInQr('ACME', 'meeting-a', old.token), { status: 409 });
  item.status = 'ended';
  assert.equal(await getCheckInQr('ACME', 'meeting-a'), null);
  item.status = 'live'; item.checkInQrExpiresAt = new Date(0);
  assert.equal(await getCheckInQr('ACME', 'meeting-a'), null);
});
test('recovery is scoped to the meeting company', async t => {
  const { queries } = setup(t);
  await assert.rejects(getCheckInQr('OTHER', 'meeting-a'), { status: 404 });
  assert.deepEqual(queries[0], { _id: 'meeting-a', companyCode: 'OTHER' });
});
