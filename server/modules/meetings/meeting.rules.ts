import type { SpeakingTier } from "../../../src/utils/meetingSpeakingTime";
export type { SpeakingTier } from "../../../src/utils/meetingSpeakingTime";
export type Speaker = { id: string; userId?: string; name: string; email?: string; photoURL?: string; coverImage?: string; checkedInAt: Date | string; seconds: number; spokenSeconds?: number };
export function speakingSeconds(checkedInAt: Date | string, tiers: SpeakingTier[], fallbackSeconds: number, legacyIndex = 0) {
  if (tiers.some(tier => tier.startTime !== undefined || tier.endTime !== undefined)) {
    const timestamp = new Date(checkedInAt).getTime();
    if (!Number.isFinite(timestamp)) return fallbackSeconds;
    const time = new Date(timestamp + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
    return tiers.find(tier => tier.startTime && tier.endTime && time >= tier.startTime && time < tier.endTime)?.seconds ?? fallbackSeconds;
  }
  // Preserve previously saved count-based schedules until their configuration is updated.
  let boundary = 0;
  for (const tier of tiers) { boundary += tier.count ?? 0; if (legacyIndex < boundary) return tier.seconds; }
  return fallbackSeconds;
}
export function allocateSpeakers<T extends Speaker>(people: T[], tiers: SpeakingTier[], fallbackSeconds: number): T[] {
  if (tiers.some(tier => tier.startTime !== undefined || tier.endTime !== undefined)) {
    return people.map(person => ({ ...person, seconds: speakingSeconds(person.checkedInAt, tiers, fallbackSeconds) }));
  }
  const arrival = people.map((person, index) => ({ index, at: new Date(person.checkedInAt).getTime() }))
    .sort((a, b) => {
      const left = Number.isFinite(a.at) ? a.at : Infinity;
      const right = Number.isFinite(b.at) ? b.at : Infinity;
      return (left === right ? 0 : left - right) || a.index - b.index;
    });
  const allocations = new Map(arrival.map((person, rank) => [person.index, speakingSeconds(people[person.index].checkedInAt, tiers, fallbackSeconds, rank)]));
  return people.map((person, index) => ({ ...person, seconds: allocations.get(index)! }));
}
export function elapsedSeconds(meeting: { elapsedSeconds?: number; speakerStartedAt?: Date | string | null; status: string }, now = new Date()) {
  return (meeting.elapsedSeconds || 0) + (meeting.status === 'live' && meeting.speakerStartedAt ? Math.max(0, (now.getTime() - new Date(meeting.speakerStartedAt).getTime()) / 1000) : 0);
}
export function reminderDueAt(startsAt: Date, days: number) { return new Date(startsAt.getTime() - days * 24 * 60 * 60_000); }
