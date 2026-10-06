import { meetingLiveApi } from "./meetingLiveService";

export type MeetingInteractionStatus = "draft" | "open" | "closed";
export type MeetingInteractionResponseStatus = "pending" | "approved" | "hidden" | "rejected";

export interface MeetingInteractionQuestion {
  id: string;
  text: string;
  order: number;
  responseCount: number;
  approvedCount: number;
}

export interface MeetingInteractionSession {
  id: string;
  meetingId: string;
  question: string;
  activeQuestionId: string;
  questionNumber: number;
  totalQuestions: number;
  questions: MeetingInteractionQuestion[];
  durationSeconds: number;
  openedAt?: string;
  closesAt?: string;
  status: MeetingInteractionStatus;
  requireName: boolean;
  showNames: boolean;
  moderationEnabled: boolean;
  allowMultipleResponses: boolean;
  participationUrl: string;
  responseCount: number;
  approvedCount: number;
}

export interface MeetingInteractionResponse {
  id: string;
  questionId: string;
  participantId: string;
  name: string;
  answer: string;
  status: MeetingInteractionResponseStatus;
  createdAt: string;
}

export interface MeetingInteractionState {
  session: MeetingInteractionSession | null;
  responses: MeetingInteractionResponse[];
  allResponses?: MeetingInteractionResponse[];
}

export interface PublicMeetingInteractionQuestion {
  id: string;
  text: string;
  order: number;
}

export interface PublicMeetingInteraction {
  meetingTitle: string;
  questions: PublicMeetingInteractionQuestion[];
  totalQuestions: number;
  durationSeconds: number;
  openedAt?: string;
  closesAt?: string;
  status: MeetingInteractionStatus;
  requireName: boolean;
  allowMultipleResponses: boolean;
}

type InteractionSettings = Pick<MeetingInteractionSession, "question" | "durationSeconds" | "requireName" | "showNames" | "moderationEnabled" | "allowMultipleResponses">;

export const meetingInteractionService = {
  get: (meetingId: string, signal?: AbortSignal) => meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction`, "GET", undefined, signal),
  save: (meetingId: string, input: InteractionSettings) => meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction`, "PUT", input),
  addQuestion: (meetingId: string, input: { question: string }) => meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction/questions`, "POST", input),
  selectQuestion: (meetingId: string, questionId: string) => meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction/questions/${encodeURIComponent(questionId)}/select`, "POST", {}),
  deleteQuestion: (meetingId: string, questionId: string) => meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction/questions/${encodeURIComponent(questionId)}`, "DELETE"),
  setStatus: (meetingId: string, status: "open" | "closed") => meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction/status`, "POST", { status }),
  moderate: (meetingId: string, responseId: string, status: "approved" | "hidden" | "rejected") => meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction/responses/${responseId}`, "PATCH", { status }),
};

async function publicApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/meeting-interaction/${path}`, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Không thể kết nối bài tương tác.");
  return result.data as T;
}

export const publicMeetingInteractionService = {
  get: (token: string) => publicApi<PublicMeetingInteraction>(encodeURIComponent(token)),
  submit: (token: string, input: { participantId: string; name: string; answers: Array<{ questionId: string; answer: string }> }) =>
    publicApi<{ ids: string[]; status: MeetingInteractionResponseStatus; meetingTitle: string; answerCount: number }>(`${encodeURIComponent(token)}/responses`, "POST", input),
};
