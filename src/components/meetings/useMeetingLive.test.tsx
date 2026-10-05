// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMeetingLive } from "./useMeetingLive";
import { getSlideTimer } from "./slideTimer";
const socket = vi.hoisted(() => ({
  listeners: new Map<string, Set<(data: unknown) => void>>(),
  statuses: new Set<(connected: boolean) => void>(), reconnect: vi.fn(),
}));
vi.mock("../../services/socketService", () => ({ socketService: {
  on: (event: string, callback: (data: unknown) => void) => {
    if (!socket.listeners.has(event)) socket.listeners.set(event, new Set());
    socket.listeners.get(event)!.add(callback);
    return () => socket.listeners.get(event)?.delete(callback);
  },
  onStatusChange: (callback: (connected: boolean) => void) => { socket.statuses.add(callback); callback(true); return () => socket.statuses.delete(callback); },
  reconnect: socket.reconnect,
} }));
let data: any; let online: boolean; let stale: any;
const emit = () => socket.listeners.get("meeting_updated")?.forEach(callback => callback({ id: "meeting" }));
beforeEach(() => {
  online = true; stale = null;
  data = { serverNow: Date.parse("2030-01-01T01:00:10Z"), slides: [],
    meeting: { _id: "meeting", __v: 0, status: "live", currentIndex: 0, speakerStartedAt: "2030-01-01T01:00:00Z", elapsedSeconds: 0,
      presentation: { view: "speaker", autoAdvance: false, autoAdvanceDelay: 3 },
      speakers: [{ id: "first", seconds: 30 }, { id: "second", seconds: 20 }] } };
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    if (!online) throw new Error("offline");
    if (options.method === "GET") return { ok: true, json: async () => JSON.parse(JSON.stringify({ data: stale || data })) };
    const body = JSON.parse(options.body);
    if (body.version !== data.meeting.__v) return { ok: false, status: 409, json: async () => ({ message: "conflict" }) };
    data.meeting.__v++;
    if (body.action === "next") { data.meeting.currentIndex++; data.meeting.speakerStartedAt = new Date(data.serverNow).toISOString(); }
    if (body.action === "pause") { data.meeting.status = "paused"; data.meeting.elapsedSeconds = 10; data.meeting.speakerStartedAt = undefined; }
    if (body.view) data.meeting.presentation.view = body.view;
    emit();
    return { ok: true, json: async () => ({ data: data.meeting }) };
  }));
});
afterEach(() => { cleanup(); socket.listeners.clear(); socket.statuses.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("synchronizes two independent devices and uses server time despite a wrong local clock", async () => {
  const display = renderHook(() => useMeetingLive("meeting", true));
  const phone = renderHook(() => useMeetingLive("meeting", false));
  await waitFor(() => expect(display.result.current.snapshot).toBeTruthy());
  await waitFor(() => expect(phone.result.current.snapshot).toBeTruthy());
  expect(Math.abs(display.result.current.now - data.serverNow)).toBeLessThan(500);
  await act(async () => { await phone.result.current.command("/control", { action: "next" }); });
  await waitFor(() => expect(display.result.current.snapshot?.meeting.currentIndex).toBe(1));
  expect(phone.result.current.snapshot?.meeting.currentIndex).toBe(1);
  expect(Math.abs(display.result.current.now - phone.result.current.now)).toBeLessThan(500);
  await act(async () => { await phone.result.current.command("/control", { action: "pause" }); });
  await waitFor(() => expect(display.result.current.snapshot?.meeting.status).toBe("paused"));
  const screenTimer = getSlideTimer(display.result.current.snapshot!.meeting, "second", display.result.current.now);
  const phoneTimer = getSlideTimer(phone.result.current.snapshot!.meeting, "second", phone.result.current.now);
  expect(screenTimer?.time).toBe(phoneTimer?.time);
  const writes = vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method !== "GET").length;
  await act(async () => { expect(await display.result.current.command("/control", { action: "next" })).toBe(false); });
  expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method !== "GET")).toHaveLength(writes);
});
it("recovers missed updates on reconnect and ignores a stale snapshot", async () => {
  const display = renderHook(() => useMeetingLive("meeting", true));
  await waitFor(() => expect(display.result.current.snapshot).toBeTruthy());
  const original = JSON.parse(JSON.stringify(data));
  online = false;
  await act(async () => { await display.result.current.refresh(); });
  expect(display.result.current.syncError).toBeTruthy();
  data.meeting.__v = 4; data.meeting.presentation.view = "activeMembers";
  online = true;
  act(() => socket.statuses.forEach(callback => callback(true)));
  await waitFor(() => expect(display.result.current.snapshot?.meeting.__v).toBe(4));
  expect(display.result.current.snapshot?.meeting.presentation?.view).toBe("activeMembers");
  expect(display.result.current.syncError).toBe("");
  stale = original;
  await act(async () => { await display.result.current.refresh(); });
  expect(display.result.current.snapshot?.meeting.__v).toBe(4);
});
it("resynchronizes on mobile wake and polls when no socket event arrives", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const display = renderHook(() => useMeetingLive("meeting", true));
  await act(async () => { await display.result.current.refresh(); });
  expect(display.result.current.snapshot).toBeTruthy();
  data.meeting.__v = 1; data.meeting.currentIndex = 1;
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(display.result.current.snapshot?.meeting.currentIndex).toBe(1);
  data.meeting.__v = 2; data.meeting.presentation.view = "waiting";
  await act(async () => { window.dispatchEvent(new Event("pageshow")); await display.result.current.refresh(); });
  expect(display.result.current.snapshot?.meeting.presentation?.view).toBe("waiting");
  expect(socket.reconnect).toHaveBeenCalled();
});
it("does not replay conflicting commands or duplicate a quick double tap", async () => {
  const phone = renderHook(() => useMeetingLive("meeting", false));
  await waitFor(() => expect(phone.result.current.snapshot).toBeTruthy());
  data.meeting.__v = 3;
  await act(async () => {
    await Promise.all([phone.result.current.command("/control", { action: "next" }), phone.result.current.command("/control", { action: "next" })]);
  });
  expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  expect(data.meeting.currentIndex).toBe(0);
  expect(phone.result.current.commandError).toContain("thiết bị khác");
  expect(phone.result.current.snapshot?.meeting.__v).toBe(3);
});
