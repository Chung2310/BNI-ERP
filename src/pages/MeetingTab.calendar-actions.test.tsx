// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import MeetingTab from "./MeetingTab";
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ hasPermission: () => true, userProfile: { uid: "member1" } }) }));
vi.mock("../services/socketService", () => ({ socketService: { on: () => () => {} } }));
vi.mock("./Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const meeting = { _id: "calendar-one", title: "Họp tuần", startsAt: "2030-01-02T00:00:00Z", endsAt: "2030-01-02T02:00:00Z", status: "scheduled", speakers: [], tiers: [], fallbackSeconds: 20, reminderDays: 0, currentIndex: -1, elapsedSeconds: 0, __v: 4 };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function mockApi(status = "scheduled") {
  let items = [{ ...meeting, status }];
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    const input = options?.body ? JSON.parse(String(options.body)) : {};
    if (options?.method === "DELETE") items = [];
    if (options?.method === "POST") items = items.map(item => ({ ...item, status: "cancelled", __v: 5 }));
    if (options?.method === "PUT") items = items.map(item => ({ ...item, startsAt: input.startsAt, __v: 5 }));
    return { ok: true, json: async () => ({ data: options?.method && options.method !== "GET" ? items[0] || { success: true } : items }) };
  });
  vi.stubGlobal("fetch", request);
  return request;
}

async function openDay() {
  await act(async () => { render(<MeetingTab />); });
  await screen.findByText("07:00 · Họp tuần");
  fireEvent.click(screen.getByRole("button", { name: "Xem lịch ngày 02/01/2030" }));
  return within(screen.getByRole("dialog", { name: "Lịch ngày 02/01/2030" }));
}

it("filters cancelled meetings separately from ended meetings in both views", async () => {
  const items = [
    { ...meeting, _id: "cancelled", title: "Buổi đã hủy", status: "cancelled" },
    { ...meeting, _id: "ended", title: "Buổi đã kết thúc", status: "ended", startsAt: "2030-01-03T00:00:00Z" },
  ];
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: items }) })));
  render(<MeetingTab />);
  await screen.findByText("Đã hủy · 07:00 · Buổi đã hủy");
  fireEvent.click(screen.getByRole("button", { name: "Đã hủy" }));
  expect(await screen.findByText("Đã hủy · 07:00 · Buổi đã hủy")).toBeTruthy();
  expect(screen.queryByText("07:00 · Buổi đã kết thúc")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Danh sách" }));
  expect(await screen.findByRole("button", { name: "Đã hủy (1)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Đã kết thúc (1)" })).toBeTruthy();
  expect(screen.getByText("Buổi đã hủy")).toBeTruthy();
  expect(screen.queryByText("Buổi đã kết thúc")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Đã kết thúc (1)" }));
  expect(screen.getByText("Buổi đã kết thúc")).toBeTruthy();
  expect(screen.queryByText("Buổi đã hủy")).toBeNull();
});

it("cancels only after confirmation and shows the cancelled label on the calendar", async () => {
  const request = mockApi();
  const day = await openDay();
  fireEvent.click(day.getByRole("button", { name: "Hủy" }));
  expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Hủy buổi họp" }));
  await screen.findByText("Đã hủy · 07:00 · Họp tuần");
  const call = request.mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(call[0]).toBe("/api/v1/meetings/calendar-one/control");
  expect(JSON.parse(String(call[1]?.body))).toEqual({ action: "cancel", version: 4 });
});

it("reschedules to the selected day after confirmation and switches the calendar to the new month", async () => {
  const request = mockApi();
  const day = await openDay();
  fireEvent.click(day.getByRole("button", { name: "Dời lịch" }));
  fireEvent.click(screen.getByRole("button", { name: "Ngày dời cuộc họp" }));
  const datePicker = within(screen.getByRole("dialog", { name: "Lịch chọn ngày" }));
  fireEvent.change(datePicker.getByLabelText("Chọn tháng"), { target: { value: "1" } });
  fireEvent.click(datePicker.getByRole("button", { name: "3" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Dời lịch cuộc họp" })).getByRole("button", { name: "Tiếp tục" }));
  expect(request.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận dời lịch" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Tháng xem lịch" }).textContent).toBe("Tháng 2, 2030"));
  const call = request.mock.calls.find(([, options]) => options?.method === "PUT")!;
  expect(call[0]).toBe("/api/v1/meetings/calendar-one");
  expect(JSON.parse(String(call[1]?.body))).toEqual({ startsAt: "2030-02-03T00:00:00.000Z", version: 4 });
  await screen.findByText("07:00 · Họp tuần");
  fireEvent.click(screen.getByRole("button", { name: "Xem lịch ngày 03/02/2030" }));
  expect(within(screen.getByRole("dialog", { name: "Lịch ngày 03/02/2030" })).getByText("07:00 · Họp tuần")).toBeTruthy();
});

