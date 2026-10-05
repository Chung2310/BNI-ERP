// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MeetingCheckInPanel } from "./MeetingCheckInPanel";
import { CompanyCheckInQrPanel } from "./CompanyCheckInQrPanel";
vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,qr" } }));
const meeting = { _id: "a", title: "Buổi A", status: "live", latitude: 10, longitude: 106, speakers: [] };
const props = { canManage: true, companyCode: "ACME", onConfigure: vi.fn(), onOperate: vi.fn() };
const result = { checkInUrl: "/meeting-checkin/shared-token", expiresAt: null, scope: "company" };
afterEach(() => { cleanup(); sessionStorage.clear(); });

it("loads the same permanent QR across meetings and remounts without browser storage", async () => {
  const api = vi.fn().mockResolvedValue(result);
  const first = render(<MeetingCheckInPanel {...props} api={api} meeting={meeting} />);
  await screen.findByAltText("QR check-in dùng chung");
  const link = screen.getByRole("link", { name: "Mở trang check-in" }).getAttribute("href");
  first.rerender(<MeetingCheckInPanel {...props} api={api} meeting={{ ...meeting, title: "Buổi B", status: "ended" }} />);
  expect(screen.getByRole("link", { name: "Mở trang check-in" }).getAttribute("href")).toBe(link);
  first.unmount();
  sessionStorage.clear();
  render(<MeetingCheckInPanel {...props} api={api} meeting={{ ...meeting, status: "scheduled" }} />);
  await screen.findByAltText("QR check-in dùng chung");
  expect(screen.getByRole("link", { name: "Mở trang check-in" }).getAttribute("href")).toBe(link);
  expect(api.mock.calls).toEqual([["/checkin-qr"], ["/checkin-qr"]]);
  expect(screen.queryByText("Thời hạn QR")).toBeNull();
  expect(screen.queryByRole("button", { name: "Tạo mã thay thế" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Hủy QR" })).toBeNull();
  expect(screen.getByText("Vĩnh viễn · Một mã duy nhất cho mọi cuộc họp")).toBeTruthy();
});

it("provides the company QR without any meeting or GPS configuration", async () => {
  const api = vi.fn().mockResolvedValue(result);
  render(<CompanyCheckInQrPanel api={api} companyCode="ACME" />);
  await screen.findByAltText("QR check-in dùng chung");
  expect(api).toHaveBeenCalledWith("/checkin-qr");
  expect(screen.getByRole("link", { name: "Tải QR" }).getAttribute("download")).toBe("checkin-qr-co-dinh.png");
});

it("retries a failed load without generating a replacement", async () => {
  const api = vi.fn().mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce(result);
  render(<MeetingCheckInPanel {...props} api={api} meeting={meeting} />);
  await screen.findByText("Mất kết nối");
  fireEvent.click(screen.getByText("Tải lại mã QR hiện tại"));
  await screen.findByAltText("QR check-in dùng chung");
  expect(api.mock.calls).toEqual([["/checkin-qr"], ["/checkin-qr"]]);
});

it("does not fetch privileged QR data for a read-only viewer", () => {
  const api = vi.fn();
  render(<MeetingCheckInPanel {...props} canManage={false} api={api} meeting={meeting} />);
  expect(api).not.toHaveBeenCalled();
});

it("discards an old company response after switching company", async () => {
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
