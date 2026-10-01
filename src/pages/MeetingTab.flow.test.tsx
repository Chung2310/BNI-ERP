// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import MeetingTab from "./MeetingTab";
vi.mock("../components/meetings/profileSlideRenderer", () => ({
  SLIDE_WIDTH: 1920, SLIDE_HEIGHT: 1080, loadSlideImage: vi.fn().mockResolvedValue(null),
  renderProfileSlide: vi.fn(async () => ({ canvas: document.createElement("canvas"), warnings: [] })),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock("../services/socketService", () => ({ socketService: { on: () => () => {} } }));
vi.mock("../components/meetings/LuckyDrawTab", () => ({ LuckyDrawTab: () => <div>Quay thưởng đang mở</div> }));
vi.mock("./Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const meeting = { _id: "a", title: "Buổi họp A", startsAt: "2026-10-10T08:00:00Z", status: "scheduled", speakers: [], tiers: [{count:10,seconds:30}], fallbackSeconds:20, reminderDays:0, currentIndex:-1, elapsedSeconds:0, __v:0 };
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok:true, json:async () => ({data:[meeting]}) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
