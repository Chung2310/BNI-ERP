// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MemberMessageButton from "./MemberMessageButton";
import { tabToPath } from "../../seo/seo-config";
const mocks = vi.hoisted(() => ({ createRoom: vi.fn(), error: vi.fn() }));
vi.mock("../../services/internalChatService", () => ({ internalChatService: { createRoom: mocks.createRoom } }));
vi.mock("../../pages/Toast", () => ({ toast: { error: mocks.error } }));
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, "", "/hr"); });
afterEach(cleanup);
it("opens a private conversation for the selected member and navigates to chat", async () => {
  mocks.createRoom.mockResolvedValue({ _id: "room-a" });
  const close = vi.fn();
  const navigated = vi.fn();
  window.addEventListener("popstate", navigated);
  try {
    render(<MemberMessageButton memberId="member-b" currentUserId="member-a" onOpened={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Nhắn tin" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(mocks.createRoom).toHaveBeenCalledWith({ isGroup: false, memberIds: ["member-b"] });
    expect(window.location.pathname).toBe(tabToPath("TRÒ CHUYỆN"));
    expect(new URL(window.location.href).searchParams.get("room")).toBe("room-a");
    expect(navigated).toHaveBeenCalledOnce();
  } finally { window.removeEventListener("popstate", navigated); }
});
it("keeps the profile open when opening chat fails", async () => {
  mocks.createRoom.mockRejectedValue(new Error("Không có quyền truy cập"));
  const close = vi.fn();
  render(<MemberMessageButton memberId="member-b" currentUserId="member-a" onOpened={close} />);
  fireEvent.click(screen.getByRole("button", { name: "Nhắn tin" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(close).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe("/hr");
  expect((screen.getByRole("button", { name: "Nhắn tin" }) as HTMLButtonElement).disabled).toBe(false);
});
it("does not offer messaging yourself", () => {
  render(<MemberMessageButton memberId="member-a" currentUserId="member-a" onOpened={vi.fn()} />);
  expect(screen.queryByRole("button")).toBeNull();
});
it("prevents repeated clicks while opening the room", () => {
  mocks.createRoom.mockReturnValue(new Promise(() => {}));
  render(<MemberMessageButton memberId="member-b" currentUserId="member-a" onOpened={vi.fn()} />);
  const button = screen.getByRole("button");
  fireEvent.click(button); fireEvent.click(button);
  expect(mocks.createRoom).toHaveBeenCalledOnce();
  expect((button as HTMLButtonElement).disabled).toBe(true);
});
