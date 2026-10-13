import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../socket', () => ({ emitToCompany: vi.fn() }));
import { MeetingModel } from './meeting.model';
import { autoEndDueMeetings } from './meeting.service';

afterEach(() => vi.restoreAllMocks());

function meeting(status: 'scheduled' | 'live' | 'paused', endsAt?: Date) {
  const item = new MeetingModel({
    companyCode: 'BNI', title: 'Meeting', status,
    startsAt: new Date('2030-01-02T00:00:00Z'), endsAt,
    reminderAt: new Date('2030-01-01T00:00:00Z'),
    speakers: [{ id: 'speaker', name: 'Speaker', checkedInAt: new Date('2030-01-02T00:00:00Z'), seconds: 20 }],
    currentIndex: status === 'scheduled' ? -1 : 0,
    speakerStartedAt: status === 'live' ? new Date('2030-01-02T00:00:00Z') : undefined,
    elapsedSeconds: status === 'paused' ? 10 : 0,
  });
  vi.spyOn(item, 'save').mockResolvedValue(item);
  return item;
}

it('ends live and paused meetings three hours after their configured end, including overdue meetings', async () => {
  const live = meeting('live', new Date('2030-01-02T02:00:00Z'));
  const paused = meeting('paused', new Date('2030-01-02T02:00:00Z'));
  vi.spyOn(MeetingModel, 'find').mockResolvedValue([live, paused]);

  expect(await autoEndDueMeetings(new Date('2030-01-02T04:59:59.999Z'))).toBe(0);
  expect(live.status).toBe('live');
  expect(await autoEndDueMeetings(new Date('2030-01-05T00:00:00Z'))).toBe(2);
  for (const item of [live, paused]) {
    expect(item.status).toBe('ended');
    expect(item.endedAt?.toISOString()).toBe('2030-01-02T05:00:00.000Z');
    expect(item.speakerStartedAt).toBeUndefined();
    expect(item.speakers[0].spokenSeconds).toBeLessThanOrEqual(20);
    expect(item.save).toHaveBeenCalledOnce();
  }
});

it('closes stale scheduled meetings and uses the two-hour default when no end is stored', async () => {
  const scheduled = meeting('scheduled');
  const find = vi.spyOn(MeetingModel, 'find').mockResolvedValue([scheduled]);
  const now = new Date('2030-01-02T05:00:00Z');

  expect(await autoEndDueMeetings(now)).toBe(1);
  expect(scheduled.status).toBe('ended');
  expect(scheduled.startedAt).toBeUndefined();
  expect(scheduled.endedAt?.toISOString()).toBe(now.toISOString());
  expect(find).toHaveBeenCalledWith({
    status: { $in: ['scheduled', 'live', 'paused'] },
    $or: [
      { endsAt: { $lte: new Date('2030-01-02T02:00:00Z') } },
      { endsAt: null, startsAt: { $lte: new Date('2030-01-02T00:00:00Z') } },
    ],
  });
});
