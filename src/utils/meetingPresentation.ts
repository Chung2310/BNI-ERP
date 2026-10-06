export const PRESENTATION_VIEWS = ["checkin", "speaker", "luckyDraw", "activeMembers", "waiting"] as const;
export type PresentationView = typeof PRESENTATION_VIEWS[number];
export type MeetingPresentationState = {
  view: PresentationView;
  autoAdvance: boolean;
  autoAdvanceDelay: number;
  speakerTimerPausedByView?: boolean;
  drawWinnerId?: string;
  drawStartedAt?: string;
  drawRevealsAt?: string;
};
export function presentationState(value?: Partial<MeetingPresentationState> | null): MeetingPresentationState {
  return { view: value?.view || "checkin", autoAdvance: value?.autoAdvance ?? false,
    autoAdvanceDelay: value?.autoAdvanceDelay ?? 3,
    speakerTimerPausedByView: value?.speakerTimerPausedByView,
    drawWinnerId: value?.drawWinnerId, drawStartedAt: value?.drawStartedAt, drawRevealsAt: value?.drawRevealsAt };
}
