// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ updateUser: vi.fn().mockResolvedValue({}), success: vi.fn(), error: vi.fn() }));
vi.mock("../../services/authService", () => ({ authService: { updateUser: mocks.updateUser }, getAccessToken: () => "test-token" }));
vi.mock("../../pages/Toast", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("./MemberMessageButton", () => ({ default: () => null }));
import OrgChartTab from "./OrgChartTab";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("keeps viewing and editing member profile fields after removing ERP fields", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: null }) }));
  const member = { uid: "member-1", displayName: "Nguyễn An", companyCode: "BNI", companyName: "Công ty An", industry: "Công nghệ", role: "user" as const, email: "an@example.test", phone: "0901234567", createdAt: "2026-01-01" };
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<OrgChartTab userProfile={{ uid: "admin-1", role: "admin", companyCode: "BNI" }} selectedCompanyCode="BNI" usersList={[member]} employees={[{ id: member.uid, name: member.displayName, companyName: member.companyName, industry: member.industry, role: "Thành viên", email: member.email, phone: member.phone, avatar: "A", status: "offline" }]} fetchUsers={refresh} isManager companies={[]} courses={[]} fetchCourses={refresh} loading={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Xem hồ sơ Nguyễn An" }));
  fireEvent.click(await screen.findByRole("button", { name: "Chỉnh sửa thông tin" }));
  fireEvent.change(screen.getByDisplayValue("Nguyễn An"), { target: { value: "Nguyễn An mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledOnce());
  expect(mocks.updateUser.mock.calls[0][1]).toMatchObject({ displayName: "Nguyễn An mới", companyName: "Công ty An", industry: "Công nghệ", phone: "0901234567" });
  for (const key of ["jobTitle", "department", "division", "level", "qualification", "isLeader"]) expect(mocks.updateUser.mock.calls[0][1]).not.toHaveProperty(key);
  await waitFor(() => expect(mocks.success).toHaveBeenCalled());
});
