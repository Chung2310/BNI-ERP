// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import MeetingTab from "./MeetingTab";
vi.mock("../components/meetings/profileSlideRenderer", () => ({
  SLIDE_WIDTH: 1920, SLIDE_HEIGHT: 1080, loadSlideImage: vi.fn().mockResolvedValue(null),
  renderProfileSlide: vi.fn(async () => ({ canvas: document.createElement("canvas"), warnings: [] })),
}));
const auth = vi.hoisted(() => ({ manage: true }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ hasPermission: () => auth.manage, userProfile: { uid: "member1" } }) }));
vi.mock("../services/socketService", () => ({ socketService: { on: () => () => {} } }));
vi.mock("../components/meetings/LuckyDrawTab", () => ({ LuckyDrawTab: () => <div>Quay thưởng đang mở</div> }));
vi.mock("./Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const meeting = { _id: "a", title: "Buổi họp A", startsAt: "2026-10-10T08:00:00Z", status: "scheduled", speakers: [], tiers: [{count:10,seconds:30}], fallbackSeconds:20, reminderDays:0, currentIndex:-1, elapsedSeconds:0, __v:0 };
beforeEach(() => {
  auth.manage = true;
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: vi.fn((success) => success({ coords: { latitude: 10, longitude: 106 } })) } });
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok:true, json:async () => ({data:[meeting]}) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps paused meetings ongoing and advances meeting duration while the speaker timer stays paused", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  const origin = Date.now();
  vi.setSystemTime(origin);
  const item = { ...meeting, status: "paused", startsAt: new Date(origin - 96 * 60000).toISOString(),
    currentIndex: 0, elapsedSeconds: 11,
    speakers: [{ id: "guest", kind: "guest", name: "Khách đang nói", seconds: 30 }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [item] }) }));
  try {
    render(<MeetingTab />);
    await screen.findByText("Đang diễn ra 96 phút");
    expect(screen.queryByText(/Tạm dừng •/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục điều hành" }));
    expect(screen.getAllByText("Đang diễn ra 96 phút")).toHaveLength(2);
    expect(screen.queryByText("Đang tạm dừng")).toBeNull();
    expect(screen.getByText("00:19")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(screen.getAllByText("Đang diễn ra 97 phút")).toHaveLength(2);
    expect(screen.getByText("00:19")).toBeTruthy();
  } finally { vi.useRealTimers(); }
});

it("uses avatars instead of covers for current, upcoming and listed attendees", async () => {
  const people = [
    { id: "a", name: "An", seconds: 30, photoURL: "https://example.com/avatar-a.png", coverImage: "https://example.com/cover-a.png" },
    { id: "b", name: "Bình", seconds: 30, photoURL: "https://example.com/avatar-b.png", coverImage: "https://example.com/cover-b.png" },
    { id: "c", name: "Chi", seconds: 30, photoURL: "", coverImage: "https://example.com/cover-c.png" },
  ];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ ...meeting, status: "live", currentIndex: 0, speakers: people }] }) }));
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
  expect(screen.getAllByAltText("An")).toHaveLength(2);
  expect(screen.getAllByAltText("Bình")).toHaveLength(2);
  for (const img of screen.getAllByAltText("An")) expect(img.getAttribute("src")).toBe(people[0].photoURL);
  for (const img of screen.getAllByAltText("Bình")) expect(img.getAttribute("src")).toBe(people[1].photoURL);
  expect(screen.queryByAltText("Chi")).toBeNull();
  expect(screen.getByText("C")).toBeTruthy();
});

