import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { setRateLimitRedisClientForTesting } from '../../infrastructure/rate-limit-redis';
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { getCompanyCheckInQr } = await import('./meeting.service');
const { MeetingModel, MeetingCheckInQrModel } = await import('./meeting.model');
const { encryptSecret } = await import('../../security/crypto');
process.env.APP_ENCRYPTION_KEY = '11'.repeat(32);

test('concurrent first requests converge on the persisted company token', async t => {
  let stored: any = null;
  let writes = 0;
  t.mock.method(MeetingCheckInQrModel, 'findOne', () => {
    const snapshot = stored;
    return { select: async () => snapshot };
  });
  t.mock.method(MeetingCheckInQrModel, 'findOneAndUpdate', (query, update, options) => ({
    select: async (projection: string) => {
      assert.deepEqual(query, { companyCode: 'ACME', tokenHash: { $exists: false }, tokenEncrypted: { $exists: false } });
      assert.equal(options.upsert, true);
      assert.equal(projection, '+tokenEncrypted');
      if (stored) throw Object.assign(new Error('Duplicate company'), { code: 11000 });
      writes++;
      stored = { companyCode: 'ACME', ...update.$set };
      return stored;
    },
  }));
  const lookup = t.mock.method(MeetingModel, 'findOne', () => { throw new Error('Must not depend on a meeting'); });
  const results = await Promise.all(Array.from({ length: 8 }, () => getCompanyCheckInQr('ACME')));
  assert.equal(writes, 1);
  assert.equal(new Set(results.map(result => result.checkInUrl)).size, 1);
  assert.ok(results.every(result => result.expiresAt === null));
  assert.equal(lookup.mock.callCount(), 0);
  assert.ok(MeetingCheckInQrModel.schema.path('companyCode').options.unique);
});

test('different companies receive independent permanent tokens', async t => {
  const records = new Map<string, any>();
  t.mock.method(MeetingCheckInQrModel, 'findOne', (query) => ({ select: async () => records.get(query.companyCode) || null }));
  t.mock.method(MeetingCheckInQrModel, 'findOneAndUpdate', (query, update) => ({ select: async () => {
    const record = { companyCode: query.companyCode, ...update.$set };
    records.set(query.companyCode, record);
    return record;
  } }));
  const a = await getCompanyCheckInQr('ACME');
  const b = await getCompanyCheckInQr('OTHER');
  assert.notEqual(a.checkInUrl, b.checkInUrl);
  assert.deepEqual(await getCompanyCheckInQr('ACME'), a);
  assert.deepEqual(await getCompanyCheckInQr('OTHER'), b);
  await assert.rejects(getCompanyCheckInQr(''), { status: 403 });
});

test('a previously revoked empty record is initialized once', async t => {
  let record = { companyCode: 'ACME', revokedAt: new Date() };
  const lookup = t.mock.method(MeetingCheckInQrModel, 'findOne', () => ({ select: async () => record }));
  const initialize = t.mock.method(MeetingCheckInQrModel, 'findOneAndUpdate', (_query, update) => ({ select: async () => {
    record = { companyCode: 'ACME', ...update.$set };
    return record;
  } }));
  const first = await getCompanyCheckInQr('ACME');
  assert.deepEqual(await getCompanyCheckInQr('ACME'), first);
  assert.equal(initialize.mock.callCount(), 1);
  assert.equal(lookup.mock.callCount(), 2);
});

test('unreadable or mismatched encrypted tokens fail without silently replacing the QR', async t => {
  const token = 'A'.repeat(43);
  const record = { companyCode: 'ACME', tokenHash: createHash('sha256').update(token).digest('hex'), tokenEncrypted: 'invalid', expiresAt: null };
  t.mock.method(MeetingCheckInQrModel, 'findOne', () => ({ select: async () => record }));
  const write = t.mock.method(MeetingCheckInQrModel, 'findOneAndUpdate', () => { throw new Error('Must not rotate'); });
  await assert.rejects(getCompanyCheckInQr('ACME'), { status: 409 });
  record.tokenEncrypted = encryptSecret('B'.repeat(43));
  await assert.rejects(getCompanyCheckInQr('ACME'), { status: 409 });
  assert.equal(write.mock.callCount(), 0);
});
