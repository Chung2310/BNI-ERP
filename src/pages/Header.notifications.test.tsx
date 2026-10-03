// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ notifications: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { uid: "member-1", role: "user", displayName: "Member", email: "member@example.test" }, logout: vi.fn() }) }));
vi.mock("../services/notificationService", () => ({ notificationService: { getNotifications: mocks.notifications } }));
vi.mock("../services/socketService", () => ({ socketService: { on: mocks.subscribe } }));
import Header from "./Header";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("keeps notifications working without requesting retired integration status on mount or focus", async () => {
  mocks.notifications.mockResolvedValue({ data: [], unreadCount: 0 });
  mocks.subscribe.mockReturnValue(mocks.unsubscribe);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
  vi.stubGlobal("fetch", fetch);
  const view = render(<Header currentTab="TỔNG QUAN" onSearchSelect={vi.fn()} />);
  await waitFor(() => expect(mocks.notifications).toHaveBeenCalledWith({ limit: 20 }));
  expect(screen.getByRole("banner")).toBeTruthy();
  expect(mocks.subscribe).toHaveBeenCalledWith("new_notification", expect.any(Function));
  fireEvent(window, new Event("focus"));
  fireEvent(document, new Event("visibilitychange"));
  expect(fetch).not.toHaveBeenCalled();
  view.unmount();
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});