it("checks multiple people in operations and submits their IDs in one request", async () => {
  const people = [{ id: "a", name: "An", seconds: 30 }, { id: "b", name: "Bình", seconds: 30 }, { id: "c", name: "Chi", seconds: 30 }];
  let item = { ...meeting, status: "live", currentIndex: 0, speakers: people };
  const fetchMock = vi.fn(async (url, options) => {
    if (String(url).endsWith("/defer")) {
      expect(JSON.parse(options.body)).toEqual({ speakerIds: ["a", "b"], version: 0 });
      item = { ...item, __v: 1, speakers: [people[2], people[0], people[1]] };
      return { ok: true, json: async () => ({ data: item }) };
    }
    return { ok: true, json: async () => ({ data: [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
  fireEvent.click(screen.getByLabelText("Chọn An"));
  fireEvent.click(screen.getByLabelText("Chọn Bình"));
  expect((screen.getByLabelText("Chọn An") as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText("Chọn Bình") as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Chuyển xuống cuối lượt" }));
  await waitFor(() => expect((screen.getByLabelText("Chọn An") as HTMLInputElement).checked).toBe(false));
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/defer"))).toHaveLength(1);
  expect(item.speakers.map(person => person.id)).toEqual(["c", "a", "b"]);
});

it("defers from the operation list and starts fullscreen from the selected attendee", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn() } as any);
  const people = [
    { id: "first", kind: "member", name: "An đang bận", company: "", seconds: 60, deferred: false },
    { id: "second", kind: "guest", name: "Bình khách mời", company: "", seconds: 30, deferred: false },
    { id: "third", kind: "guest", name: "Chi khách mời", company: "", seconds: 30, deferred: false },
  ];
  let item = { ...meeting, status: "live", currentIndex: 0, speakers: people };
  const fetchMock = vi.fn(async (url, options) => {
    if (String(url).endsWith("/defer")) {
      expect(JSON.parse(options.body)).toEqual({ speakerId: "first", version: 0 });
      item = { ...item, __v: 1, speakers: [people[1], people[2], { ...people[0], deferred: true }] };
      return { ok: true, json: async () => ({ data: item }) };
    }
    if (String(url).endsWith("/presentation")) {
      expect(JSON.parse(options.body)).toEqual({ speakerId: "third", version: 1 });
      item = { ...item, __v: 2, currentIndex: 1 };
      return { ok: true, json: async () => ({ data: item }) };
    }
    return { ok: true, json: async () => ({ data: String(url).endsWith("/slides") ? { slides: item.speakers, version: item.__v } : [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    render(<MeetingTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
    fireEvent.click(screen.getByRole("button", { name: "Để cuối lượt: An đang bận" }));
    await waitFor(() => expect(item.__v).toBe(1));
    await waitFor(() => expect((screen.getByLabelText("Bắt đầu từ Chi khách mời") as HTMLInputElement).disabled).toBe(false));
    await waitFor(() => expect((screen.getByRole("button", { name: "Để cuối lượt: An đang bận" }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(screen.getByLabelText("Bắt đầu từ Chi khách mời"));
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/presentation"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
    await screen.findByRole("dialog", { name: "Trình chiếu hồ sơ" });
    await waitFor(() => expect(screen.getAllByRole("img").filter(element => element.tagName === "CANVAS").some(element => element.getAttribute("aria-label")?.includes("Chi khách mời"))).toBe(true));
    expect(item.currentIndex).toBe(1);
    expect(item.speakers[2].id).toBe("first");
  } finally { cleanup(); await act(async () => {}); vi.restoreAllMocks(); }
});

it.each(["Escape", "fullscreen"])("returns to the slides presentation tab after exiting presentation via %s", async exit => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn() } as any);
  const people = [{ id: "first", kind: "guest", name: "Khách đang nói", company: "", seconds: 30 }];
  const live = { ...meeting, status: "live", currentIndex: 0, speakers: people };
  const fetchMock = vi.fn(async url => ({ ok: true, json: async () => ({ data: String(url).endsWith("/slides") ? { slides: people, version: 0 } : String(url).endsWith("/presentation") ? live : [live] }) }));
  vi.stubGlobal("fetch", fetchMock);
  let fullscreen: Element | null = null;
  const requestFullscreen = vi.fn(async () => { fullscreen = document.documentElement; });
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreen });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: vi.fn(async () => { fullscreen = null; }) });
  try {
    render(<MeetingTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
    await screen.findByRole("dialog", { name: "Trình chiếu hồ sơ" });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/presentation"))).toBe(true));
    if (exit === "Escape") fireEvent.keyDown(document, { key: "Escape" });
    else { fullscreen = null; fireEvent(document, new Event("fullscreenchange")); }
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Trình chiếu hồ sơ" })).toBeNull());
    expect(screen.getByRole("button", { name: "Bắt đầu thuyết trình" })).toBeTruthy();
    expect(screen.getByTitle("Đóng popup")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/control"))).toBe(false);
  } finally {
    cleanup();
    await act(async () => {});
    delete (document.documentElement as any).requestFullscreen;
    delete (document as any).fullscreenElement;
    delete (document as any).exitFullscreen;
    vi.restoreAllMocks();
  }
});

it("shares manual navigation and operating mode between slides and MC controls", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn() } as any);
  const people = [
    { id: "first", kind: "member", name: "Người đầu", company: "", seconds: 30 },
    { id: "second", kind: "guest", name: "Người tiếp", company: "", seconds: 30 },
  ];
  let item = { ...meeting, status: "live", currentIndex: 0, speakers: people, speakerStartedAt: new Date().toISOString() };
  const fetchMock = vi.fn(async (url, options) => {
    if (String(url).endsWith("/control")) {
      const body = JSON.parse(options.body);
      expect(body.version).toBe(item.__v);
      item = { ...item, currentIndex: item.currentIndex + (body.action === "next" ? 1 : -1), __v: item.__v + 1, speakerStartedAt: new Date().toISOString() };
      return { ok: true, json: async () => ({ data: item }) };
    }
    return { ok: true, json: async () => ({ data: String(url).endsWith("/slides") ? { slides: people, version: item.__v } : [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
  fireEvent.click(screen.getByRole("button", { name: "Thuyết trình" }));
  await screen.findByText("Người đầu");
  await waitFor(() => expect((screen.getByRole("button", { name: "Slide tiếp" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Slide tiếp" }));
  await waitFor(() => expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Người tiếp"));
  expect(item.currentIndex).toBe(1);
  fireEvent.change(screen.getByLabelText("Chế độ trình chiếu"), { target: { value: "auto" } });
  fireEvent.click(screen.getByRole("button", { name: "Điều hành" }));
  expect((screen.getByLabelText("Chế độ điều hành") as HTMLSelectElement).value).toBe("auto");
  fireEvent.change(screen.getByLabelText("Chế độ điều hành"), { target: { value: "manual" } });
  fireEvent.click(screen.getByRole("button", { name: "Thuyết trình" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Slide trước" }) as HTMLButtonElement).disabled).toBe(false));
  expect((screen.getByLabelText("Chế độ trình chiếu") as HTMLSelectElement).value).toBe("manual");
  fireEvent.click(screen.getByRole("button", { name: "Slide trước" }));
  await waitFor(() => expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Người đầu"));
  expect(item.currentIndex).toBe(0);
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/control")).map(([, options]) => JSON.parse(options.body).action)).toEqual(["next", "previous"]);
  vi.restoreAllMocks();
});
it("opens check-in for a scheduled meeting and keeps QR separate from MC controls", async () => {
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", {name:"Mở buổi họp & check-in"}));
  expect(screen.getByText("Đón tiếp & check-in")).toBeTruthy();
  expect(screen.queryByText("Diễn giả hiện tại")).toBeNull();
  expect(screen.queryByText("Quay thưởng đang mở")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Sang điều hành →"}));
  expect(screen.getByText("Diễn giả hiện tại")).toBeTruthy();
  expect(screen.queryByText("Mở QR khi bắt đầu đón khách")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Quay thưởng"}));
  expect(screen.getByText("Quay thưởng đang mở")).toBeTruthy();
});
it("preserves zero-day reminders when editing a meeting", async () => {
  render(<MeetingTab />);
  fireEvent.click((await screen.findAllByTitle("Sửa cuộc họp"))[0]);
  const values = screen.getAllByRole("spinbutton").map(element => (element as HTMLInputElement).value);
  expect(values).toContain("0");
});

it("disables end meeting button when scheduled and allows ending when live with confirmation popup", async () => {
  const liveMeeting = { ...meeting, _id: "b", title: "Buổi họp Live", status: "live" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [liveMeeting] }) }));
  render(<MeetingTab />);
  const endButtons = await screen.findAllByRole("button", { name: "Kết thúc" });
  expect(endButtons.length).toBeGreaterThan(0);
  fireEvent.click(endButtons[0]);
  expect(screen.getByText("Kết thúc buổi họp?")).toBeTruthy();
  expect(screen.getByText(/Bạn có chắc chắn muốn kết thúc buổi họp "Buổi họp Live"\?/)).toBeTruthy();
});

it("allows starting scheduled meeting with confirmation popup", async () => {
  render(<MeetingTab />);
  const startButtons = await screen.findAllByRole("button", { name: "Bắt đầu" });
  expect(startButtons.length).toBeGreaterThan(0);
  fireEvent.click(startButtons[0]);
  expect(screen.getByText("Bắt đầu cuộc họp?")).toBeTruthy();
  expect(screen.getByText(/Cuộc họp "Buổi họp A" hiện chưa có người check-in/)).toBeTruthy();
});



it("inserting priority one shifts the existing waiting speaker down", async () => {
  const live = { ...meeting, status: "live", currentIndex: 0, speakerStartedAt: new Date().toISOString(),
    speakers: [
      { id: "a", name: "Đang nói", seconds: 60 },
      { id: "b", name: "Người chờ", seconds: 30 },
      { id: "c", name: "Chủ tịch", seconds: 20 },
    ] };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [live] }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
  expect(screen.queryByLabelText("Chọn người để sắp xếp")).toBeNull();
  expect(screen.queryByLabelText("Thứ tự ưu tiên")).toBeNull();
  fireEvent.click(screen.getAllByTitle("Sửa cuộc họp").at(-1)!);
  fireEvent.change(screen.getByLabelText("Chọn người để sắp xếp"), { target: { value: "c" } });
  fireEvent.change(screen.getByLabelText("Thứ tự ưu tiên"), { target: { value: "1" } });
  fireEvent.click(screen.getByText("Áp dụng thứ tự"));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/meetings/a/order", expect.objectContaining({
    method: "PUT", body: JSON.stringify({ version: 0, speakerIds: ["a", "c", "b"] }),
  })));
  expect(screen.queryByTitle("Đưa lên trên")).toBeNull();
});

it("manual overtime stops at zero; completing the last speaker opens BNI notice without ending meeting", async () => {
  let item = { ...meeting, status: "live", currentIndex: 0, elapsedSeconds: 35, speakerStartedAt: undefined,
    speakers: [{ id: "a", name: "An", seconds: 30 }], speechesCompletedAt: undefined as string | undefined };
  const fetchMock = vi.fn(async (_url, options) => {
    if (options?.method === "POST") item = { ...item, currentIndex: 1, elapsedSeconds: 0, speechesCompletedAt: new Date().toISOString() };
    return { ok: true, json: async () => ({ data: options?.method === "POST" ? item : [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
  expect(screen.getByText("Hết giờ")).toBeTruthy();
  expect(screen.queryByText("00:00")).toBeNull();
  expect(screen.queryByText("+00:05")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tất phát biểu" }));
  expect(await screen.findByRole("dialog", { name: "Hoàn tất phần phát biểu" })).toBeTruthy();
  expect(screen.getByAltText("BNI").getAttribute("src")).toBe("/bni-logo.png");
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục cuộc họp" }));
  expect(screen.queryByRole("dialog", { name: "Hoàn tất phần phát biểu" })).toBeNull();
  const actions = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(options.body).action);
  expect(actions).toEqual(["next"]);
  expect(item.status).toBe("live");
});

it("automatic mode completes the final speaker instead of ending the meeting", async () => {
  localStorage.setItem("bni_auto_advance_speaker", "true");
  localStorage.setItem("bni_auto_advance_delay", "0");
  let item = { ...meeting, status: "live", currentIndex: 0, speakerStartedAt: new Date(Date.now() - 60000).toISOString(),
    speakers: [{ id: "a", name: "An", seconds: 30 }], speechesCompletedAt: undefined as string | undefined };
  const fetchMock = vi.fn(async (_url, options) => {
    if (options?.method === "POST") item = { ...item, currentIndex: 1, speakerStartedAt: undefined, speechesCompletedAt: new Date().toISOString() };
    return { ok: true, json: async () => ({ data: options?.method === "POST" ? item : [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
  await screen.findByRole("dialog", { name: "Hoàn tất phần phát biểu" });
  expect(item.status).toBe("live");
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST" && JSON.parse(options.body).action === "finish")).toBe(false);
});


it("launches the current profile from MC controls and explains the post-speech delay", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn() } as any);
  localStorage.setItem("bni_auto_advance_speaker", "true");
  localStorage.setItem("bni_auto_advance_delay", "3");
  const people = [
    { id: "first", kind: "member", name: "Người đầu tiên", company: "", seconds: 30 },
    { id: "second", kind: "guest", name: "Khách thứ hai", company: "", seconds: 30 },
  ];
  const live = { ...meeting, status: "live", currentIndex: 1, speakers: people };
  const fetchMock = vi.fn(async (url) => ({ ok: true, json: async () => ({ data: String(url).endsWith("/slides") ? { slides: people, version: 0 } : String(url).endsWith("/presentation") ? { ...live, speakerStartedAt: new Date().toISOString(), __v: 1 } : [live] }) }));
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
  expect(screen.getByText(/Đây là thời gian chờ chuyển lượt/)).toBeTruthy();
  expect((screen.getByLabelText("Số giây chờ chuyển slide sau khi hết giờ") as HTMLInputElement).value).toBe("3");
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  expect(requestFullscreen).toHaveBeenCalledTimes(1);
  await screen.findByRole("dialog", { name: "Trình chiếu hồ sơ" });
  await waitFor(() => {
    const canvases = screen.getAllByRole("img").filter(element => element.tagName === "CANVAS");
    expect(canvases.length).toBeGreaterThan(0);
    expect(canvases.every(element => element.getAttribute("aria-label")?.includes("Khách thứ hai"))).toBe(true);
  });
  delete (document.documentElement as any).requestFullscreen;
  expect(fetchMock.mock.calls.every(([url]) => !String(url).endsWith("/control"))).toBe(true);
  vi.restoreAllMocks();
});


it("reorders from meeting settings without opening MC and refreshes order versions", async () => {
  let item = { ...meeting, speakers: [{ id: "a", name: "An", seconds: 30 }, { id: "b", name: "Bình", seconds: 30 }] };
  const fetchMock = vi.fn(async (url, options) => {
    if (String(url).endsWith("/order")) {
      const body = JSON.parse(options.body);
      item = { ...item, __v: item.__v + 1, speakers: body.speakerIds.map((id: string) => item.speakers.find(person => person.id === id)) };
      return { ok: true, json: async () => ({ data: item }) };
    }
    return { ok: true, json: async () => ({ data: [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click((await screen.findAllByTitle("Sửa cuộc họp"))[0]);
  fireEvent.change(screen.getByLabelText("Chọn người để sắp xếp"), { target: { value: "b" } });
  fireEvent.click(screen.getByText("Áp dụng thứ tự"));
  await waitFor(() => expect(Array.from(screen.getByText("Sắp xếp thứ tự thuyết trình").parentElement!.querySelectorAll("li")).map(li => li.textContent)).toEqual(["Bình", "An"]));
  fireEvent.change(screen.getByLabelText("Chọn người để sắp xếp"), { target: { value: "a" } });
  fireEvent.click(screen.getByText("Áp dụng thứ tự"));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/meetings/a/order", expect.objectContaining({ method: "PUT", body: JSON.stringify({ version: 1, speakerIds: ["a", "b"] }) })));
});


it("settings place priority last and list all checked-in people including locked turns", async () => {
  const item = { ...meeting, status: "paused", currentIndex: 1, elapsedSeconds: 12,
    speakers: [{ id: "a", name: "An", seconds: 30 }, { id: "b", name: "Bình", seconds: 30 }, { id: "c", name: "Cường", seconds: 30 }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [item] }) }));
  render(<MeetingTab />);
  fireEvent.click((await screen.findAllByTitle("Sửa cuộc họp"))[0]);
  const select = screen.getByLabelText("Chọn người để sắp xếp") as HTMLSelectElement;
  expect(Array.from(select.options).map(option => option.value)).toEqual(["a", "b", "c"]);
  expect(Array.from(select.options).map(option => option.disabled)).toEqual([true, true, false]);
  expect(select.options[0].textContent).toContain("Đã phát biểu");
  expect(select.options[1].textContent).toContain("Đang phát biểu");
  const section = screen.getByText("Sắp xếp thứ tự thuyết trình").parentElement!;
  expect(section.nextElementSibling?.textContent).toContain("Lưu thay đổi");
  expect(section.previousElementSibling?.textContent).toContain("Cấu hình theo toàn bộ thứ tự check-in");
});

it.each(["live", "paused"])("shows the check-in list and explains unavailable priority changes at the last %s turn", async status => {
  const item = { ...meeting, status, currentIndex: 1, elapsedSeconds: 12,
    speakers: [{ id: "a", name: "An", seconds: 30 }, { id: "b", name: "Bình", seconds: 30 }] };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [item] }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click((await screen.findAllByTitle("Sửa cuộc họp"))[0]);
  const select = screen.getByLabelText("Chọn người để sắp xếp") as HTMLSelectElement;
  expect(select.disabled).toBe(false);
  expect(select.selectedOptions[0].textContent).toBe("Không còn người đang chờ phát biểu");
  expect(Array.from(select.options).map(option => option.value)).toEqual(["", "a", "b"]);
  expect(select.options[1].textContent).toBe("An — Đã phát biểu");
  expect(select.options[2].textContent).toBe("Bình — Đang phát biểu");
  expect(screen.getByText(/Danh sách check-in đã được tải/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Áp dụng thứ tự" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng thứ tự" }));
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/order"))).toBe(false);
});


it.each([0, 3, 150])("slide delay %s waits until speaking time ends before changing the speaker", async delay => {
  const origin = Date.now();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(origin);
  let item = { ...meeting, status: "live", currentIndex: 0, speakerStartedAt: new Date(origin).toISOString(),
    speakers: [{ id: "first", kind: "guest", name: "Đầu tiên", company: "", seconds: 30 }, { id: "second", kind: "member", name: "Tiếp theo", company: "", seconds: 60 }] };
  const fetchMock = vi.fn(async (url, options) => {
    if (options?.method === "POST") item = { ...item, currentIndex: 1, __v: 1, speakerStartedAt: new Date().toISOString() };
    return { ok: true, json: async () => ({ data: String(url).endsWith("/slides") ? { slides: item.speakers, version: item.__v } : options?.method === "POST" ? item : [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn() } as any);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
  fireEvent.click(screen.getByRole("button", { name: "Thuyết trình" }));
  await screen.findByText("Đầu tiên");

  try {
    fireEvent.change(screen.getByLabelText("Chế độ trình chiếu"), { target: { value: "auto" } });
    const field = screen.getByLabelText("Số giây chờ chuyển slide sau khi hết giờ") as HTMLInputElement;
    fireEvent.change(field, { target: { value: String(delay) } });
    expect(field.value).toBe(String(delay));
    expect(field.max).toBe("");
    expect(field.min).toBe("0");
    const calls = () => fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(calls()).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(27000 + delay * 1000 - 250); });
    expect(calls()).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(calls()).toHaveLength(1);
    expect(JSON.parse(calls()[0][1].body).action).toBe("next");
    expect(item.currentIndex).toBe(1);
  } finally {
    vi.useRealTimers(); vi.restoreAllMocks();
  }
});

it("opening a paused presentation resumes the countdown from its remaining time", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  let item = { ...meeting, status: "paused", currentIndex: 0, elapsedSeconds: 11, speakerStartedAt: undefined as string | undefined,
    speakers: [{ id: "guest", kind: "guest", name: "Khách đang nói", company: "", seconds: 30 }] };
  const fetchMock = vi.fn(async (url, options) => {
    if (String(url).endsWith("/presentation")) {
      expect(JSON.parse(options.body).speakerId).toBe("guest");
      item = { ...item, status: "live", speakerStartedAt: new Date().toISOString(), __v: 1 };
    }
    return { ok: true, json: async () => ({ data: String(url).endsWith("/slides") ? { slides: item.speakers, version: item.__v } : options?.method === "POST" ? item : [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn() } as any);
  try {
    render(<MeetingTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục điều hành" }));
    fireEvent.click(screen.getByRole("button", { name: "Thuyết trình" }));
    await screen.findByText("Khách đang nói");
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
    await waitFor(() => expect(item.status).toBe("live"));
    await waitFor(() => expect(screen.getAllByRole("timer").some(node => node.textContent?.includes("00:19"))).toBe(true));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getAllByRole("timer").some(node => node.textContent?.includes("00:18"))).toBe(true);
    await act(async () => { vi.advanceTimersByTime(18000); });
    expect(screen.getAllByRole("timer").every(node => node.textContent?.includes("Hết giờ"))).toBe(true);
  } finally { vi.useRealTimers(); vi.restoreAllMocks(); }
});

it("shows the member's own check-in and speaking information without operating controls", async () => {
  auth.manage = false;
  const speakers = [
    { id: "other", userId: "other-user", name: "Thành viên khác", seconds: 30 },
    { id: "mine", userId: "member1", name: "Thành viên hiện tại", seconds: 45, checkedInAt: "2026-10-10T07:00:00Z" },
  ];
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [{ ...meeting, status: "live", speakers, currentIndex: 1, location: "Hội trường A" }] }) } as Response);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết cuộc họp" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Đã check-in")).toBeTruthy();
  expect(within(dialog).getByText("45 giây")).toBeTruthy();
  expect(within(dialog).getByText("Đang đến lượt phát biểu của bạn")).toBeTruthy();
  expect(within(dialog).getByText("Hội trường A")).toBeTruthy();
  expect(within(dialog).queryByText("Thành viên khác")).toBeNull();
  expect(screen.queryByRole("button", { name: "Tiếp tục điều hành" })).toBeNull();
  expect(screen.queryByTitle("Sửa cuộc họp")).toBeNull();
  expect(screen.queryByRole("button", { name: "Tạo cuộc họp mới" })).toBeNull();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps upcoming meetings visible and filters attendance by account ID", async () => {
  auth.manage = false;
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [
    { ...meeting, speakers: [{ id: "guest", name: "Thành viên hiện tại", seconds: 30 }] },
    { ...meeting, _id: "b", title: "Buổi đã tham dự", status: "ended", speakers: [{ id: "mine", userId: "member1", name: "Tôi", seconds: 20 }] },
  ] }) } as Response);
  render(<MeetingTab />);
  const buttons = await screen.findAllByRole("button", { name: "Xem chi tiết cuộc họp" });
  expect(buttons).toHaveLength(2);
  fireEvent.click(buttons[0]);
  expect(within(screen.getByRole("dialog")).getByText("Chưa check-in")).toBeTruthy();
  expect(screen.getByText(/Để check-in, hãy quét mã QR/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết cuộc họp" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Chỉ buổi đã check-in" }));
  expect(screen.queryByText("Buổi họp A")).toBeNull();
  expect(screen.getByText("Buổi đã tham dự")).toBeTruthy();
});

it.each(["ended", "cancelled"])("does not invite a member to check in to a %s meeting", async status => {
  auth.manage = false;
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [{ ...meeting, status }] }) } as Response);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết cuộc họp" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Buổi họp đã đóng check-in.")).toBeTruthy();
  expect(within(dialog).getByText(status === "ended" ? "Không có ghi nhận tham dự" : "Buổi họp đã hủy")).toBeTruthy();
  expect(screen.queryByText(/Để check-in, hãy quét mã QR/)).toBeNull();
});

it("shows a retryable loading error instead of an empty meetings list", async () => {
  auth.manage = false;
  vi.mocked(fetch).mockRejectedValueOnce(new Error("Lỗi tải cuộc họp"));
  render(<MeetingTab />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Chưa tìm thấy cuộc họp nào")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Buổi họp A")).toBeTruthy();
});

it("allows direct member attendance and immediately updates their status", async () => {
  auth.manage = false;
  const item = { ...meeting, allowDirectCheckIn: true };
  const fetchMock = vi.fn(async (url, options) => {
    if (String(url).endsWith("/checkin")) {
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ latitude: 10, longitude: 106 });
      return { ok: true, json: async () => ({ data: { ...item, speakers: [{ id: "mine", userId: "member1", name: "Tôi", seconds: 30 }] } }) };
    }
    return { ok: true, json: async () => ({ data: [item] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết cuộc họp" }));
  fireEvent.click(screen.getByRole("button", { name: "Điểm danh" }));
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Đã check-in")).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Điểm danh" })).toBeNull();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/checkin"))).toHaveLength(1);
});
it("shows a direct check-in error and lets the member retry", async () => {
  auth.manage = false;
  vi.stubGlobal("fetch", vi.fn(async url => String(url).endsWith("/checkin")
    ? { ok: false, json: async () => ({ message: "Cuộc họp đã dừng check-in." }) }
    : { ok: true, json: async () => ({ data: [{ ...meeting, allowDirectCheckIn: true }] }) }));
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết cuộc họp" }));
  fireEvent.click(screen.getByRole("button", { name: "Điểm danh" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Cuộc họp đã dừng check-in.");
  expect((screen.getByRole("button", { name: "Điểm danh" }) as HTMLButtonElement).disabled).toBe(false);
});
it.each([["scheduled", false], ["ended", true], ["cancelled", true]])("disables direct attendance for %s with setting %s", async (status, allowDirectCheckIn) => {
  auth.manage = false;
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [{ ...meeting, status, allowDirectCheckIn }] }) } as Response);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết cuộc họp" }));
  expect((screen.getByRole("button", { name: "Điểm danh" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Điểm danh" }).getAttribute("aria-describedby")).toBe("member-checkin-hint");
});
it("loads and saves the direct attendance option in meeting settings", async () => {
  const fetchMock = vi.fn(async (_url, options) => ({ ok: true, json: async () => ({ data: options?.method === "PUT" ? meeting : [meeting] }) }));
  vi.stubGlobal("fetch", fetchMock);
  render(<MeetingTab />);
  fireEvent.click((await screen.findAllByTitle("Sửa cuộc họp"))[0]);
  const checkbox = screen.getByRole("checkbox", { name: /Cho phép điểm danh trực tiếp trước khi cuộc họp bắt đầu/ });
  expect((checkbox as HTMLInputElement).checked).toBe(false);
  fireEvent.click(checkbox);
  fireEvent.submit(checkbox.closest("form")!);
  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options?.method === "PUT" && JSON.parse(options.body).allowDirectCheckIn === true)).toBe(true));
});

it("requires GPS permission before submitting member attendance from the detail popup", async () => {
  auth.manage = false;
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: vi.fn((_success, failure) => failure({ code: 1 }))
  } });
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [{ ...meeting, allowDirectCheckIn: true }] }) } as Response);
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết cuộc họp" }));
  expect(screen.queryByTitle("Sửa cuộc họp")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Điểm danh" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí trong trình duyệt rồi thử lại.");
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/checkin"))).toBe(false);
});

it.each(["live", "paused"])("enables member attendance once the meeting is %s without opting in", async status => {
  auth.manage = false;
  const item = { ...meeting, status, allowDirectCheckIn: false };
  vi.stubGlobal("fetch", vi.fn(async (url) => ({
    ok: true, json: async () => ({ data: String(url).endsWith("/checkin")
      ? { ...item, speakers: [{ id: "mine", userId: "member1", name: "Tôi", seconds: 30 }] }
      : [item] })
  })));
  render(<MeetingTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết cuộc họp" }));
  expect((screen.getByRole("button", { name: "Điểm danh" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Điểm danh" }));
  expect(await screen.findByRole("button", { name: "Đã điểm danh" })).toBeTruthy();
});

it("does not show one minute elapsed before a future meeting without an actual start", async () => {
  const item = { ...meeting, status: "live", startsAt: new Date(Date.now() + 3600000).toISOString() };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [item] }) }));
  render(<MeetingTab />);
  await screen.findByText("Chưa đến giờ họp");
  expect(screen.queryByText("Đang diễn ra 1 phút")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục điều hành" }));
  expect(screen.getAllByText("Chưa đến giờ họp")).toHaveLength(2);
});