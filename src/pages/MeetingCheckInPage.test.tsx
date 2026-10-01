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
