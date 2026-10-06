import { meetingLiveApi } from "./meetingLiveService";

export type MeetingInteractionStatus = "draft" | "open" | "closed";
export type MeetingInteractionResponseStatus = "pending" | "approved" | "hidden" | "rejected";

export interface MeetingInteractionSession {
  id: string;
  meetingId: string;
  question: string;
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
  participantId: string;
  name: string;
  answer: string;
  status: MeetingInteractionResponseStatus;
  createdAt: string;
}

export interface MeetingInteractionState {
  session: MeetingInteractionSession | null;
  responses: MeetingInteractionResponse[];
}

export interface PublicMeetingInteraction {
  meetingTitle: string;
  question: string;
  status: MeetingInteractionStatus;
  requireName: boolean;
  allowMultipleResponses: boolean;
}

export const meetingInteractionService = {
  get: (meetingId: string, signal?: AbortSignal) => meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction`, "GET", undefined, signal),
  save: (meetingId: string, input: Pick<MeetingInteractionSession, "question" | "requireName" | "showNames" | "moderationEnabled" | "allowMultipleResponses">) =>
    meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction`, "PUT", input),
  setStatus: (meetingId: string, status: "open" | "closed") =>
    meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction/status`, "POST", { status }),
  moderate: (meetingId: string, responseId: string, status: "approved" | "hidden" | "rejected") =>
    meetingLiveApi<MeetingInteractionState>(`/${meetingId}/interaction/responses/${responseId}`, "PATCH", { status }),
};

async function publicApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/meeting-interaction/${path}`, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Không thể kết nối phiên tương tác.");
  return result.data as T;
}

export const publicMeetingInteractionService = {
  get: (token: string) => publicApi<PublicMeetingInteraction>(encodeURIComponent(token)),
  submit: (token: string, input: { participantId: string; name: string; answer: string }) =>
    publicApi<{ id: string; status: MeetingInteractionResponseStatus; meetingTitle: string }>(`${encodeURIComponent(token)}/responses`, "POST", input),
};