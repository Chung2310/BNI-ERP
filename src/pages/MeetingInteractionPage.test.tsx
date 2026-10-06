// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MeetingInteractionPage from "./MeetingInteractionPage";
import { publicMeetingInteractionService } from "../services/meetingInteractionService";

vi.mock("../services/meetingInteractionService", () => ({ publicMeetingInteractionService: { get: vi.fn(), submit: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("shows all questions with one countdown and submits all answers together", async () => {
  window.history.pushState({}, "", "/meeting-interaction/public-token");
  vi.mocked(publicMeetingInteractionService.get).mockResolvedValue({
    meetingTitle: "Họp BNI",
    questions: [
      { id: "q1", text: "Bạn học được gì?", order: 1 },
      { id: "q2", text: "Bạn sẽ áp dụng điều gì?", order: 2 },
    ],
    totalQuestions: 2,
    durationSeconds: 60,
    closesAt: new Date(Date.now() + 60000).toISOString(),
    status: "open",
    requireName: true,
    allowMultipleResponses: false,
  });
  vi.mocked(publicMeetingInteractionService.submit).mockResolvedValue({
    ids: ["r1", "r2"],
    status: "pending",
    meetingTitle: "Họp BNI",
    answerCount: 2,
  });
  render(<MeetingInteractionPage />);

  expect(await screen.findByText("2 câu hỏi")).toBeTruthy();
  expect(screen.getByText("Bạn học được gì?")).toBeTruthy();
  expect(screen.getByText("Bạn sẽ áp dụng điều gì?")).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toMatch(/Còn (59|60) giây/);

  fireEvent.change(screen.getByLabelText("Tên của bạn"), { target: { value: "Lan" } });
  fireEvent.change(screen.getByLabelText("Câu trả lời câu 1"), { target: { value: "Kết nối chân thành" } });
  fireEvent.change(screen.getByLabelText("Câu trả lời câu 2"), { target: { value: "Gọi lại khách hàng" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi 2 câu trả lời" }));

  await waitFor(() => expect(publicMeetingInteractionService.submit).toHaveBeenCalledWith("public-token", expect.objectContaining({
    name: "Lan",
    answers: [
      { questionId: "q1", answer: "Kết nối chân thành" },
      { questionId: "q2", answer: "Gọi lại khách hàng" },
    ],
  })));
  expect(await screen.findByText("Đã gửi bài trả lời")).toBeTruthy();
});
