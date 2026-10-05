// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RankingsTab from "./RankingsTab";
import { authService } from "../services/authService";
import { meetingService } from "../services/meetingService";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { uid: "admin", companyCode: "ACME" } }),
}));
vi.mock("../services/authService", () => ({
  authService: { getUsersByCompany: vi.fn(), getColleagues: vi.fn() },
}));
vi.mock("../services/meetingService", () => ({
  meetingService: { listMeetings: vi.fn() },
}));
vi.mock("../services/socketService", () => ({
  socketService: { on: vi.fn(() => vi.fn()) },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("includes matching meetings in rankings and displays a single reset control", async () => {
  vi.mocked(authService.getUsersByCompany).mockResolvedValue([
    { uid: "member", displayName: "Active Member", role: "user" },
  ] as never);
  vi.mocked(meetingService.listMeetings).mockResolvedValue([
    {
      _id: "meeting",
      title: "Chapter meeting",
      companyCode: "ACME",
      startsAt: "2026-09-01T08:00:00.000Z",
      status: "ended",
      speakers: [{
        id: "speaker",
        userId: "member",
        name: "Active Member",
        checkedInAt: "2026-09-01T07:55:00.000Z",
        seconds: 0,
      }],
      currentIndex: 0,
      revision: 1,
      __v: 0,
    },
  ]);

  render(<RankingsTab />);

  expect((await screen.findAllByText("Active Member")).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Đặt lại bộ lọc" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Làm mới bảng xếp hạng" })).toBeNull();
});
