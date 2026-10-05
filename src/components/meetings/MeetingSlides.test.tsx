// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act, within } from "@testing-library/react";
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

it("checks multiple attendees and submits one batch while preserving the selection on failure", async () => {
  const defer = vi.fn().mockRejectedValueOnce(new Error("Thử lại" )).mockResolvedValue(undefined);
  const deck = [...slides, { ...slides[1], id: "c", name: "Người thứ ba" }];
  render(<MeetingSlides meeting={{ ...meeting, currentIndex: 0, speakers: deck }} canManage api={vi.fn().mockResolvedValue({ slides: deck, version: 1 })} onDeferSpeaker={defer} />);
  await screen.findByText("Nguyễn An");
  fireEvent.click(screen.getByLabelText("Chọn Nguyễn An"));
  fireEvent.click(screen.getByLabelText("Chọn Trần Bình"));
  fireEvent.click(screen.getByRole("button", { name: "Chuyển xuống cuối lượt" }));
  await screen.findByRole("alert");
  expect(defer).toHaveBeenCalledExactlyOnceWith(["a", "b"]);
  expect((screen.getByLabelText("Chọn Nguyễn An") as HTMLInputElement).checked).toBe(true);
  await waitFor(() => expect((screen.getByRole("button", { name: "Chuyển xuống cuối lượt" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Chuyển xuống cuối lượt" }));
  await waitFor(() => expect((screen.getByLabelText("Chọn Nguyễn An") as HTMLInputElement).checked).toBe(false));
});

it.each([0, 1])("previews selected attendee %s without changing the live turn until starting", async target => {
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  const start = vi.fn().mockResolvedValue(undefined);
  const initial = { ...meeting, currentIndex: target === 0 ? 1 : 0 };
  const view = render(<MeetingSlides meeting={initial} canManage api={api} onStartPresentation={start} />);
  fireEvent.click(await within(screen.getByRole("complementary")).findByText(slides[target].name));
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain(slides[target].name);
  expect(start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  await waitFor(() => expect(start).toHaveBeenCalledExactlyOnceWith(slides[target].id));
  view.rerender(<MeetingSlides meeting={{ ...meeting, currentIndex: target }} canManage api={api} onStartPresentation={start} />);
  expect((await within(screen.getByRole("dialog")).findByRole("img")).getAttribute("aria-label")).toContain(slides[target].name);
});

it("defers a waiting speaker and disables deferral for the last attendee", async () => {
  const defer = vi.fn().mockResolvedValue(undefined);
  render(<MeetingSlides meeting={{ ...meeting, currentIndex: 0 }} canManage api={vi.fn().mockResolvedValue({ slides, version: 1 })} onDeferSpeaker={defer} />);
  await screen.findByText("Nguyễn An");
  expect((screen.getByRole("button", { name: "Để cuối lượt: Trần Bình" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Để cuối lượt: Nguyễn An" }));
  await waitFor(() => expect(defer).toHaveBeenCalledExactlyOnceWith("a"));
});

it("manual mode follows MC changes and has exactly two shared modes", async () => {
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  const onAutoAdvanceChange = vi.fn();
  const view = render(<MeetingSlides meeting={{ ...meeting, currentIndex: 0 }} canManage api={api} onAutoAdvanceChange={onAutoAdvanceChange} />);
  await screen.findByText("Nguyễn An");
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Nguyễn An");
  expect(within(screen.getByLabelText("Chế độ trình chiếu")).getAllByRole("option").map(option => option.textContent)).toEqual(["Thủ công", "Tự động"]);
  view.rerender(<MeetingSlides meeting={meeting} canManage api={api} onAutoAdvanceChange={onAutoAdvanceChange} />);
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain("Trần Bình");
  fireEvent.change(screen.getByLabelText("Chế độ trình chiếu"), { target: { value: "auto" } });
  expect(onAutoAdvanceChange).toHaveBeenCalledWith(true);
});

it("manual arrows request one shared speaker change and wait for server state", async () => {
  let finish!: () => void;
  const onMoveSpeaker = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  const view = render(<MeetingSlides meeting={{ ...meeting, currentIndex: 0 }} canManage api={api} onMoveSpeaker={onMoveSpeaker} />);
  await screen.findByText("Nguyễn An");
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  fireEvent.keyDown(document, { key: "ArrowRight" });
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(onMoveSpeaker).toHaveBeenCalledExactlyOnceWith(1);
  expect((await within(screen.getByRole("dialog")).findByRole("img")).getAttribute("aria-label")).toContain("Nguyễn An");
  await act(async () => finish());
  view.rerender(<MeetingSlides meeting={meeting} canManage api={api} onMoveSpeaker={onMoveSpeaker} />);
  expect((await within(screen.getByRole("dialog")).findByRole("img")).getAttribute("aria-label")).toContain("Trần Bình");
});

it("read-only viewers cannot change the live speaker using arrows", async () => {
  const onMoveSpeaker = vi.fn();
  render(<MeetingSlides meeting={meeting} canManage={false} api={vi.fn().mockResolvedValue({ slides, version: 1 })} onMoveSpeaker={onMoveSpeaker} />);
  await screen.findByText("Nguyễn An");
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  expect(onMoveSpeaker).not.toHaveBeenCalled();
});

it("failed manual navigation leaves the current slide visible and allows retry", async () => {
  const onMoveSpeaker = vi.fn().mockRejectedValue(new Error("Không chuyển được lượt"));
  render(<MeetingSlides meeting={meeting} canManage api={vi.fn().mockResolvedValue({ slides, version: 1 })} onMoveSpeaker={onMoveSpeaker} />);
  await screen.findByText("Nguyễn An");
  fireEvent.click(screen.getByRole("button", { name: "Slide trước" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Trần Bình");
  await waitFor(() => expect((screen.getByRole("button", { name: "Slide trước" }) as HTMLButtonElement).disabled).toBe(false));
});

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
  render(<MeetingSlides meeting={{ ...meeting, status: "scheduled" }} canManage={false} api={vi.fn().mockResolvedValue({ slides, version: 1 })} />);
  await screen.findByText("Nguyễn An");
  expect(screen.queryByText("Bổ sung thông tin slide")).toBeNull();
  fireEvent.click(screen.getByLabelText("Chiếu Nguyễn An"));
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain("Trần Bình");
  fireEvent.click(screen.getByLabelText("Chiếu Trần Bình"));
  expect((screen.getByText("Bắt đầu thuyết trình").closest("button") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Chọn ít nhất một người để trình chiếu.")).toBeTruthy();
});

it("automatic slides follow the speaker instead of advancing on a separate interval", async () => {
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  const view = render(<MeetingSlides meeting={meeting} canManage api={api} autoAdvance />);
  await screen.findByText("Nguyễn An");
  await waitFor(() => expect((screen.getByText("Bắt đầu thuyết trình").closest("button") as HTMLButtonElement).disabled).toBe(false));
  vi.useFakeTimers();
  for (let i = 0; i < 33; i++) {
    await act(async () => { vi.advanceTimersByTime(250); });
    view.rerender(<MeetingSlides meeting={{ ...meeting, currentIndex: 0 }} canManage api={api} autoAdvance />);
  }
  vi.useRealTimers();
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain("Nguyễn An");
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
  await waitFor(() => expect(api).toHaveBeenLastCalledWith("/m/slides/b", "PUT", expect.objectContaining({ version: 4 })));
});

it("does not keep showing the last speaker after the meeting ends", async () => {
  render(<MeetingSlides meeting={{ ...meeting, status: "ended" }} canManage api={vi.fn().mockResolvedValue({ slides: [], version: 1 })} />);
  expect(await screen.findByText("Chưa có người check-in. Hãy check-in thành viên hoặc khách mời trước.")).toBeTruthy();
});


it("starts at the previewed speaker and follows subsequent speaker changes", async () => {
  const deck = [...slides, { ...slides[1], id: "c", name: "Người thứ ba" }];
  const api = vi.fn().mockResolvedValue({ slides: deck, version: 1 });
  const view = render(<MeetingSlides meeting={{ ...meeting, speakers: deck }} canManage api={api} autoAdvance />);
  await screen.findByText("Nguyễn An");
  fireEvent.change(screen.getByLabelText("Chế độ trình chiếu"), { target: { value: "live" } });
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toContain("Trần Bình");
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  expect(screen.getByRole("dialog", { name: "Trình chiếu hồ sơ" })).toBeTruthy();
  await waitFor(() => expect(screen.getAllByRole("img").every(canvas => canvas.getAttribute("aria-label")?.includes("Trần Bình"))).toBe(true));
  view.rerender(<MeetingSlides meeting={{ ...meeting, currentIndex: 2, speakers: deck }} canManage api={api} autoAdvance />);
  await waitFor(() => expect(screen.getAllByRole("img").every(canvas => canvas.getAttribute("aria-label")?.includes("Người thứ ba"))).toBe(true));
  expect(within(screen.getByRole("dialog", { name: "Trình chiếu hồ sơ" })).queryAllByRole("button")).toHaveLength(0);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Trình chiếu hồ sơ" })).toBeNull();
});

it("opens the current slide after data loads when launched from operation controls", async () => {
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  const onPresentationStarted = vi.fn();
  render(<MeetingSlides meeting={meeting} canManage api={api} startFromFirst onPresentationStarted={onPresentationStarted} />);
  await screen.findByRole("dialog", { name: "Trình chiếu hồ sơ" });
  await waitFor(() => expect(onPresentationStarted).toHaveBeenCalledTimes(1));
  expect(screen.getAllByRole("img").every(canvas => canvas.getAttribute("aria-label")?.includes("Trần Bình"))).toBe(true);
});


it("clean manual presentation uses only arrow keys, traps focus and exits with Escape", async () => {
  render(<MeetingSlides meeting={{ ...meeting, status: "scheduled" }} canManage api={vi.fn().mockResolvedValue({ slides, version: 1 })} />);
  await screen.findByText("Nguyễn An");
  expect(screen.queryByRole("button", { name: "Trình chiếu" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  const dialog = screen.getByRole("dialog", { name: "Trình chiếu hồ sơ" });
  expect(within(dialog).queryAllByRole("button")).toHaveLength(0);
  fireEvent.mouseMove(dialog);
  expect(within(dialog).queryAllByRole("button")).toHaveLength(0);
  fireEvent.keyDown(document, { key: "ArrowRight" });
  await waitFor(() => expect(within(dialog).getByRole("img").getAttribute("aria-label")).toContain("Trần Bình"));
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  await waitFor(() => expect(within(dialog).getByRole("img").getAttribute("aria-label")).toContain("Nguyễn An"));
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.activeElement).toBe(dialog);
  fireEvent.keyDown(document, { code: "Space" });
  expect((screen.getByLabelText("Chế độ trình chiếu") as HTMLSelectElement).value).toBe("manual");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Trình chiếu hồ sơ" })).toBeNull();
});

it("clean automatic presentation ignores arrow and space keys", async () => {
  render(<MeetingSlides meeting={meeting} canManage autoAdvance api={vi.fn().mockResolvedValue({ slides, version: 1 })} />);
  await screen.findByText("Nguyễn An");
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  fireEvent.keyDown(document, { key: "ArrowRight" });
  fireEvent.keyDown(document, { code: "Space" });
  await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Trình chiếu hồ sơ" })).getByRole("img").getAttribute("aria-label")).toContain("Trần Bình"));
  expect((screen.getByLabelText("Chế độ trình chiếu") as HTMLSelectElement).value).toBe("auto");
});


it("StrictMode does not exit an incoming fullscreen request; real unmount still exits", async () => {
  const exitFullscreen = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  const view = render(<React.StrictMode><MeetingSlides meeting={meeting} canManage api={api} startFromFirst fullscreenRequest={Promise.resolve(true)} onPresentationStarted={vi.fn()} /></React.StrictMode>);
  try {
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Trình chiếu hồ sơ" })).getByRole("img").getAttribute("aria-label")).toContain("Trần Bình"));
    expect(exitFullscreen).not.toHaveBeenCalled();
    view.unmount();
    await waitFor(() => expect(exitFullscreen).toHaveBeenCalledTimes(1));
  } finally {
    view.unmount();
    delete (document as any).fullscreenElement;
    delete (document as any).exitFullscreen;
  }
});


it.each(["Nguyễn An", "Trần Bình"])("starts the selected member or guest %s without returning to the first profile", async name => {
  const api = vi.fn().mockResolvedValue({ slides, version: 1 });
  render(<MeetingSlides meeting={{ ...meeting, status: "scheduled" }} canManage api={api} />);
  await screen.findByText("Nguyễn An");
  fireEvent.click(within(screen.getByRole("complementary")).getByText(name));
  await waitFor(() => expect(screen.getByRole("img").getAttribute("aria-label")).toContain(name));
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thuyết trình" }));
  const dialog = screen.getByRole("dialog", { name: "Trình chiếu hồ sơ" });
  await waitFor(() => expect(within(dialog).getByRole("img").getAttribute("aria-label")).toContain(name));
  expect(within(dialog).queryAllByRole("button")).toHaveLength(0);
  fireEvent.keyDown(document, { key: name === "Nguyễn An" ? "ArrowRight" : "ArrowLeft" });
  await waitFor(() => expect(within(dialog).getByRole("img").getAttribute("aria-label")).toContain(name === "Nguyễn An" ? "Trần Bình" : "Nguyễn An"));
});
