// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ActiveMemberLeaderboard } from "./ActiveMemberLeaderboard";
import type { UserProfile } from "../../types";
import type { Meeting } from "../../services/meetingService";

afterEach(cleanup);
const members = [
  { uid: "admin", role: "admin", displayName: "Admin check-in sớm" },
  { uid: "admin-absent", role: "admin", displayName: "Admin không tham dự" },
  { uid: "member", role: "user", displayName: "Thành viên An" },
  { uid: "manager", role: "manager", displayName: "Thành viên Bình" },
  { uid: "inactive", role: "user", displayName: "Đã ngừng hoạt động", isActive: false },
] as UserProfile[];
const meetings = [{
  _id: "meeting", startsAt: "2025-01-01T01:00:00Z", status: "ended",
  speakers: [
    { userId: "admin", name: "Admin từ lịch sử", checkedInAt: "2025-01-01T00:00:00Z" },
    { userId: "member", name: "Thành viên An", checkedInAt: "2025-01-01T00:45:00Z" },
    { userId: "manager", name: "Thành viên Bình", checkedInAt: "2025-01-01T01:00:00Z" },
    { userId: "inactive", name: "Đã ngừng hoạt động", checkedInAt: "2025-01-01T00:00:00Z" },
    { userId: "unknown-admin", name: "Admin ngoài danh sách", checkedInAt: "2025-01-01T00:00:00Z" },
  ],
}] as Meeting[];

it("ranks active members without reintroducing admins from check-in history", () => {
  render(<ActiveMemberLeaderboard members={members} meetings={meetings} loading={false} />);
  expect(screen.getAllByText("Thành viên An")).toHaveLength(2);
  expect(screen.getAllByText("Thành viên Bình")).toHaveLength(2);
  expect(screen.getByText("Top 2")).toBeTruthy();
  expect(screen.queryByText(/Admin/)).toBeNull();
  expect(screen.queryByText("Đã ngừng hoạt động")).toBeNull();
});

it("shows no ranked attendees when the roster contains only admins", () => {
  render(<ActiveMemberLeaderboard members={members.filter(member => member.role === "admin")} meetings={meetings} loading={false} />);
  expect(screen.getByText("Top 0")).toBeTruthy();
  expect(screen.getByText("Chưa có dữ liệu điểm danh thành viên trong khoảng thời gian đã chọn.")).toBeTruthy();
  expect(screen.queryByText(/Admin/)).toBeNull();
});
