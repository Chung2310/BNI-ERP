// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeetingCheckInPanel } from "./MeetingCheckInPanel";
import { CompanyCheckInQrPanel } from "./CompanyCheckInQrPanel";

vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,qr" } }));

const meeting = { _id: "a", title: "Buổi A", status: "live", latitude: 10, longitude: 106, speakers: [] };
const result = { checkInUrl: "/meeting-checkin/shared-token", expiresAt: null, scope: "company" };

afterEach(() => { cleanup(); sessionStorage.clear(); });

it("lets an organizer open location configuration for meeting check-in", () => {
  const onConfigure = vi.fn();
  render(<MeetingCheckInPanel meeting={meeting} canManage onConfigure={onConfigure} />);
  expect(screen.getByText(/kiểm tra vị trí trong bán kính/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cấu hình địa điểm & thời gian" }));
  expect(onConfigure).toHaveBeenCalledOnce();
});

it("tells members to check in at the meeting location", () => {
  render(<MeetingCheckInPanel meeting={meeting} canManage={false} onConfigure={vi.fn()} />);
  expect(screen.getByText(/Điểm danh tại địa điểm họp/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cấu hình địa điểm & thời gian" })).toBeNull();
});

it("loads the same permanent company QR after remount without browser storage", async () => {
  const api = vi.fn().mockResolvedValue(result);
  const first = render(<CompanyCheckInQrPanel api={api} companyCode="ACME" />);
  await screen.findByAltText("QR check-in dùng chung");
  const link = screen.getByRole("link", { name: "Mở trang check-in" }).getAttribute("href");
  first.unmount();
  sessionStorage.clear();
  render(<CompanyCheckInQrPanel api={api} companyCode="ACME" />);
  await screen.findByAltText("QR check-in dùng chung");
  expect(screen.getByRole("link", { name: "Mở trang check-in" }).getAttribute("href")).toBe(link);
  expect(api.mock.calls).toEqual([["/checkin-qr"], ["/checkin-qr"]]);
  expect(screen.queryByText("Thời hạn QR")).toBeNull();
  expect(screen.queryByRole("button", { name: "Tạo mã thay thế" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Hủy QR" })).toBeNull();
  expect(screen.getByText("Sử dụng Zalo để quét mã")).toBeTruthy();
});

it("retries a failed company QR load without generating a replacement", async () => {
  const api = vi.fn().mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce(result);
  render(<CompanyCheckInQrPanel api={api} companyCode="ACME" />);
  await screen.findByText("Mất kết nối");
  fireEvent.click(screen.getByText("Tải lại mã QR hiện tại"));
  await screen.findByAltText("QR check-in dùng chung");
  expect(api.mock.calls).toEqual([["/checkin-qr"], ["/checkin-qr"]]);
});

it("discards an old company QR response after switching companies", async () => {
  let resolveOld!: (value: typeof result) => void;
  const api = vi.fn()
    .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ ...result, checkInUrl: "/meeting-checkin/other-company" });
  const view = render(<CompanyCheckInQrPanel api={api} companyCode="ACME" />);
  view.rerender(<CompanyCheckInQrPanel api={api} companyCode="OTHER" />);
  await screen.findByAltText("QR check-in dùng chung");
  resolveOld(result);
  await waitFor(() => expect(screen.getByRole("link", { name: "Mở trang check-in" }).getAttribute("href")).toContain("/other-company"));
});
