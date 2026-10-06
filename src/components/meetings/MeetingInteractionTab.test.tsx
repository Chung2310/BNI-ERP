// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingInteractionTab } from "./MeetingInteractionTab";
import { meetingInteractionService, type MeetingInteractionState } from "../../services/meetingInteractionService";
import { meetingLiveApi } from "../../services/meetingLiveService";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") } }));
vi.mock("../../services/socketService", () => ({ socketService: { on: vi.fn(() => () => undefined) } }));
vi.mock("../../services/meetingInteractionService", () => ({ meetingInteractionService: { get: vi.fn(), save: vi.fn(), addQuestion: vi.fn(), selectQuestion: vi.fn(), deleteQuestion: vi.fn(), setStatus: vi.fn(), moderate: vi.fn() } }));
vi.mock("../../services/meetingLiveService", async importOriginal => {
  const actual = await importOriginal<typeof import("../../services/meetingLiveService")>();
  return { ...actual, meetingLiveApi: vi.fn(), meetingRoomUrl: (id: string, mode: string) => `/cuoc-hop?meeting=${id}&mode=${mode}` };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

function interactionState(overrides: Partial<NonNullable<MeetingInteractionState["session"]>> = {}): MeetingInteractionState {
  const question = { id: "q1", text: "Bạn học được gì?", order: 1, responseCount: 0, approvedCount: 0 };
  return { session: { id: "i", meetingId: "m", question: question.text, activeQuestionId: question.id, questionNumber: 1, totalQuestions: 1, questions: [question], durationSeconds: 60, status: "draft", requireName: true, showNames: true, moderationEnabled: true, allowMultipleResponses: false, participationUrl: "/meeting-interaction/token", responseCount: 0, approvedCount: 0, ...overrides }, responses: [] };
}

it("switches to the response view and opens the presentation screen", async () => {
  vi.mocked(meetingInteractionService.get).mockResolvedValue(interactionState({ status: "open", closesAt: new Date(Date.now() + 60000).toISOString() }));
  vi.mocked(meetingLiveApi).mockResolvedValue({});
  const popup = { opener: window, close: vi.fn() } as unknown as Window;
  const open = vi.spyOn(window, "open").mockReturnValue(popup);
  const refresh = vi.fn();
  render(<MeetingInteractionTab meeting={{ _id: "m", __v: 4, title: "Demo", status: "live" } as never} canManage onRefreshMeeting={refresh} />);
  fireEvent.click(await screen.findByRole("button", { name: "Trình chiếu kết quả" }));
  await waitFor(() => expect(meetingLiveApi).toHaveBeenCalledWith("/m/presentation-state", "PATCH", { version: 4, view: "audienceResponses" }));
  expect(open).toHaveBeenCalledWith("/cuoc-hop?meeting=m&mode=display", "_blank");
  expect(refresh).toHaveBeenCalledOnce(); expect(popup.opener).toBeNull();
});

it("opens settings in a popup and saves duration and options inside it", async () => {
  const initial = interactionState();
  vi.mocked(meetingInteractionService.get).mockResolvedValue(initial);
  vi.mocked(meetingInteractionService.save).mockImplementation(async (_meetingId, input) => ({ session: { ...initial.session!, ...input }, responses: [] }));
  render(<MeetingInteractionTab meeting={{ _id: "m", __v: 4, title: "Demo", status: "live" } as never} canManage onRefreshMeeting={vi.fn()} />);
  expect(await screen.findByRole("button", { name: "Cấu hình" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Lưu cấu hình" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cấu hình" }));
  const durationInput = screen.getByRole("spinbutton", { name: /Thời gian trả lời/ }) as HTMLInputElement;
  fireEvent.change(durationInput, { target: { value: "" } });
  expect(durationInput.value).toBe("");
  fireEvent.change(durationInput, { target: { value: "5" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Cho phép gửi nhiều lần/ }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
  await waitFor(() => expect(meetingInteractionService.save).toHaveBeenCalledWith("m", expect.objectContaining({ durationSeconds: 5, allowMultipleResponses: true })));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cấu hình bài tương tác" })).toBeNull());
});

it("creates an additional question in the shared interaction", async () => {
  const initial = interactionState();
  vi.mocked(meetingInteractionService.get).mockResolvedValue(initial);
  vi.mocked(meetingInteractionService.addQuestion).mockResolvedValue(interactionState({ question: "Câu hai", activeQuestionId: "q2", questionNumber: 2, totalQuestions: 2, durationSeconds: 45, questions: [...initial.session!.questions, { id: "q2", text: "Câu hai", order: 2, responseCount: 0, approvedCount: 0 }] }));
  render(<MeetingInteractionTab meeting={{ _id: "m", __v: 4, title: "Demo", status: "live" } as never} canManage onRefreshMeeting={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Thêm câu hỏi" }));
  const dialog = screen.getByRole("dialog", { name: "Thêm câu hỏi" });
  fireEvent.change(within(dialog).getByLabelText("Nội dung câu hỏi"), { target: { value: "Câu hai" } });

  fireEvent.click(within(dialog).getByRole("button", { name: "Thêm câu hỏi" }));
  await waitFor(() => expect(meetingInteractionService.addQuestion).toHaveBeenCalledWith("m", { question: "Câu hai" }));
  expect((await screen.findAllByText("Câu hai")).length).toBeGreaterThan(0);
});

it("keeps long questions inside cards and confirms before deleting", async () => {
  const initial = interactionState({
    totalQuestions: 2,
    questions: [
      { id: "q1", text: "Câu một", order: 1, responseCount: 0, approvedCount: 0 },
      { id: "q2", text: "Một câu hỏi rất dài cần được giữ gọn hoàn toàn bên trong thẻ hiển thị", order: 2, responseCount: 0, approvedCount: 0 },
    ],
  });
  vi.mocked(meetingInteractionService.get).mockResolvedValue(initial);
  vi.mocked(meetingInteractionService.deleteQuestion).mockResolvedValue(interactionState());

  render(<MeetingInteractionTab meeting={{ _id: "m", __v: 4, title: "Demo", status: "live" } as never} canManage onRefreshMeeting={vi.fn()} />);

  const longQuestion = await screen.findByText("Một câu hỏi rất dài cần được giữ gọn hoàn toàn bên trong thẻ hiển thị");
  expect(longQuestion.className).toContain("overflow-hidden");
  expect(longQuestion.className).toContain("[-webkit-line-clamp:2]");

  fireEvent.click(screen.getByRole("button", { name: "Xóa câu hỏi 2" }));
  const dialog = screen.getByRole("dialog", { name: "Xóa câu hỏi?" });
  expect(within(dialog).getByText(/Toàn bộ câu trả lời/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Xóa câu hỏi" }));

  await waitFor(() => expect(meetingInteractionService.deleteQuestion).toHaveBeenCalledWith("m", "q2"));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Xóa câu hỏi?" })).toBeNull());
});
