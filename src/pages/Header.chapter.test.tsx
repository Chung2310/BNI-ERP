// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Header from "./Header";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { uid: "admin-1", role: "superadmin", displayName: "Admin" },
    superadminActiveChapter: "BNI",
    setSuperadminActiveChapter: vi.fn(),
  }),
}));
vi.mock("../services/notificationService", () => ({
  notificationService: { getNotifications: vi.fn(async () => ({ data: [], unreadCount: 0 })) },
}));
vi.mock("../services/socketService", () => ({
  socketService: { on: vi.fn(() => vi.fn()) },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows the default BNI chapter as Chapter in the header", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    data: [{ code: "BNI", name: "BNI Chapter" }],
  }), { status: 200 })));

  render(<Header currentTab="TỔNG QUAN" onSearchSelect={vi.fn()} />);

  expect(await screen.findByRole("option", { name: "Chapter" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "BNI Chapter (BNI)" })).toBeNull();
});
