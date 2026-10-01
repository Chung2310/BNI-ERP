// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MeetingSlides } from "./MeetingSlides";

vi.mock("./profileSlideRenderer", () => ({
  SLIDE_WIDTH: 1920, SLIDE_HEIGHT: 1080,
  loadSlideImage: vi.fn().mockResolvedValue(null),
  renderProfileSlide: vi.fn(async () => ({ canvas: document.createElement("canvas"), warnings: [] })),
}));
const slides = [
  { id: "a", kind: "member", name: "Nguyễn An", company: "ACME", photoURL: "", coverImage: "", phone: "", industry: "", bio: "" },
  { id: "b", kind: "guest", name: "Trần Bình", company: "Guest Co", photoURL: "", coverImage: "", phone: "", industry: "", bio: "" },
];
const meeting = { _id: "m", __v: 1, currentIndex: 1, status: "live", speakers: slides };
beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as any));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("selects the guest in live mode and saves only slide fields with the server version", async () => {
  const api = vi.fn().mockResolvedValue({ slides, version: 4 });
  render(<MeetingSlides meeting={meeting} canManage api={api} />);
  await screen.findByText("Nguyễn An");
  fireEvent.change(screen.getByLabelText("Chế độ trình chiếu"), { target: { value: "live" } });
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain("Trần Bình");
  fireEvent.click(screen.getByText("Bổ sung thông tin slide"));
  fireEvent.change(screen.getByLabelText("Bio / giới thiệu ngắn"), { target: { value: "Kết nối kinh doanh" } });
  fireEvent.click(screen.getByText("Lưu thông tin slide"));
  await waitFor(() => expect(api).toHaveBeenCalledWith("/m/slides/b", "PUT", {
    version: 4, profile: { name: "Trần Bình", company: "Guest Co", photoURL: "", coverImage: "", phone: "", industry: "", bio: "Kết nối kinh doanh" },
  }));
});

it("read-only users can choose attendees but cannot edit; empty selection disables presenting", async () => {
  render(<MeetingSlides meeting={meeting} canManage={false} api={vi.fn().mockResolvedValue({ slides, version: 1 })} />);
  await screen.findByText("Nguyễn An");
  expect(screen.queryByText("Bổ sung thông tin slide")).toBeNull();
  fireEvent.click(screen.getByLabelText("Chiếu Nguyễn An"));
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain("Trần Bình");
  fireEvent.click(screen.getByLabelText("Chiếu Trần Bình"));
  expect((screen.getByText("Trình chiếu").closest("button") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Chọn ít nhất một người để trình chiếu.")).toBeTruthy();
});

it("auto advance survives the parent's frequent clock rerenders", async () => {
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  const view = render(<MeetingSlides meeting={meeting} canManage api={api} />);
  await screen.findByText("Nguyễn An");
  await waitFor(() => expect((screen.getByText("Trình chiếu").closest("button") as HTMLButtonElement).disabled).toBe(false));
  vi.useFakeTimers();
  fireEvent.change(screen.getByLabelText("Chế độ trình chiếu"), { target: { value: "auto" } });
  for (let i = 0; i < 33; i++) {
    await act(async () => { vi.advanceTimersByTime(250); });
    view.rerender(<MeetingSlides meeting={{ ...meeting }} canManage api={api} />);
  }
  vi.useRealTimers();
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain("Trần Bình");
});

it("keeps the version captured when editing even if live meeting data refreshes", async () => {
  const api = vi.fn().mockResolvedValue({ slides, version: 4 });
  const view = render(<MeetingSlides meeting={meeting} canManage api={api} />);
  await screen.findByText("Nguyễn An");
  fireEvent.click(screen.getByText("Bổ sung thông tin slide"));
  api.mockResolvedValue({ slides, version: 5 });
  view.rerender(<MeetingSlides meeting={{ ...meeting, __v: 5 }} canManage api={api} />);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByText("Lưu thông tin slide"));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith("/m/slides/a", "PUT", expect.objectContaining({ version: 4 })));
});

it("does not keep showing the last speaker after the meeting ends", async () => {
  render(<MeetingSlides meeting={{ ...meeting, status: "ended" }} canManage api={vi.fn().mockResolvedValue({ slides, version: 1 })} />);
  await screen.findByText("Nguyễn An");
  fireEvent.change(screen.getByLabelText("Chế độ trình chiếu"), { target: { value: "live" } });
  expect(screen.getByText("Chưa có người đang phát biểu.")).toBeTruthy();
});


it("starts at the first slide and follows subsequent speaker changes", async () => {
  const deck = [...slides, { ...slides[1], id: "c", name: "Người thứ ba" }];
  const api = vi.fn().mockResolvedValue({ slides: deck, version: 1 });
  const view = render(<MeetingSlides meeting={{ ...meeting, speakers: deck }} canManage api={api} />);
  await screen.findByText("Nguyễn An");
  fireEvent.change(screen.getByLabelText("Chế độ trình chiếu"), { target: { value: "live" } });
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain("Trần Bình");
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  expect(screen.getByRole("dialog", { name: "Trình chiếu hồ sơ" })).toBeTruthy();
  await waitFor(() => expect(screen.getAllByRole("img").every(canvas => canvas.getAttribute("aria-label")?.includes("Nguyễn An"))).toBe(true));
  view.rerender(<MeetingSlides meeting={{ ...meeting, currentIndex: 2, speakers: deck }} canManage api={api} />);
  await waitFor(() => expect(screen.getAllByRole("img").every(canvas => canvas.getAttribute("aria-label")?.includes("Người thứ ba"))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Thoát trình chiếu" }));
  expect(screen.queryByRole("dialog", { name: "Trình chiếu hồ sơ" })).toBeNull();
});

it("opens the first slide after data loads when launched from operation controls", async () => {
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  const onPresentationStarted = vi.fn();
  render(<MeetingSlides meeting={meeting} canManage api={api} startFromFirst onPresentationStarted={onPresentationStarted} />);
  await screen.findByRole("dialog", { name: "Trình chiếu hồ sơ" });
  expect(onPresentationStarted).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("img").every(canvas => canvas.getAttribute("aria-label")?.includes("Nguyễn An"))).toBe(true);
});
