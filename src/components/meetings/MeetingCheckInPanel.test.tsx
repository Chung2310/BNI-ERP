// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MeetingCheckInPanel } from "./MeetingCheckInPanel";
vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,qr" } }));
const expiry = "2099-01-01T00:00:00Z";
const meeting = { _id: "a", title: "Buổi A", status: "live", latitude: 10, longitude: 106, checkInQrExpiresAt: expiry, speakers: [] };
const props = { canManage: true, onRefresh: async () => {}, onConfigure: vi.fn(), onOperate: vi.fn() };
const result = { checkInUrl: "/meeting-checkin/token-a", expiresAt: expiry };
afterEach(() => { cleanup(); sessionStorage.clear(); });

it("restores the same QR without browser storage, including after remount", async () => {
  const api = vi.fn().mockResolvedValue(result);
  const first = render(<MeetingCheckInPanel {...props} api={api} meeting={meeting} />);
  await screen.findByAltText("QR check-in Buổi A");
  expect(screen.getByRole("link", { name: "Mở trang check-in" }).getAttribute("href")).toContain("/meeting-checkin/token-a");
  first.unmount(); sessionStorage.clear();
  render(<MeetingCheckInPanel {...props} api={api} meeting={{ ...meeting, status: "paused" }} />);
  await screen.findByAltText("QR check-in Buổi A");
  expect(api.mock.calls).toEqual([["/a/checkin-qr"], ["/a/checkin-qr"]]);
});

it("hides revoked codes and cannot leak one meeting QR into another", async () => {
  const api = vi.fn(async path => path === "/a/checkin-qr" ? result : null);
  const view = render(<MeetingCheckInPanel {...props} api={api} meeting={meeting} />);
  await screen.findByAltText("QR check-in Buổi A");
  view.rerender(<MeetingCheckInPanel {...props} api={api} meeting={{ ...meeting, checkInQrExpiresAt: undefined }} />);
  expect(screen.queryByAltText("QR check-in Buổi A")).toBeNull();
  view.rerender(<MeetingCheckInPanel {...props} api={api} meeting={{ ...meeting, _id: "b", title: "Buổi B" }} />);
  await waitFor(() => expect(api).toHaveBeenCalledWith("/b/checkin-qr"));
  expect(screen.queryByRole("link", { name: "Mở trang check-in" })).toBeNull();
});

it("migrates an existing cached token without creating a replacement", async () => {
  sessionStorage.setItem("meeting-qr:a", JSON.stringify({ url: "https://example.com/meeting-checkin/old-token", expiresAt: expiry }));
  const api = vi.fn().mockResolvedValueOnce({ legacy: true, expiresAt: expiry }).mockResolvedValueOnce(result);
  render(<MeetingCheckInPanel {...props} api={api} meeting={meeting} />);
  await screen.findByAltText("QR check-in Buổi A");
  expect(api).toHaveBeenNthCalledWith(2, "/a/checkin-qr", "PUT", { token: "old-token" });
});

it("retries a failed restore without rotating the QR", async () => {
  const api = vi.fn().mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce(result);
  render(<MeetingCheckInPanel {...props} api={api} meeting={meeting} />);
  await screen.findByText("Mất kết nối");
  fireEvent.click(screen.getByText("Tải lại mã QR hiện tại"));
  await screen.findByAltText("QR check-in Buổi A");
  expect(api.mock.calls.every(call => call.length === 1)).toBe(true);
});

it("does not fetch privileged QR data for a read-only viewer", () => {
  const api = vi.fn();
  render(<MeetingCheckInPanel {...props} canManage={false} api={api} meeting={meeting} />);
  expect(api).not.toHaveBeenCalled();
});
