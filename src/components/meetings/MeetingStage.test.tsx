// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingStage } from "./MeetingStage";
vi.mock("./profileSlideRenderer", () => ({ SLIDE_WIDTH: 1920, SLIDE_HEIGHT: 1080, renderProfileSlide: vi.fn() }));
vi.mock("./ActiveMembersPanel", () => ({ ActiveMembersPanel: () => <div>Ranking</div> }));
afterEach(cleanup);
it("reveals the same persisted winner at server time and does not replay a completed draw on reload", () => {
  const start = Date.parse("2030-01-01T01:00:00Z");
  const snapshot = { serverNow: start, slides: [], meeting: {
    title: "Demo", status: "live", presentation: { view: "luckyDraw", drawWinnerId: "winner", drawStartedAt: new Date(start).toISOString(), drawRevealsAt: new Date(start + 5000).toISOString() },
    speakers: [{ id: "a", name: "Rolling" }], luckyDraw: { prizes: [{ winners: [{ id: "winner", name: "Chosen Winner", prizeName: "Gift" }] }] },
  }} as unknown as import("../../services/meetingLiveService").MeetingLiveSnapshot;
  const view = render(<MeetingStage snapshot={snapshot} now={start + 4999} />);
  expect(screen.getByText("Đang quay thưởng")).toBeTruthy();
  expect(screen.queryByText("Chosen Winner")).toBeNull();
  view.rerender(<MeetingStage snapshot={snapshot} now={start + 5000} />);
  expect(screen.getByText("Chosen Winner")).toBeTruthy();
  view.unmount();
  render(<MeetingStage snapshot={snapshot} now={start + 10000} />);
  expect(screen.getByText("Chosen Winner")).toBeTruthy();
  expect(screen.queryByText("Đang quay thưởng")).toBeNull();
});
