import assert from 'node:assert/strict';
import test from 'node:test';
import { setRateLimitRedisClientForTesting } from '../../infrastructure/rate-limit-redis';
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { recordGameWinner } = await import('./meeting.service');
import { MeetingModel } from './meeting.model';
import { gameWinnerInput } from './meeting.validation';
import { notificationService } from '../../service/notification.service';

test('wheel and bingo results survive serialization and notify only the member winner once', async (t) => {
  const createNotification = t.mock.method(notificationService, 'createNotification', async () => ({}) as never);
  const item = new MeetingModel({ companyCode: 'TEST', title: 'Meeting', startsAt: new Date(),
    speakers: [
      { id: 'member', userId: 'member-user', name: 'Member', email: 'member@example.com', checkedInAt: new Date('2030-01-01T06:30:00+07:00'), seconds: 30 },
      { id: 'guest', name: 'Guest', email: 'guest@example.com', checkedInAt: new Date('2030-01-01T06:30:00+07:00'), seconds: 30 },
    ],
    luckyDraw: { prizes: [{ id: 'prize', name: 'Prize', reward: 'Gift' }] } });
  let saves = 0;
  item.save = async () => { saves++; return item; };
  for (const source of ['wheel', 'bingo']) {
    const input = { id: source, winnerId: source === 'wheel' ? 'member' : 'guest', name: 'Old name', prizeName: 'Prize', source,
      ticketNumber: source === 'bingo' ? 7 : undefined, wonAt: new Date().toISOString() };
    assert.equal(gameWinnerInput.validate(input).error, undefined);
    await recordGameWinner(item, (input as unknown as Parameters<typeof recordGameWinner>[1]), 'operator');
    await recordGameWinner(item, (input as unknown as Parameters<typeof recordGameWinner>[1]), 'operator');
  }
  const restored = new MeetingModel(item.toObject());
  assert.equal(saves, 2);
  assert.deepEqual(restored.gameWinners.map(w => w.source), ['wheel', 'bingo']);
  assert.equal(restored.gameWinners[1].ticketNumber, 7);
  assert.equal(restored.gameWinners[0].name, 'Member');
  assert.equal(restored.gameWinners[0].email, 'member@example.com');
  assert.equal(restored.gameWinners[0].reward, '');
  assert.equal(restored.gameWinners[0].drawnBy, 'operator');
  await new Promise(setImmediate);
  assert.equal(createNotification.mock.callCount(), 1);
  assert.equal(createNotification.mock.calls[0].arguments[0].recipientUid, 'member-user');
  assert.match(createNotification.mock.calls[0].arguments[0].body!, /Meeting/);
});

test('wheel result rejects guests and members checked in after 07:00', async () => {
  const item = new MeetingModel({ companyCode: 'TEST', title: 'Meeting', startsAt: new Date(),
    speakers: [
      { id: 'guest', name: 'Guest', checkedInAt: new Date('2030-01-01T06:30:00+07:00'), seconds: 30 },
      { id: 'late', userId: 'late-user', name: 'Late', checkedInAt: new Date('2030-01-01T07:01:00+07:00'), seconds: 30 },
    ] });
  item.save = async () => item;
  for (const winnerId of ['guest', 'late']) {
    await assert.rejects(recordGameWinner(item, { id: winnerId, winnerId, name: winnerId, prizeName: 'Prize', source: 'wheel', wonAt: new Date() }, 'operator'),
      (error: { status?: number }) => error.status === 400);
  }
  assert.equal(item.gameWinners.length, 0);
});

test('wheel result follows the meeting-specific cutoff', async (t) => {
  t.mock.method(notificationService, 'createNotification', async () => ({}) as never);
  const item = new MeetingModel({ companyCode: 'TEST', title: 'Meeting', startsAt: new Date(),
    luckyDraw: { checkInCutoffTime: '07:15' },
    speakers: [
      { id: 'on-time', userId: 'member-1', name: 'On time', checkedInAt: new Date('2030-01-01T07:15:59+07:00'), seconds: 30 },
      { id: 'late', userId: 'member-2', name: 'Late', checkedInAt: new Date('2030-01-01T07:16:00+07:00'), seconds: 30 },
    ] });
  item.save = async () => item;
  await recordGameWinner(item, { id: 'first', winnerId: 'on-time', name: 'On time', prizeName: 'Prize', source: 'wheel', wonAt: new Date() }, 'operator');
  await assert.rejects(recordGameWinner(item, { id: 'second', winnerId: 'late', name: 'Late', prizeName: 'Prize', source: 'wheel', wonAt: new Date() }, 'operator'),
    (error: { status?: number }) => error.status === 400);
  assert.equal(item.gameWinners.length, 1);
});

test('result input rejects invalid sources, dates and untrusted audit fields', () => {
  const input = { id: 'result', winnerId: 'guest', name: 'Guest', prizeName: 'Prize', source: 'wheel', wonAt: new Date().toISOString() };
  for (const changes of [{ source: 'draw' }, { source: 'other' }, { wonAt: '14:00' }, { drawnBy: 'other' }, { ticketNumber: -1 }]) {
    assert.ok(gameWinnerInput.validate({ ...input, ...changes }).error);
  }
});
