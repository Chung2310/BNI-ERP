// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingInteractionTab } from "./MeetingInteractionTab";
import { meetingInteractionService } from "../../services/meetingInteractionService";
import { meetingLiveApi } from "../../services/meetingLiveService";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") } }));
vi.mock("../../services/socketService", () => ({ socketService: { on: vi.fn(() => () => undefined) } }));
vi.mock("../../services/meetingInteractionService", () => ({ meetingInteractionService: { get: vi.fn(), save: vi.fn(), setStatus: vi.fn(), moderate: vi.fn() } }));
vi.mock("../../services/meetingLiveService", async importOriginal => {
  const actual = await importOriginal<typeof import("../../services/meetingLiveService")>();
  return { ...actual, meetingLiveApi: vi.fn(), meetingRoomUrl: (id: string, mode: string) => `/cuoc-hop?meeting=${id}&mode=${mode}` };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("switches to the response view and opens the presentation screen", async () => {
  vi.mocked(meetingInteractionService.get).mockResolvedValue({
    session: { id: "i", meetingId: "m", question: "Bạn học được gì?", status: "open", requireName: true, showNames: true, moderationEnabled: true, allowMultipleResponses: false, participationUrl: "/meeting-interaction/token", responseCount: 0, approvedCount: 0 },
    responses: [],
  });
  vi.mocked(meetingLiveApi).mockResolvedValue({});
  const popup = { opener: window, close: vi.fn() } as unknown as Window;
  const open = vi.spyOn(window, "open").mockReturnValue(popup);
  const refresh = vi.fn();
  render(<MeetingInteractionTab meeting={{ _id: "m", __v: 4, title: "Demo", status: "live" } as never} canManage onRefreshMeeting={refresh} />);

  fireEvent.click(await screen.findByRole("button", { name: "Trình chiếu kết quả" }));

  await waitFor(() => expect(meetingLiveApi).toHaveBeenCalledWith("/m/presentation-state", "PATCH", { version: 4, view: "audienceResponses" }));
  expect(open).toHaveBeenCalledWith("/cuoc-hop?meeting=m&mode=display", "_blank");
  expect(refresh).toHaveBeenCalledOnce();
  expect(popup.opener).toBeNull();
});