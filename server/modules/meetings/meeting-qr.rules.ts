export const DEFAULT_MEETING_DURATION_MS = 2 * 60 * 60 * 1000;

export function meetingEndsAt(startsAt: Date | string, endsAt?: Date | string | null) {
  return endsAt ? new Date(endsAt) : new Date(new Date(startsAt).getTime() + DEFAULT_MEETING_DURATION_MS);
}
