// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getRouteByTab } from "./route-config";
import { MODULE_READ_PERMISSIONS } from "../config/modules";
import { AppRouterView } from "./AppRouterView";
import Sidebar from "../pages/Sidebar";
import { meetingService } from "../services/meetingService";
import { authService } from "../services/authService";
import type { UserProfile } from "../types";

const { member } = vi.hoisted(() => ({
  member: { uid: "member", role: "user", displayName: "Thành viên", email: "member@test.com", companyCode: "BNI", permissions: ["meetings:read"], createdAt: "2020-01-01" },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({
  userProfile: member, hasPermission: (code: string) => member.permissions.includes(code),
}) }));
vi.mock("../hooks/useMediaQuery", () => ({ useIsMobile: () => false }));
vi.mock("../services/socketService", () => ({ socketService: { on: () => () => {} } }));
vi.mock("../services/authService", () => ({ authService: {
  getUsersByCompany: vi.fn().mockRejectedValue(new Error("No access to user management")),
  getColleagues: vi.fn().mockResolvedValue([member]),
} }));
vi.mock("../services/meetingService", () => ({ meetingService: { listMeetings: vi.fn().mockResolvedValue([{
  _id: "meeting", title: "Buổi họp thành viên", startsAt: "2025-01-01T01:00:00Z", status: "ended",
  speakers: [{ id: "speaker", userId: "member", name: "Thành viên", seconds: 30, checkedInAt: "2025-01-01T00:55:00Z" }],
}]) } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each(["meetings:read", "meetings:manage", "dashboard:read", "*"])("opens overview with %s and keeps its menu consistent", permission => {
  const profile = { ...member, permissions: [permission] } as UserProfile;
  expect(getRouteByTab("TỔNG QUAN").canAccess?.(profile)).toBe(true);
  expect(permission === "*" || MODULE_READ_PERMISSIONS["TỔNG QUAN"]!.includes(permission)).toBe(true);
});

it("keeps unrelated management pages restricted for members", () => {
  const profile = member as UserProfile;
  expect(getRouteByTab("QUẢN TRỊ USER").canAccess?.(profile)).toBe(false);
  expect(getRouteByTab("PHÂN TÍCH & BÁO CÁO").canAccess?.(profile)).toBe(false);
  expect(getRouteByTab("TỔNG QUAN").canAccess?.({ ...profile, permissions: [] })).toBe(false);
});

it("lets superadmin view the selected chapter overview", () => {
  const profile = { ...member, role: "superadmin", permissions: [] } as UserProfile;
  expect(getRouteByTab("TỔNG QUAN").canAccess?.(profile)).toBe(true);
  expect(getRouteByTab("TỔNG QUAN").canAccess?.({ ...profile, companyCode: "" })).toBe(false);
});

it("lets a member open overview from the menu and load meeting statistics without user-management access", async () => {
  const navigate = vi.fn();
  render(<>
    <Sidebar activeTab="TỔNG QUAN" setActiveTab={navigate} mobileOpen={false} onMobileClose={() => {}} />
    <AppRouterView activeTab="TỔNG QUAN" userProfile={member as UserProfile} />
  </>);
  const overviewButton = screen.getByRole("button", { name: "Tổng quan" });
  expect(overviewButton.getAttribute("aria-disabled")).toBe("false");
  fireEvent.click(overviewButton);
  expect(navigate).toHaveBeenCalledWith("TỔNG QUAN");
  expect(await screen.findByRole("heading", { name: "Tổng quan" })).toBeTruthy();
  await waitFor(() => expect(meetingService.listMeetings).toHaveBeenCalledWith({ all: true }));
  expect(await screen.findByText("Buổi họp thành viên")).toBeTruthy();
  expect(authService.getColleagues).toHaveBeenCalled();
  expect(screen.queryByText("Bạn không có quyền truy cập khu vực này.")).toBeNull();
});

it("lets a member with meeting read access open the rankings from the menu", async () => {
  const navigate = vi.fn();
  render(<>
    <Sidebar activeTab="BẢNG XẾP HẠNG" setActiveTab={navigate} mobileOpen={false} onMobileClose={() => {}} />
    <AppRouterView activeTab="BẢNG XẾP HẠNG" userProfile={member as UserProfile} />
  </>);
  const rankingsButton = screen.getByRole("button", { name: "Bảng xếp hạng" });
  expect(rankingsButton.getAttribute("aria-disabled")).toBe("false");
  fireEvent.click(rankingsButton);
  expect(navigate).toHaveBeenCalledWith("BẢNG XẾP HẠNG");
  expect(await screen.findByRole("heading", { name: "Bảng xếp hạng" })).toBeTruthy();
  await waitFor(() => expect(meetingService.listMeetings).toHaveBeenCalledWith({ all: true }));
  expect(authService.getColleagues).toHaveBeenCalled();
  expect(screen.queryByText("Bạn không có quyền truy cập khu vực này.")).toBeNull();
});
