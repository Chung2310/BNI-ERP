export const PRESENTATION_VIEWS = ["checkin", "speaker", "luckyDraw", "activeMembers", "audienceResponses", "waiting"] as const;
export type PresentationView = typeof PRESENTATION_VIEWS[number];
export type DrawFilter = "all" | "all_members" | "present_members" | "absent_members" | "guests";
export type AudienceResponsePanel = "questions" | "prepare" | "qr" | "results";
export type MeetingPresentationState = {
  view: PresentationView;
  autoAdvance: boolean;
  autoAdvanceDelay: number;
  speakerTimerPausedByView?: boolean;
  drawWinnerId?: string;
  drawStartedAt?: string;
  drawRevealsAt?: string;
  drawFilter?: DrawFilter;
  drawParticipantIds?: string[] | null;
  drawPanel?: "participants" | "winners";
  drawResultVisible?: boolean;
  audienceResponsePanel?: AudienceResponsePanel;
};
export function presentationState(value?: Partial<MeetingPresentationState> | null): MeetingPresentationState {
  return { view: value?.view || "checkin", autoAdvance: value?.autoAdvance ?? false,
    autoAdvanceDelay: value?.autoAdvanceDelay ?? 3,
    speakerTimerPausedByView: value?.speakerTimerPausedByView,
    drawWinnerId: value?.drawWinnerId, drawStartedAt: value?.drawStartedAt, drawRevealsAt: value?.drawRevealsAt,
    drawFilter: "present_members", drawParticipantIds: value?.drawParticipantIds ?? null,
    drawPanel: value?.drawPanel || "participants",
    drawResultVisible: value?.drawResultVisible ?? true,
    audienceResponsePanel: value?.audienceResponsePanel || "questions" };
}