it.each(["live", "paused"])("blocks cancellation/rescheduling of %s meetings and confirms deletion", async (status) => {
  const request = mockApi(status);
  const day = await openDay();
  expect((day.getByRole("button", { name: "Hủy" }) as HTMLButtonElement).disabled).toBe(true);
  expect((day.getByRole("button", { name: "Dời lịch" }) as HTMLButtonElement).disabled).toBe(true);
  const remove = day.getByRole("button", { name: "Xóa cuộc họp" });
  expect(remove.textContent).toBe("");
  fireEvent.click(remove);
  expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Xóa cuộc họp" }));
  await waitFor(() => expect(screen.queryByText("07:00 · Họp tuần")).toBeNull());
  expect(request.mock.calls.find(([, options]) => options?.method === "DELETE")?.[0]).toBe("/api/v1/meetings/calendar-one");
});

it.each([
  ["Hủy", "Hủy buổi họp này?"],
  ["Dời lịch", "Dời lịch cuộc họp"],
  ["Xóa cuộc họp", "Xác nhận xóa cuộc họp"],
])("opens %s directly from the list without opening meeting operations", async (action, title) => {
  const request = mockApi();
  await act(async () => { render(<MeetingTab />); });
  await screen.findByText("07:00 · Họp tuần");
  fireEvent.click(screen.getByRole("button", { name: "Danh sách" }));
  fireEvent.click(screen.getByRole("button", { name: action }));
  expect(screen.getByText(title, { exact: true })).toBeTruthy();
  expect(screen.queryByTitle("Đóng popup")).toBeNull();
  expect(request.mock.calls.some(([, options]) => options?.method && options.method !== "GET")).toBe(false);
});

it.each(["live", "paused"])("disables cancellation and rescheduling in the list for %s meetings", async (status) => {
  mockApi(status);
  await act(async () => { render(<MeetingTab />); });
  await screen.findByText("07:00 · Họp tuần");
  fireEvent.click(screen.getByRole("button", { name: "Danh sách" }));
  expect((screen.getByRole("button", { name: "Hủy" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Dời lịch" }) as HTMLButtonElement).disabled).toBe(true);
});

it("keeps scheduling actions outside the meeting operations modal", async () => {
  mockApi();
  const day = await openDay();
  fireEvent.click(day.getByRole("button", { name: /07:00 · Họp tuần/ }));
  expect(screen.getByTitle("Đóng popup")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Hủy" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Dời lịch" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Xóa cuộc họp" })).toBeNull();
});

it("keeps ended meetings read-only but exposes deletion in calendar, list and detail views", async () => {
  const request = mockApi("ended");
  const day = await openDay();
  expect(day.queryByRole("button", { name: "Hủy" })).toBeNull();
  expect(day.queryByRole("button", { name: "Dời lịch" })).toBeNull();
  expect(day.getByRole("button", { name: "Xóa cuộc họp" })).toBeTruthy();
  fireEvent.click(day.getByRole("button", { name: /07:00 · Họp tuần/ }));
  expect(screen.queryByTitle("Sửa cuộc họp")).toBeNull();
  expect(screen.getByText("Cuộc họp đã kết thúc. Bạn chỉ có thể xem thông tin và kết quả.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cấu hình địa điểm & thời gian" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Thuyết trình/ }));
  expect(screen.queryByRole("button", { name: "Bắt đầu thuyết trình" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Quay thưởng/ }));
  expect(screen.queryByRole("link", { name: /Mở vòng quay/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cài đặt" })).toBeNull();
  fireEvent.click(screen.getByTitle("Đóng popup"));
  fireEvent.click(screen.getByRole("button", { name: "Danh sách" }));
  expect(screen.getByText("Họp tuần")).toBeTruthy();
  expect(screen.queryByTitle("Sửa cuộc họp")).toBeNull();
  expect(screen.getByTitle("Xóa cuộc họp")).toBeTruthy();
  expect(request.mock.calls.some(([, options]) => options?.method && options.method !== "GET")).toBe(false);
});
