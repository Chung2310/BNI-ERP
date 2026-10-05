import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { setRateLimitRedisClientForTesting } from '../../infrastructure/rate-limit-redis';
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { getCompanyCheckInQr, getManagedCheckInQr, getPublicQrMeeting, qrCheckInGuest, qrCheckInMember, updateMeeting } = await import('./meeting.service');
const { MeetingModel, MeetingCheckInQrModel } = await import('./meeting.model');
const { UserModel } = await import('../../model/user.model');
const { cloudinaryService } = await import('../../service/cloudinary.service');
import { encryptSecret } from '../../security/crypto';
import { meetingInput } from './meeting.validation';
process.env.APP_ENCRYPTION_KEY = '11'.repeat(32);
const now = new Date('2030-01-31T02:00:00Z');
const token = 'A'.repeat(43);
const input = { name: 'Guest', email: '', latitude: 10, longitude: 106 };
function meeting(id = 'current') {
  return { _id: id, title: id, companyCode: 'ACME', startsAt: new Date('2030-01-31T01:00:00Z'), endsAt: new Date('2030-01-31T03:00:00Z'),
    status: 'scheduled', reminderDays: 1, revision: 1, __v: 0, latitude: 10, longitude: 106, gpsRadiusMeters: 200, speakers: [],
    tiers: [{ count: 10, seconds: 30 }], fallbackSeconds: 20, save: async () => {} };
}
function setup(t: import("node:test").TestContext) {
  t.mock.timers.enable({ apis: ['Date'], now });
  const source = { ...meeting('source'), status: 'ended' };
  const state: { qr: { companyCode: string; tokenHash?: string; tokenEncrypted?: string; expiresAt?: Date | null; revokedAt?: Date }; matches: ReturnType<typeof meeting>[]; queries: Record<string, unknown>[] } = { qr: { companyCode: 'ACME', tokenHash: createHash('sha256').update(token).digest('hex'), tokenEncrypted: encryptSecret(token), expiresAt: null }, matches: [meeting()], queries: [] };
  t.mock.method(MeetingModel, 'findOne', (query) => {
    const result = query._id === 'source' && query.companyCode === 'ACME' ? source : null;
    return Object.assign(Promise.resolve(result), { select: async () => result });
  });
  t.mock.method(MeetingModel, 'updateOne', async (query, update) => {
    assert.equal(query.companyCode, 'ACME');
    assert.equal(query._id, 'source');
    for (const key of Object.keys(update.$unset)) delete (source)[key];
  });
  t.mock.method(MeetingModel, 'find', (query) => {
    state.queries.push(query);
    return { sort: () => ({ limit: async () => state.matches }) };
  });
  t.mock.method(MeetingCheckInQrModel, 'findOne', (query) => {
    const result = state.qr && (query.companyCode === state.qr.companyCode || query.tokenHash === state.qr.tokenHash) ? state.qr : null;
    return Object.assign(Promise.resolve(result), { select: async () => result });
  });
  t.mock.method(MeetingCheckInQrModel, 'findOneAndUpdate', (query, update) => {
    const run = async () => {
      if (state.qr?.tokenHash) throw Object.assign(new Error('Duplicate company'), { code: 11000 });
      state.qr = { companyCode: query.companyCode, ...update.$set };
      return state.qr;
    };
    return { select: run };
  });
  t.mock.method(MeetingCheckInQrModel, 'updateOne', async (query, update) => {
    assert.equal(query.companyCode, 'ACME');
    Object.assign(state.qr, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete state.qr[key];
  });
  return { state, source };
}

test('one permanent QR survives closed meetings and does not depend on their GPS or lifecycle', async t => {
  const { state, source } = setup(t);
  state.qr = null;
  source.latitude = undefined;
  const generated = await getCompanyCheckInQr('ACME');
  assert.equal(generated.expiresAt, null);
  assert.equal(generated.scope, 'company');
  assert.ok(state.qr.tokenEncrypted);
  assert.notEqual(state.qr.tokenEncrypted, generated.checkInUrl.split('/').pop());
  assert.deepEqual(await getManagedCheckInQr('ACME', 'source'), generated);
  source.status = 'cancelled';
  assert.deepEqual(await getManagedCheckInQr('ACME', 'source'), generated);
  source.status = 'scheduled';
  source.startsAt = new Date('2035-01-01');
  assert.deepEqual(await getCompanyCheckInQr('ACME'), generated);
  await assert.rejects(getManagedCheckInQr('OTHER', 'source'), { status: 404 });
  assert.equal(MeetingCheckInQrModel.schema.path('tokenEncrypted').options.select, false);
});

test('existing shared QR becomes permanent without changing a printed token', async t => {
  const { state } = setup(t);
  state.qr.expiresAt = new Date('2020-01-01');
  const existingHash = state.qr.tokenHash;
  const first = await getCompanyCheckInQr('ACME');
  const second = await getCompanyCheckInQr('ACME');
  assert.equal(first.checkInUrl, '/meeting-checkin/' + token);
  assert.deepEqual(first, second);
  assert.equal(state.qr.tokenHash, existingHash);
  assert.equal(state.qr.expiresAt, null);
});

test('one reusable QR records consecutive meetings instead of its source meeting', async t => {
  const { state, source } = setup(t);
  assert.equal((await getPublicQrMeeting(token)).id, 'current');
  const query = state.queries[0] as { companyCode: string; status: { $in: string[] }; startsAt: { $lte: Date }; $or: [{ status: { $in: string[] } }, { status: string; endsAt: { $gt: Date } }, { status: string; endsAt: null; startsAt: { $gt: Date } }] };
  assert.equal(query.companyCode, 'ACME');
  assert.deepEqual(query.status.$in, ['scheduled', 'live', 'paused']);
  assert.equal(query.startsAt.$lte.getTime(), now.getTime() + 2 * 60 * 60 * 1000);
  assert.deepEqual(query.$or[0].status.$in, ['live', 'paused']);
  assert.equal(query.$or[1].status, 'scheduled');
  assert.equal(query.$or[1].endsAt.$gt.getTime(), now.getTime());
  assert.equal(query.$or[2].status, 'scheduled');
  assert.equal(query.$or[2].endsAt, null);
  assert.equal(query.$or[2].startsAt.$gt.getTime(), now.getTime() - 2 * 60 * 60 * 1000);
  const first = state.matches[0];
  const result = await qrCheckInGuest(token, input);
  assert.equal(result.meetingId, 'current');
  assert.equal(first.speakers.length, 1);
  assert.equal(source.speakers.length, 0);
  const next = meeting('next'); state.matches = [next];
  assert.equal((await qrCheckInGuest(token, input)).meetingId, 'next');
  assert.equal(next.speakers.length, 1);
  assert.equal(first.speakers.length, 1);
});

test('outside meeting time or ambiguous schedules cannot create attendance', async t => {
  const { state } = setup(t);
  state.matches = [];
  await assert.rejects(getPublicQrMeeting(token), { status: 409 });
  await assert.rejects(qrCheckInGuest(token, input), { status: 409 });
  state.matches = [meeting('a'), meeting('b')];
  await assert.rejects(qrCheckInGuest(token, input), { status: 409 });
  assert.ok(state.matches.every(m => m.speakers.length === 0));
});

test('shared QR never expires while invalid tokens and GPS remain protected', async t => {
  const { state } = setup(t);
  state.qr.expiresAt = new Date(now);
  assert.equal((await getPublicQrMeeting(token)).expiresAt, null);
  assert.equal((await getManagedCheckInQr('ACME', 'source')).expiresAt, null);
  assert.equal(state.qr.expiresAt, null);
  state.qr.revokedAt = new Date(now);
  await assert.rejects(qrCheckInGuest(token, input), { status: 410 });
  state.qr.revokedAt = undefined;
  await assert.rejects(qrCheckInGuest(token, { ...input, latitude: 12 }), { status: 403 });
  await assert.rejects(qrCheckInGuest(token, { ...input, latitude: undefined }), { status: 400 });
  state.matches[0].latitude = undefined;
  await assert.rejects(qrCheckInGuest(token, input), { status: 409 });
});

test('member authentication and repeat attendance use the resolved meeting and company', async t => {
  const { state } = setup(t);
  const password = await bcrypt.hash('secret', 4);
  const person = { _id: 'member', displayName: 'Member', email: 'member@example.com', password };
  const lookup = t.mock.method(UserModel, 'findOne', (query) => {
    assert.equal(query.companyCode, 'ACME');
    return { select: () => ({ lean: async () => person }) };
  });
  const credentials = { email: person.email, password: 'secret', latitude: 10, longitude: 106 };
  assert.equal((await qrCheckInMember(token, credentials)).meetingId, 'current');
  await qrCheckInMember(token, credentials);
  assert.equal(state.matches[0].speakers.length, 1);
  assert.equal(state.matches[0].speakers[0].userId, 'member');
  assert.equal(lookup.mock.calls[0].arguments[0].email, person.email);
  await assert.rejects(qrCheckInMember(token, { ...credentials, password: 'wrong' }), { status: 401 });
});

test('member authentication with phone number check-in', async t => {
  const { state } = setup(t);
  const password = await bcrypt.hash('secret', 4);
  const person = { _id: '0123456789abcdef01234567', displayName: 'Phone Member', phone: '0901234567', password };
  t.mock.method(UserModel, 'find', (query) => {
    assert.equal(query.companyCode, 'ACME');
    return {
      select: () => ({
        limit: () => ({
          lean: async () => [person],
        }),
      }),
    };
  });
  t.mock.method(UserModel, 'findOne', (query) => {
    assert.equal(query.companyCode, 'ACME');
    return {
      select: () => ({
        lean: async () => person,
      }),
    };
  });
  const credentials = { email: '0901234567', password: 'secret', latitude: 10, longitude: 106 };
  assert.equal((await qrCheckInMember(token, credentials)).meetingId, 'current');
  assert.equal(state.matches[0].speakers[0].userId, '0123456789abcdef01234567');
});

test('revocation during guest image upload cleans up the image and creates no attendance', async t => {
  const { state } = setup(t);
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1kAAAAASUVORK5CYII=', 'base64');
  const asset = { publicId: 'asset', secureUrl: 'https://example.com/image.png', resourceType: 'image' };
  t.mock.method(cloudinaryService, 'uploadMediaAsset', async () => { state.qr.revokedAt = new Date(now); return asset; });
  t.mock.method(MeetingModel, 'exists', async () => null);
  const cleanup = t.mock.method(cloudinaryService, 'deletePublicMedia', async () => {});
  await assert.rejects(qrCheckInGuest(token, input, { buffer, size: buffer.length, mimetype: 'image/png' }), { status: 410 });
  assert.equal(cleanup.mock.callCount(), 1);
  assert.equal(state.matches[0].speakers.length, 0);
});

test('meeting end must follow its start, including partial updates', async t => {
  const { source } = setup(t);
  source.status = 'scheduled';
  const base = { title: 'Meeting', startsAt: '2030-02-01T01:00:00Z', tiers: [{ startTime: "07:00", endTime: "08:00", seconds: 30 }], fallbackSeconds: 20 };
  assert.ok(meetingInput.validate({ ...base, endsAt: base.startsAt }).error);
  await assert.rejects(updateMeeting('ACME', 'source', { endsAt: source.startsAt }), { status: 400 });
  await updateMeeting('ACME', 'source', { endsAt: '2030-01-31T04:00:00Z' });
  assert.equal(source.endsAt.toISOString(), '2030-01-31T04:00:00.000Z');
  await updateMeeting('ACME', 'source', { startsAt: source.startsAt });
  assert.equal(source.endsAt.toISOString(), '2030-01-31T04:00:00.000Z');
  await updateMeeting('ACME', 'source', { startsAt: '2030-02-01T01:00:00Z' });
  assert.equal(source.endsAt.toISOString(), '2030-02-01T04:00:00.000Z');
});
