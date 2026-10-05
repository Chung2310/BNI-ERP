// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RemoteMeetingRoom from "./RemoteMeetingRoom";
const mocks = vi.hoisted(() => ({ manage: true }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ hasPermission: () => mocks.manage }) }));
vi.mock("../../services/socketService", () => ({ socketService: { on: () => () => {}, onStatusChange: (cb: (value: boolean) => void) => { cb(true); return () => {}; }, reconnect: () => {} } }));
vi.mock("./MeetingStage", () => ({
  MeetingStage: ({ snapshot }: any) => <div>Đang chiếu: {snapshot.meeting.presentation.view}</div>,
  SpeakerStage: ({ slide }: any) => <div>Xem trước: {slide?.name}</div>,
}));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") } }));
let snapshot: any;
beforeEach(() => {
  mocks.manage = true;
  snapshot = { serverNow: Date.now(), slides: [{ id: "a", name: "An" }, { id: "b", name: "Binh" }],
    meeting: { _id: "m", title: "Meeting", status: "live", __v: 0, currentIndex: 0, elapsedSeconds: 0,
      presentation: { view: "speaker", autoAdvance: false, autoAdvanceDelay: 3 },
      speakers: [{ id: "a", name: "An", seconds: 30 }, { id: "b", name: "Binh", seconds: 20 }], luckyDraw: { prizes: [] } } };
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (options.method !== "GET") {
      const body = JSON.parse(options.body);
      snapshot.meeting.__v++;
      if (String(url).endsWith("/presentation")) snapshot.meeting.currentIndex = 1;
      if (body.view) snapshot.meeting.presentation.view = body.view;
    }
    return { ok: true, json: async () => JSON.parse(JSON.stringify({ data: options.method === "GET" ? snapshot : snapshot.meeting })) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("previews a selection locally and publishes only after an explicit start", async () => {
  render(<RemoteMeetingRoom meetingId="m" mode="control" />);
  await screen.findByText("Đang chiếu: speaker");
  fireEvent.change(screen.getByLabelText("Người phát biểu"), { target: { value: "b" } });
  expect(screen.getByText("Xem trước: Binh")).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu & chiếu" }));
  await waitFor(() => expect(snapshot.meeting.currentIndex).toBe(1));
  expect(vi.mocked(fetch).mock.calls.some(([url, options]) => String(url).endsWith("/presentation") && JSON.parse(String(options?.body)).speakerId === "b")).toBe(true);
});
it("publishes view selection and keeps the phone outside fullscreen", async () => {
  const full = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: full });
  render(<RemoteMeetingRoom meetingId="m" mode="control" />);
  await screen.findByText("Đang chiếu: speaker");
  fireEvent.click(screen.getByRole("button", { name: "Xếp hạng" }));
  await screen.findByText("Đang chiếu: activeMembers");
  expect(full).not.toHaveBeenCalled();
  Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
});
it("opens the display without starting a timer and shares the same meeting with the phone", async () => {
  render(<RemoteMeetingRoom meetingId="m" mode="display" />);
  await screen.findByText("Đang chiếu: speaker");
  expect(screen.queryByRole("button", { name: "Người tiếp theo" })).toBeNull();
  expect(vi.mocked(fetch).mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Điều khiển từ điện thoại" }));
  await screen.findByAltText("QR mở bảng điều khiển");
  expect(screen.getByRole("link", { name: "Mở bảng điều khiển" }).getAttribute("href")).toContain("meeting=m&mode=control");
});
it("blocks viewers without organizer permission before requesting a snapshot", () => {
  mocks.manage = false;
  render(<RemoteMeetingRoom meetingId="m" mode="control" />);
  expect(screen.getByRole("alert").textContent).toContain("quyền điều hành");
  expect(fetch).not.toHaveBeenCalled();
});
