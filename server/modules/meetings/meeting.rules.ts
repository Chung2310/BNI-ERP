export type SpeakingTier = { count: number; seconds: number };
export type Speaker = { id: string; userId?: string; name: string; email?: string; photoURL?: string; coverImage?: string; checkedInAt: Date | string; seconds: number; spokenSeconds?: number };
export function speakingSeconds(index: number, tiers: SpeakingTier[], fallbackSeconds: number) {
  let boundary = 0;
  for (const tier of tiers) { boundary += tier.count; if (index < boundary) return tier.seconds; }
  return fallbackSeconds;
}
export function allocateSpeakers<T extends Speaker>(people: T[], tiers: SpeakingTier[], fallbackSeconds: number): T[] {
  return people.map((person, index) => ({ ...person, seconds: speakingSeconds(index, tiers, fallbackSeconds) }));
}
export function elapsedSeconds(meeting: { elapsedSeconds?: number; speakerStartedAt?: Date | string | null; status: string }, now = new Date()) {
  return (meeting.elapsedSeconds || 0) + (meeting.status === 'live' && meeting.speakerStartedAt ? Math.max(0, (now.getTime() - new Date(meeting.speakerStartedAt).getTime()) / 1000) : 0);
}
export function reminderDueAt(startsAt: Date, days: number) { return new Date(startsAt.getTime() - days * 24 * 60 * 60_000); }
