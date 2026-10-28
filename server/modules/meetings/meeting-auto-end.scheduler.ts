import { meetingEndsAt } from './meeting-qr.rules';

type MeetingForAutoEnd = {
  _id: unknown;
  status: string;
  startsAt: Date | string;
  endsAt?: Date | string | null;
};
type AutoEndHandler = (meetingId: string, expectedEndsAt: Date) => Promise<void>;
type AutoEndTask = { endsAtMs: number; timer?: ReturnType<typeof setTimeout> };

const activeStatuses = new Set(['scheduled', 'live', 'paused']);
const maxTimeoutMs = 2_147_000_000;
const retryDelayMs = 5_000;
const tasks = new Map<string, AutoEndTask>();
let handler: AutoEndHandler | null = null;

export function setMeetingAutoEndHandler(next: AutoEndHandler | null) {
  handler = next;
}

export function cancelMeetingAutoEnd(meetingId: string) {
  const task = tasks.get(meetingId);
  if (!task) return;
  if (task.timer) clearTimeout(task.timer);
  tasks.delete(meetingId);
}

export function scheduleMeetingAutoEnd(meeting: MeetingForAutoEnd) {
  const meetingId = String(meeting._id);
  if (!activeStatuses.has(meeting.status)) {
    cancelMeetingAutoEnd(meetingId);
    return;
  }

  const endsAtMs = meetingEndsAt(meeting.startsAt, meeting.endsAt).getTime();

  if (!Number.isFinite(endsAtMs)) {
    cancelMeetingAutoEnd(meetingId);
    return;
  }

  const existing = tasks.get(meetingId);
  if (existing?.endsAtMs === endsAtMs) return;
  cancelMeetingAutoEnd(meetingId);

  const task: AutoEndTask = { endsAtMs };
  tasks.set(meetingId, task);
  arm(meetingId, task);
}

export function stopMeetingAutoEndTimers() {
  for (const meetingId of tasks.keys()) cancelMeetingAutoEnd(meetingId);
}

function arm(meetingId: string, task: AutoEndTask, delayOverride?: number) {
  const remainingMs = task.endsAtMs - Date.now();
  const delayMs = delayOverride ?? Math.min(Math.max(0, remainingMs), maxTimeoutMs);
  task.timer = setTimeout(() => {
    if (tasks.get(meetingId) !== task) return;

    if (task.endsAtMs > Date.now()) {
      arm(meetingId, task);
      return;
    }

    if (!handler) {
      arm(meetingId, task, retryDelayMs);
      return;
    }

    void handler(meetingId, new Date(task.endsAtMs)).then(() => {
      if (tasks.get(meetingId) === task) tasks.delete(meetingId);
    }).catch((error) => {
      console.error(`[MeetingAutoEnd] Failed to end meeting ${meetingId}; retrying`, error);
      if (tasks.get(meetingId) === task) arm(meetingId, task, retryDelayMs);
    });
  }, delayMs);
  task.timer.unref?.();
}