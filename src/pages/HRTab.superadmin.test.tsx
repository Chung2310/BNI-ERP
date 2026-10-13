// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import HRTab from "./HRTab";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { uid: "system", role: "superadmin", companyCode: "BNI", displayName: "System" },
    hasPermission: (code: string) => code.endsWith(":read"),
  }),
}));
vi.mock("../services/authService", () => ({ authService: { getUsersByCompany: vi.fn().mockResolvedValue([]) } }));
vi.mock("../components/hr/OrgChartTab", () => ({ default: () => <p>Danh sách chapter</p> }));
vi.mock("../components/hr/MemberFeesTab", () => ({ default: () => <p>Phiếu thu riêng</p> }));
vi.mock("../components/hr/CelebrationEmailTab", () => ({ default: () => <p>Email riêng</p> }));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

it.each(["phi-thuong-nien", "email-chuc-mung"])("shows only members for a superadmin opening %s directly", async slug => {
  window.history.replaceState(null, "", `/thanh-vien?sub=${slug}`);
  render(<HRTab />);
  expect(await screen.findByText("Danh sách chapter")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Phí thường niên" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Email chúc mừng" })).toBeNull();
  expect(screen.queryByText("Phiếu thu riêng")).toBeNull();
  expect(screen.queryByText("Email riêng")).toBeNull();
  await waitFor(() => expect(window.location.search).toBe("?sub=thanh-vien"));
});
