// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CompanyCheckInQrPanel } from "./CompanyCheckInQrPanel";
import { CompanyCheckInQrDialog } from "./CompanyCheckInQrDialog";

vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,qr" } }));
const api = vi.fn().mockResolvedValue({ checkInUrl: "/meeting-checkin/shared-token" });
let fullscreen: Element | null;
beforeEach(() => {
  fullscreen = null;
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreen });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => {
  cleanup();
  delete (document as any).fullscreenElement;
  delete (document as any).exitFullscreen;
  delete (document.documentElement as any).requestFullscreen;
  vi.clearAllMocks();
});

it("enlarges the same QR above its parent dialog and closes only the enlarged view on Escape", async () => {
  const closeParent = vi.fn();
  render(<CompanyCheckInQrDialog api={api} onClose={closeParent} />);
  const trigger = await screen.findByRole("button", { name: "Phóng to mã QR toàn màn hình" });
  trigger.focus();
  fireEvent.click(trigger);
  const preview = screen.getByRole("dialog", { name: "Mã QR check-in toàn màn hình" });
  expect(within(preview).getByRole("img").getAttribute("src")).toBe(screen.getByAltText("QR check-in dùng chung").getAttribute("src"));
  fireEvent(preview, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog", { name: "Mã QR check-in toàn màn hình" })).toBeNull();
  expect(closeParent).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe("hidden");
});

it("requests browser fullscreen and shrinks when fullscreen is exited", async () => {
  const request = vi.fn(async () => { fullscreen = document.documentElement; });
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: request });
  const exit = vi.fn(async () => { fullscreen = null; });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  render(<React.StrictMode><CompanyCheckInQrPanel api={api} /></React.StrictMode>);
  fireEvent.click(await screen.findByRole("button", { name: "Phóng to mã QR toàn màn hình" }));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  expect(exit).not.toHaveBeenCalled();
  fullscreen = null;
  fireEvent(document, new Event("fullscreenchange"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).toBe("");
});

it("keeps the enlarged QR usable if fullscreen is denied", async () => {
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: vi.fn().mockRejectedValue(new Error("Denied")) });
  render(<CompanyCheckInQrPanel api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Phóng to mã QR toàn màn hình" }));
  const close = await screen.findByRole("button", { name: "Thu nhỏ mã QR" });
  fireEvent.click(close);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByAltText("QR check-in dùng chung")).toBeTruthy();
});

it("exits fullscreen it opened when the shrink button is used", async () => {
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: vi.fn(async () => { fullscreen = document.documentElement; }) });
  const exit = vi.fn(async () => { fullscreen = null; });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  render(<CompanyCheckInQrPanel api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Phóng to mã QR toàn màn hình" }));
  await waitFor(() => expect(fullscreen).toBe(document.documentElement));
  fireEvent.click(screen.getByRole("button", { name: "Thu nhỏ mã QR" }));
  await waitFor(() => expect(exit).toHaveBeenCalledOnce());
});

it("preserves fullscreen already opened by meeting operations", async () => {
  fullscreen = document.documentElement;
  const exit = vi.fn();
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  render(<CompanyCheckInQrPanel api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Phóng to mã QR toàn màn hình" }));
  fireEvent.click(screen.getByRole("button", { name: "Thu nhỏ mã QR" }));
  expect(exit).not.toHaveBeenCalled();
  expect(fullscreen).toBe(document.documentElement);
});
