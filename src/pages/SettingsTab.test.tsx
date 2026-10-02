// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import SettingsTab from "./SettingsTab";
const state = vi.hoisted(() => ({ role: "user", changeTab: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: state.role, displayName: "An" }, uploadAvatar: vi.fn() }) }));
vi.mock("../hooks/useSubTabRouter", () => ({ useSubTabRouter: () => ["erp", state.changeTab] }));
vi.mock("../components/settings/ProfileTab", () => ({ default: () => <div>Nội dung hồ sơ</div> }));
vi.mock("../components/settings/SecurityTab", () => ({ default: () => <div>Nội dung bảo mật</div> }));
vi.mock("../components/settings/ErpConfigTab", () => ({ default: () => <div>Nội dung ERP</div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(["user", "manager"])("hides ERP settings and redirects direct links for %s", async role => {
  state.role = role;
  render(<SettingsTab />);
  expect(await screen.findByText("Nội dung hồ sơ")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cấu hình ERP" })).toBeNull();
  expect(screen.queryByText("Nội dung ERP")).toBeNull();
  await waitFor(() => expect(state.changeTab).toHaveBeenCalledWith("profile"));
});
it("shows ERP configuration to admins", async () => {
  state.role = "admin";
  render(<SettingsTab />);
  expect(await screen.findByText("Nội dung ERP")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cấu hình ERP" })).toBeTruthy();
  expect(state.changeTab).not.toHaveBeenCalled();
});
