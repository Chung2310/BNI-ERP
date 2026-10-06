import { MeetingModel } from "./meeting.model";
import { controlMeeting, MeetingError, saveMeeting, setMeetingPresentationView } from "./meeting.service";
import type { MeetingPresentationState } from "../../../src/utils/meetingPresentation";

type MeetingDocument = ReturnType<typeof MeetingModel.hydrate>;
type AutoAdvanceMeeting = {
  status: string; currentIndex: number; speakerStartedAt?: Date | string | null; elapsedSeconds?: number;
  speakers: { seconds: number }[];
  presentation?: { view?: MeetingPresentationState["view"]; autoAdvance?: boolean; autoAdvanceDelay?: number };
};

export async function updatePresentationState(item: MeetingDocument, input: Partial<Pick<MeetingPresentationState, "view" | "autoAdvance" | "autoAdvanceDelay">>, now = new Date()) {
  if (input.view) setMeetingPresentationView(item, input.view, now);
  const current = item.toObject().presentation || {};
  item.set("presentation", { ...current, ...input });
  await saveMeeting(item);
  return item;
}

export function isAutoAdvanceDue(item: AutoAdvanceMeeting, now = new Date()) {
  if (item.status !== "live" || item.presentation?.view !== "speaker" || !item.presentation.autoAdvance || !item.speakerStartedAt) return false;
  const speaker = item.speakers[item.currentIndex];
  if (!speaker) return false;
  const elapsed = (item.elapsedSeconds || 0) + (now.getTime() - new Date(item.speakerStartedAt).getTime()) / 1000;
  return Number.isFinite(elapsed) && elapsed >= speaker.seconds;
}

// Optimistic concurrency ensures that only one worker can advance each version.
export async function advanceDuePresentations(now = new Date()) {
  const meetings = await MeetingModel.find({
    status: "live", "presentation.view": "speaker", "presentation.autoAdvance": true, speakerStartedAt: { $ne: null },
  });
  let advanced = 0;
  for (const meeting of meetings) {
    if (!isAutoAdvanceDue(meeting, now)) continue;
    try {
      await controlMeeting(meeting, "next", now);
      advanced++;
    }
    catch (error) { if (!(error instanceof MeetingError && error.status === 409)) throw error; }
  }
  return advanced;
}
