// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingCheckInPage from "./MeetingCheckInPage";
import { qrMemberInput, qrGuestInput } from "../../server/modules/meetings/meeting.validation";

const fetchMock = vi.fn();
const gps = vi.fn();
const info = { title: "Buổi họp A", startsAt: "2026-10-10T08:00:00Z", expiresAt: "2099-01-01T00:00:00Z" };
beforeEach(() => {
  window.history.replaceState({}, "", "/meeting-checkin/test-token");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: gps } });
  gps.mockReset().mockImplementation(success => success({ coords: { latitude: 10.5, longitude: 106.5 } }));
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: info }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("member check-in submits only fields accepted by the API and shows a completed state", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { name: "An" } }) });
  render(<MeetingCheckInPage />);
  fireEvent.change(await screen.findByLabelText("Email tài khoản"), { target: { value: "an@example.com" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
  await screen.findByText("Check-in thành công");
  const [url, options] = fetchMock.mock.calls[1];
  const payload = JSON.parse(options.body);
  expect(url).toBe("/api/v1/meeting-checkin/test-token/member");
  expect(qrMemberInput.validate(payload).error).toBeUndefined();
  expect(payload).toEqual({ email: "an@example.com", password: "secret", latitude: 10.5, longitude: 106.5 });
  expect(screen.queryByRole("button", { name: "Check-in" })).toBeNull();
});
it("guest form does not send a password or lose the company field", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { name: "Khách An" } }) });
  render(<MeetingCheckInPage />);
  await screen.findByLabelText("Email tài khoản");
  fireEvent.click(screen.getByRole("button", { name: "Khách mời" }));
  fireEvent.change(screen.getByLabelText("Họ và tên *"), { target: { value: "Khách An" } });
  fireEvent.change(screen.getByLabelText("Công ty"), { target: { value: "Công ty A" } });
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
  await screen.findByText("Check-in thành công");
  const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(qrGuestInput.validate(payload).error).toBeUndefined();
  expect(payload.company).toBe("Công ty A");
  expect(payload).not.toHaveProperty("password");
});
it("GPS denial blocks submission and allows a retry with a fresh location", async () => {
  gps.mockImplementationOnce((_success, failure) => failure({ code: 1 }));
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { name: "An" } }) });
  render(<MeetingCheckInPage />);
  fireEvent.change(await screen.findByLabelText("Email tài khoản"), { target: { value: "an@example.com" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
  await screen.findByRole("alert");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await waitFor(() => expect((screen.getByRole("button", { name: "Check-in" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
  await screen.findByText("Check-in thành công");
  expect(gps).toHaveBeenCalledTimes(2);
});
it("an invalid QR displays the server reason without an unusable form", async () => {
  fetchMock.mockReset().mockResolvedValueOnce({ ok: false, json: async () => ({ message: "Mã QR đã hết hạn." }) });
  render(<MeetingCheckInPage />);
  expect(await screen.findByText("Mã QR đã hết hạn.")).toBeTruthy();
  expect(screen.queryByLabelText("Email tài khoản")).toBeNull();
});

it("previews an optional guest avatar and sends it with the check-in fields", async () => {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:guest-avatar");
    static revokeObjectURL = vi.fn();
  });
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { name: "Khách An" } }) });
  render(<MeetingCheckInPage />);
  await screen.findByLabelText("Email tài khoản");
  fireEvent.click(screen.getByRole("button", { name: "Khách mời" }));
  fireEvent.change(screen.getByLabelText("Họ và tên *"), { target: { value: "Khách An" } });
  const file = new File(["image"], "avatar.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Ảnh đại diện"), { target: { files: [file] } });
  expect(await screen.findByAltText("Xem trước ảnh đại diện")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
  await screen.findByText("Check-in thành công");
  const options = fetchMock.mock.calls[1][1];
  expect(options.body).toBeInstanceOf(FormData);
  expect(options.body.get("avatar")).toBe(file);
  expect(options.body.get("name")).toBe("Khách An");
  expect(options.body.get("latitude")).toBe("10.5");
  expect(options.headers).not.toHaveProperty("Content-Type");
  expect(options.body.has("password")).toBe(false);
});

it("rejects oversized avatar and lets the guest remove a selected image", async () => {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:guest-avatar");
    static revokeObjectURL = vi.fn();
  });
  render(<MeetingCheckInPage />);
  await screen.findByLabelText("Email tài khoản");
  fireEvent.click(screen.getByRole("button", { name: "Khách mời" }));
  const chooser = screen.getByLabelText("Ảnh đại diện");
  fireEvent.change(chooser, { target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })] } });
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByAltText("Xem trước ảnh đại diện")).toBeNull();
  fireEvent.change(chooser, { target: { files: [new File(["image"], "small.png", { type: "image/png" })] } });
  await screen.findByAltText("Xem trước ảnh đại diện");
  fireEvent.click(screen.getByText("Bỏ ảnh"));
  expect(screen.queryByAltText("Xem trước ảnh đại diện")).toBeNull();
});

it("submits industry and phone without email, bio, or cover image, and omits optional text", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { name: "Khách An" } }) });
  render(<MeetingCheckInPage />);
  await screen.findByLabelText("Email tài khoản");
  fireEvent.click(screen.getByRole("button", { name: "Khách mời" }));
  expect(screen.queryByLabelText("Email")).toBeNull();
  expect(screen.queryByLabelText(/Bio/i)).toBeNull();
  expect(screen.queryByLabelText(/Ảnh bìa/i)).toBeNull();
  expect(screen.queryByText(/không bắt buộc/i)).toBeNull();
  expect(screen.queryByText(/tùy chọn/i)).toBeNull();

  fireEvent.change(screen.getByLabelText("Họ và tên *"), { target: { value: "Khách An" } });
  fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901234567" } });
  fireEvent.change(screen.getByLabelText("Lĩnh vực"), { target: { value: " Thiết kế " } });
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
  await screen.findByText("Check-in thành công");
  const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(payload.industry).toBe("Thiết kế");
  expect(payload.phone).toBe("0901234567");
  expect(payload).not.toHaveProperty("email");
  expect(payload).not.toHaveProperty("bio");
  expect(payload).not.toHaveProperty("coverImage");
});


it('accepts a permanent QR and identifies the actual recorded meeting on success', async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...info, expiresAt: null } }) });
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { name: 'An', meetingTitle: 'Cuộc họp đang diễn ra' } }) });
  render(<MeetingCheckInPage />);
  fireEvent.change(await screen.findByLabelText('Email tài khoản'), { target: { value: 'an@example.com' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check-in' }));
  await screen.findByText('Check-in thành công');
  expect(screen.getByText(/cho cuộc họp “Cuộc họp đang diễn ra”/)).toBeTruthy();
  expect(screen.queryByText(/Mã QR đã hết hạn/)).toBeNull();
});

it("member check-in submits phone number identifier and validates with qrMemberInput", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { name: "Bình" } }) });
  render(<MeetingCheckInPage />);
  fireEvent.change(await screen.findByLabelText("Email tài khoản"), { target: { value: "0901234567" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
  await screen.findByText("Check-in thành công");
  const [url, options] = fetchMock.mock.calls[1];
  const payload = JSON.parse(options.body);
  expect(url).toBe("/api/v1/meeting-checkin/test-token/member");
  expect(qrMemberInput.validate(payload).error).toBeUndefined();
  expect(payload.email).toBe("0901234567");
  expect(payload.password).toBe("secret123");
});

