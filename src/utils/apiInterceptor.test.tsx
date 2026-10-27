// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MeetingCheckInPage from "../pages/MeetingCheckInPage";

const fetchMock = vi.fn();
const memberPath = "/api/v1/meeting-checkin/test-token/member";
const credentialError = "Tài khoản hoặc mật khẩu không đúng với thành viên của đơn vị tổ chức.";
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  localStorage.clear();
  window.history.replaceState({}, "", "/meeting-checkin/test-token");
  vi.stubGlobal("fetch", fetchMock);
  await import("./apiInterceptor");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["string", "URL", "Request"])("returns QR credential errors without refreshing the session for %s input", async kind => {
  localStorage.setItem("accessToken", "existing-session");
  const rejected = jsonResponse({ message: credentialError }, 401);
  fetchMock.mockResolvedValue(rejected);
  const absoluteUrl = new URL(memberPath, window.location.origin);
  const input = kind === "URL" ? absoluteUrl : kind === "Request" ? new Request(absoluteUrl) : memberPath;

  const response = await window.fetch(input, { method: "POST" });

  expect(response).toBe(rejected);
  expect(await response.json()).toEqual({ message: credentialError });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem("accessToken")).toBe("existing-session");
});

it("still refreshes an expired session and retries a protected API request", async () => {
  const success = jsonResponse({ data: { id: "meeting" } });
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Expired" }, 401))
    .mockResolvedValueOnce(jsonResponse({ accessToken: "new-session" }))
    .mockResolvedValueOnce(success);

  expect(await window.fetch("/api/v1/meetings/meeting")).toBe(success);

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[1]).toEqual(["/api/v1/auth/refresh-token", { method: "POST" }]);
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Authorization")).toBe("Bearer new-session");
  expect(localStorage.getItem("accessToken")).toBe("new-session");
});

it("keeps the QR form after a wrong password and succeeds after the attendee corrects it", async () => {
  const gps = vi.fn(success => success({ coords: { latitude: 10.5, longitude: 106.5 } }));
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: gps } });
  fetchMock.mockResolvedValueOnce(jsonResponse({ data: {
    title: "Buổi họp A", startsAt: "2026-10-10T08:00:00Z", expiresAt: null,
  } }))
    .mockResolvedValueOnce(jsonResponse({ message: credentialError }, 401))
    .mockResolvedValueOnce(jsonResponse({ data: { name: "An" } }));
  render(<MeetingCheckInPage />);
  const identifier = await screen.findByLabelText("Email tài khoản");
  const password = screen.getByLabelText("Mật khẩu");
  fireEvent.change(identifier, { target: { value: "an@example.com" } });
  fireEvent.change(password, { target: { value: "wrong-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));

  expect((await screen.findByRole("alert")).textContent).toBe(credentialError);
  expect((identifier as HTMLInputElement).value).toBe("an@example.com");
  expect((password as HTMLInputElement).value).toBe("wrong-password");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await waitFor(() => expect((screen.getByRole("button", { name: "Check-in" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(password, { target: { value: "correct-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Check-in" }));

  await screen.findByRole("heading", { name: /^Check-in thành công, .+!$/ });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/api/v1/meeting-checkin/test-token", memberPath, memberPath,
  ]);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).password).toBe("correct-password");
  expect(gps).toHaveBeenCalledTimes(2);
});
