interface MeetingTiming {
  startsAt: string | Date;
  startedAt?: string | Date | null;
}

/** Actual meeting start is independent of the scheduled time and speaker timers. */
export function meetingElapsedLabel(meeting: MeetingTiming, now = Date.now()): string {
  const actual = meeting.startedAt ? new Date(meeting.startedAt).getTime() : NaN;
  const scheduled = new Date(meeting.startsAt).getTime();
  if (!Number.isFinite(actual) && scheduled > now) return "Chưa đến giờ họp";
  const start = Number.isFinite(actual) ? actual : scheduled;
  if (!Number.isFinite(start)) return "Đang diễn ra";
  return `Đang diễn ra ${Math.max(0, Math.floor((now - start) / 60000))} phút`;
}