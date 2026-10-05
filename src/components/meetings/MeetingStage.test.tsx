// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingStage } from "./MeetingStage";
vi.mock("./profileSlideRenderer", () => ({ SLIDE_WIDTH: 1920, SLIDE_HEIGHT: 1080, DEFAULT_PROFILE_PHOTO: "/member-slide/default-pfp.jpg", renderProfileSlide: vi.fn(), loadSlideImage: vi.fn() }));
vi.mock("./ActiveMembersPanel", () => ({ ActiveMembersPanel: () => <div>Ranking</div> }));
afterEach(cleanup);
it("uses the meeting wheel screen for the lucky draw stage", () => {
  const snapshot = { serverNow: Date.now(), slides: [], meeting: {
    _id: "meeting", title: "BNI Demo", status: "live", currentIndex: 0,
    presentation: { view: "luckyDraw" }, speakers: [], luckyDraw: { drawMode: "attendees", prizes: [] },
  }} as unknown as import("../../services/meetingLiveService").MeetingLiveSnapshot;
  render(<MeetingStage snapshot={snapshot} now={snapshot.serverNow} />);
  const frame = screen.getByTitle("Màn hình quay thưởng") as HTMLIFrameElement;
  expect(frame.getAttribute("src")).toBe("/quay-thuong?meetingId=meeting&game=wheel&presentation=1");
});
