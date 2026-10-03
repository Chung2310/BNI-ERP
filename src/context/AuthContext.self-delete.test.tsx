// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
const deps = vi.hoisted(() => ({ getMe: vi.fn(), deleteOwnAccount: vi.fn(), disconnect: vi.fn() }));
vi.mock("../services/authService", () => ({ authService: { getMe: deps.getMe, deleteOwnAccount: deps.deleteOwnAccount } }));
vi.mock("../services/socketService", () => ({ socketService: { on: vi.fn(() => () => {}), onStatusChange: vi.fn(() => () => {}), disconnect: deps.disconnect } }));
vi.mock("../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
function Probe() {
  const { userProfile, deleteOwnAccount } = useAuth();
  return <><output>{userProfile?.uid || "logged-out"}</output><button onClick={() => { void deleteOwnAccount("password", "XÓA TÀI KHOẢN").catch(() => {}); }}>delete</button></>;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });
it.each([true, false])("clears login state only when account deletion succeeds: %s", async (succeeds) => {
  deps.getMe.mockResolvedValue({ uid: "me", role: "user", companyCode: "BNI" });
  if (succeeds) deps.deleteOwnAccount.mockResolvedValue(undefined);
  else deps.deleteOwnAccount.mockRejectedValue(new Error("Invalid password"));
  localStorage.setItem("accessToken", "token");
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText("me");
  fireEvent.click(screen.getByRole("button", { name: "delete" }));
  await waitFor(() => expect(deps.deleteOwnAccount).toHaveBeenCalled());
  if (succeeds) {
    await screen.findByText("logged-out");
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(deps.disconnect).toHaveBeenCalled();
  } else {
    expect(screen.getByText("me")).toBeTruthy();
    expect(localStorage.getItem("accessToken")).toBe("token");
    expect(deps.disconnect).not.toHaveBeenCalled();
  }
});