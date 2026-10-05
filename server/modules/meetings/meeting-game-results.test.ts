import assert from 'node:assert/strict';
import test from 'node:test';
import { setRateLimitRedisClientForTesting } from '../../infrastructure/rate-limit-redis';
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { recordGameWinner } = await import('./meeting.service');
import { MeetingModel } from './meeting.model';
import { gameWinnerInput } from './meeting.validation';

test('wheel and bingo results survive serialization and retry without duplicates', async () => {
  const item = new MeetingModel({ companyCode: 'TEST', title: 'Meeting', startsAt: new Date(),
    speakers: [{ id: 'guest', name: 'Guest', email: 'guest@example.com', checkedInAt: new Date(), seconds: 30 }],
    luckyDraw: { prizes: [{ id: 'prize', name: 'Prize', reward: 'Gift' }] } });
  let saves = 0;
  item.save = async () => { saves++; return item; };
  for (const source of ['wheel', 'bingo']) {
    const input = { id: source, winnerId: 'guest', name: 'Old name', prizeName: 'Prize', source,
      ticketNumber: source === 'bingo' ? 7 : undefined, wonAt: new Date().toISOString() };
    assert.equal(gameWinnerInput.validate(input).error, undefined);
    await recordGameWinner(item, (input as unknown as Parameters<typeof recordGameWinner>[1]), 'operator');
    await recordGameWinner(item, (input as unknown as Parameters<typeof recordGameWinner>[1]), 'operator');
  }
  const restored = new MeetingModel(item.toObject());
  assert.equal(saves, 2);
  assert.deepEqual(restored.gameWinners.map(w => w.source), ['wheel', 'bingo']);
  assert.equal(restored.gameWinners[1].ticketNumber, 7);
  assert.equal(restored.gameWinners[0].name, 'Guest');
  assert.equal(restored.gameWinners[0].email, 'guest@example.com');
  assert.equal(restored.gameWinners[0].reward, 'Gift');
  assert.equal(restored.gameWinners[0].drawnBy, 'operator');
});

test('result input rejects invalid sources, dates and untrusted audit fields', () => {
  const input = { id: 'result', winnerId: 'guest', name: 'Guest', prizeName: 'Prize', source: 'wheel', wonAt: new Date().toISOString() };
  for (const changes of [{ source: 'draw' }, { source: 'other' }, { wonAt: '14:00' }, { drawnBy: 'other' }, { ticketNumber: -1 }]) {
    assert.ok(gameWinnerInput.validate({ ...input, ...changes }).error);
  }
});
