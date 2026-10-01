// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingTab from "./MeetingTab";
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
  expect(screen.getByText("00:00")).toBeTruthy();
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
