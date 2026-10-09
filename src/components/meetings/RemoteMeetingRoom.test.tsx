// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RemoteMeetingRoom from "./RemoteMeetingRoom";
const mocks = vi.hoisted(() => ({ manage: true }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ hasPermission: () => mocks.manage }) }));
vi.mock("../../services/socketService", () => ({ socketService: { on: () => () => {}, onStatusChange: (cb: (value: boolean) => void) => { cb(true); return () => {}; }, reconnect: () => {} } }));
vi.mock("./MeetingStage", () => ({
  MeetingStage: ({ snapshot }: { snapshot: import('../../services/meetingLiveService').MeetingLiveSnapshot }) => <div>Đang chiếu: {snapshot.meeting.presentation.view}</div>,
  SpeakerStage: ({ slide }: { slide: import('../../services/meetingLiveService').MeetingLiveSnapshot['slides'][number] }) => <div>Xem trước: {slide?.name}</div>,
}));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") } }));
let snapshot: import('../../services/meetingLiveService').MeetingLiveSnapshot;
beforeEach(() => {
  mocks.manage = true;
  snapshot = { serverNow: Date.now(), slides: [{ id: "a", name: "An" }, { id: "b", name: "Binh" }],
    meeting: { _id: "m", title: "Meeting", status: "live", __v: 0, currentIndex: 0, elapsedSeconds: 0,
      presentation: { view: "speaker", autoAdvance: false, autoAdvanceDelay: 3 },
      speakers: [{ id: "a", name: "An", seconds: 30 }, { id: "b", name: "Binh", seconds: 20 }], luckyDraw: { prizes: [] } } } as unknown as import("../../services/meetingLiveService").MeetingLiveSnapshot;
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (String(url).endsWith("/lucky-draw/prizes") && options.method === "POST") {
      const body = JSON.parse(options.body);
      const prize = { id: "quick-prize", reward: "", winners: [], ...body };
      snapshot.meeting.luckyDraw = {
        enabled: true, allowRepeatWinners: false, drawMode: "attendees", numberMin: 1, numberMax: 100,
        prizes: [...(snapshot.meeting.luckyDraw?.prizes || []), prize],
      };
      return { ok: true, json: async () => ({ data: snapshot.meeting.luckyDraw }) };
    }
    if (String(url).endsWith("/presentation-display/heartbeat")) {
      return { ok: true, json: async () => ({ data: { isOpen: true } }) };
    }
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
it("offers immediate automatic advancement without a delay setting", async () => {
  render(<RemoteMeetingRoom meetingId="m" mode="control" />);
  await screen.findByText("Đang chiếu: speaker");
  expect(screen.queryByText(/Thời gian chờ chuyển lượt/)).toBeNull();
  expect(screen.getByText(/chuyển ngay sang người tiếp theo/)).toBeTruthy();
});
it("selects the next available prize automatically so the organizer can start with one tap", async () => {
  snapshot.meeting.luckyDraw = {
    enabled: true, allowRepeatWinners: false, drawMode: "attendees", numberMin: 1, numberMax: 100,
    prizes: [{ id: "prize-1", name: "Quà đầu tiên", reward: "Gift", quantity: 1, order: 0, winners: [] }],
  };
  render(<RemoteMeetingRoom meetingId="m" mode="control" />);
  await screen.findByText("Đang chiếu: speaker");
  const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
  await waitFor(() => expect(selects[1].value).toBe("prize-1"));
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu quay" }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/presentation-draw"))).toBe(true));
  const drawCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/presentation-draw"));
  expect(JSON.parse(String(drawCall?.[1]?.body)).prizeId).toBe("prize-1");
});
it("shows draw and game winners on the control panel without duplicate results", async () => {
  const drawWinner = {
    id: "draw-1", prizeId: "prize-1", prizeName: "Giải nhất", winnerId: "a",
    name: "An", wonAt: "2030-01-02T02:00:00Z", ticketNumber: 7,
  };
  snapshot.meeting.luckyDraw = {
    enabled: true, allowRepeatWinners: false, drawMode: "attendees", numberMin: 1, numberMax: 100,
    prizes: [{ id: "prize-1", name: "Giải nhất", reward: "", quantity: 1, order: 0, winners: [drawWinner] }],
  };
  snapshot.meeting.gameWinners = [
    drawWinner,
    { id: "bingo-1", prizeId: "bingo-1", prizeName: "Lồng cầu bingo", winnerId: "b", name: "Bình", wonAt: "2030-01-02T03:00:00Z" },
  ];

  render(<RemoteMeetingRoom meetingId="m" mode="control" />);
  const list = await screen.findByRole("list", { name: "Danh sách người trúng thưởng" });
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain("Bình");
  expect(rows[1].textContent).toContain("An");
  expect(rows[1].textContent).toContain("Giải nhất · Số #7");
  expect(screen.getByText("Danh sách người trúng thưởng (2)")).toBeTruthy();
});
it("creates and selects a quick prize from the control panel", async () => {
  snapshot.meeting.luckyDraw = {
    enabled: true, allowRepeatWinners: false, drawMode: "attendees", numberMin: 1, numberMax: 100, prizes: [],
  };
  render(<RemoteMeetingRoom meetingId="m" mode="control" />);
  await screen.findByText("Đang chiếu: speaker");
  fireEvent.click(screen.getByRole("button", { name: "Tạo giải nhanh" }));
  fireEvent.change(screen.getByDisplayValue("Giải thưởng may mắn"), { target: { value: "Giải khách mời" } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo và chọn giải này" }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/lucky-draw/prizes"))).toBe(true));
  const prizeSelect = screen.getByRole("combobox", { name: "Giải thưởng" }) as HTMLSelectElement;
  await waitFor(() => expect(prizeSelect.value).toBe("quick-prize"));
  expect(screen.getByRole("option", { name: /Giải khách mời/ })).toBeTruthy();
  await waitFor(() => expect((screen.getByRole("button", { name: "Bắt đầu quay" }) as HTMLButtonElement).disabled).toBe(false));
});
it("opens the display without starting a timer and shares the same meeting with the phone", async () => {
  render(<RemoteMeetingRoom meetingId="m" mode="display" />);
  await screen.findByText("Đang chiếu: speaker");
  expect(screen.queryByRole("button", { name: "Người tiếp theo" })).toBeNull();
  expect(vi.mocked(fetch).mock.calls.some(([url, options]) => String(url).endsWith("/presentation-display/heartbeat") && options?.method === "POST")).toBe(true);
  expect(vi.mocked(fetch).mock.calls.every(([url, options]) => options?.method === "GET" || (String(url).endsWith("/presentation-display/heartbeat") && options?.method === "POST"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Mở bảng điều khiển cuộc họp" }));
  await screen.findByAltText("QR mở bảng điều khiển");
  expect(screen.getByRole("link", { name: "Mở bảng điều khiển" }).getAttribute("href")).toContain("meeting=m&mode=control");
});
it("removes the display header in fullscreen so it cannot cover the next speakers", async () => {
  let fullscreenElement: Element | null = null;
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: function () {
    // The browser binds requestFullscreen to the element entering fullscreen.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    fullscreenElement = this;
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  } });
  try {
    render(<RemoteMeetingRoom meetingId="m" mode="display" />);
    await screen.findByText("Đang chiếu: speaker");
    fireEvent.click(screen.getByRole("button", { name: "Toàn màn hình" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Màn hình trình chiếu" })).toBeNull());
    expect(screen.queryByRole("button", { name: "Mở bảng điều khiển cuộc họp" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Về cuộc họp" })).toBeNull();
    expect(screen.getByRole("main").style.height).toBe("100dvh");
  } finally {
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
  }
});
it("blocks viewers without organizer permission before requesting a snapshot", () => {
  mocks.manage = false;
  render(<RemoteMeetingRoom meetingId="m" mode="control" />);
  expect(screen.getByRole("alert").textContent).toContain("quyền điều hành");
  expect(fetch).not.toHaveBeenCalled();
});
