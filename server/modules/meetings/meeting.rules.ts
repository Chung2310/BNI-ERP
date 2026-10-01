export type SpeakingTier = { count: number; seconds: number };
export type Speaker = { id: string; userId?: string; name: string; email?: string; photoURL?: string; coverImage?: string; checkedInAt: Date | string; seconds: number; spokenSeconds?: number };
export function speakingSeconds(index: number, tiers: SpeakingTier[], fallbackSeconds: number) {
  let boundary = 0;
  for (const tier of tiers) { boundary += tier.count; if (index < boundary) return tier.seconds; }
  return fallbackSeconds;
}
export function allocateSpeakers<T extends Speaker>(people: T[], tiers: SpeakingTier[], fallbackSeconds: number): T[] {
  const arrival = people.map((person, index) => ({ index, at: new Date(person.checkedInAt).getTime() }))
    .sort((a, b) => {
      const left = Number.isFinite(a.at) ? a.at : Infinity;
      const right = Number.isFinite(b.at) ? b.at : Infinity;
      return (left === right ? 0 : left - right) || a.index - b.index;
    });
  const allocations = new Map(arrival.map((person, rank) => [person.index, speakingSeconds(rank, tiers, fallbackSeconds)]));
  return people.map((person, index) => ({ ...person, seconds: allocations.get(index)! }));
}
export function elapsedSeconds(meeting: { elapsedSeconds?: number; speakerStartedAt?: Date | string | null; status: string }, now = new Date()) {
  return (meeting.elapsedSeconds || 0) + (meeting.status === 'live' && meeting.speakerStartedAt ? Math.max(0, (now.getTime() - new Date(meeting.speakerStartedAt).getTime()) / 1000) : 0);
}
export function reminderDueAt(startsAt: Date, days: number) { return new Date(startsAt.getTime() - days * 24 * 60 * 60_000); }
