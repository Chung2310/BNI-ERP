// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SpeakerPresentationFrame } from "./SpeakerPresentationFrame";
import type { SlideTimerMeeting } from "./slideTimer";

afterEach(cleanup);
const now = Date.parse("2030-01-01T08:00:00Z");
const meeting: SlideTimerMeeting = {
  status: "live", currentIndex: 0, speakerStartedAt: new Date(now).toISOString(),
  speakers: ["An", "Bình", "Cường", "Dung", "Hà"].map((name, index) => ({ id: String(index), name, seconds: 60 })),
};

it("follows the meeting order and shrinks the remaining queue without wrapping", () => {
  const frame = (index: number, completed = false) => <SpeakerPresentationFrame
    meeting={{ ...meeting, currentIndex: index, speechesCompletedAt: completed ? new Date(now).toISOString() : undefined }}
    slides={[]} speakerId={String(index)} now={now}><div>Slide</div></SpeakerPresentationFrame>;
  const view = render(frame(0));
  const queue = () => within(screen.getByLabelText("Người thuyết trình tiếp theo"));
  expect(queue().getAllByRole("listitem").map(item => item.querySelector("p")?.textContent)).toEqual(["Bình", "Cường", "Dung"]);
  expect(queue().getAllByRole("listitem").map(item => item.querySelector("span")?.textContent)).toEqual(["1.", "2.", "3."]);
  expect(queue().getAllByRole("listitem").map(item => item.querySelector("img")?.getAttribute("src"))).toEqual([
    "/member-slide/default-pfp.jpg", "/member-slide/default-pfp.jpg", "/member-slide/default-pfp.jpg",
  ]);
  expect(screen.getByLabelText("Người thuyết trình tiếp theo").textContent).not.toContain("→");
  view.rerender(frame(2));
  expect(queue().getAllByRole("listitem")).toHaveLength(2);
  view.rerender(frame(3));
  expect(queue().getAllByRole("listitem")).toHaveLength(1);
  view.rerender(frame(4));
  expect(screen.getByLabelText("Người thuyết trình tiếp theo").textContent).toBe("");
  view.rerender(frame(4, true));
  expect(queue().getByText("Đã hoàn tất phần thuyết trình")).toBeTruthy();
  expect(screen.queryByRole("timer")).toBeNull();
});

it("uses elapsed speech time, freezes when paused and shows zero at expiry", () => {
  const frame = (value: SlideTimerMeeting, time: number) => <SpeakerPresentationFrame meeting={value} slides={[]} speakerId="0" now={time}><div>Slide</div></SpeakerPresentationFrame>;
  const view = render(frame(meeting, now + 15000));
  expect(screen.getByRole("timer").textContent).toBe("45");
  view.rerender(frame({ ...meeting, status: "paused", elapsedSeconds: 15 }, now + 45000));
  expect(screen.getByRole("timer").textContent).toBe("45");
  expect(screen.getByRole("timer").getAttribute("aria-label")).toContain("Tạm dừng");
  view.rerender(frame(meeting, now + 61000));
  expect(screen.getByRole("timer").textContent).toBe("00");
});
