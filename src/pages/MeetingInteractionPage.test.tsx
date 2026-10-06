// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MeetingInteractionPage from "./MeetingInteractionPage";
import { publicMeetingInteractionService } from "../services/meetingInteractionService";

vi.mock("../services/meetingInteractionService", () => ({
  publicMeetingInteractionService: { get: vi.fn(), submit: vi.fn() },
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("collects a participant name and answer from a public QR link", async () => {
  window.history.pushState({}, "", "/meeting-interaction/public-token");
  vi.mocked(publicMeetingInteractionService.get).mockResolvedValue({ meetingTitle: "Họp BNI", question: "Bạn học được gì?", status: "open", requireName: true, allowMultipleResponses: false });
  vi.mocked(publicMeetingInteractionService.submit).mockResolvedValue({ id: "response", status: "pending", meetingTitle: "Họp BNI" });
  render(<MeetingInteractionPage />);

  expect(await screen.findByText("Bạn học được gì?")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Tên của bạn"), { target: { value: "Lan" } });
  fireEvent.change(screen.getByLabelText("Câu trả lời"), { target: { value: "Kết nối chân thành" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi câu trả lời" }));

  await waitFor(() => expect(publicMeetingInteractionService.submit).toHaveBeenCalledWith("public-token", expect.objectContaining({ name: "Lan", answer: "Kết nối chân thành" })));
  expect(await screen.findByText("Đã gửi câu trả lời")).toBeTruthy();
});