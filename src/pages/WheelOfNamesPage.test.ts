import { describe, it, expect } from "vitest";
import { buildMeetingParticipants, matchesFilterCategory, meetingDrawParticipants } from "./WheelOfNamesPage";
import type { Speaker } from "../services/meetingService";
import type { UserProfile } from "../types";

describe("WheelOfNamesPage participant filtering logic", () => {
  const memberPresent = {
    id: "m-1",
    name: "Nguyễn Văn A",
    selected: true,
    type: "member_present" as const,
  };

  const memberAbsent = {
    id: "m-2",
    name: "Trần Thị B",
    selected: true,
    type: "member_absent" as const,
  };

  const guestAttendee = {
    id: "g-1",
    name: "Khách mời Lê C",
    selected: true,
    type: "guest" as const,
  };

  it("only includes present members", () => {
    expect(matchesFilterCategory(memberPresent, "present_members")).toBe(true);
    expect(matchesFilterCategory(memberAbsent, "present_members")).toBe(false);
    expect(matchesFilterCategory(guestAttendee, "present_members")).toBe(false);
  });

  it("keeps guests, absent members and late arrivals off the meeting wheel", () => {
    const candidates = [
      { ...memberPresent, checkedInAt: "2026-10-20T07:00:59+07:00" },
      { ...guestAttendee, checkedInAt: "2026-10-20T07:01:00+07:00" },
      { ...guestAttendee, id: "guest-early", checkedInAt: "2026-10-20T06:30:00+07:00" },
      { ...memberPresent, id: "member-late", checkedInAt: "2026-10-20T07:01:00+07:00" },
      memberAbsent,
    ];
    expect(meetingDrawParticipants(candidates).map(person => person.id)).toEqual(["m-1"]);
  });
});

describe("meeting attendee classification", () => {
  it("uses only supplied meeting attendees and classifies by member identity", () => {
    const users = [{
      uid: "firebase-1", _id: "member-1", email: "member@example.com", displayName: "Nguyễn Thành Viên",
      role: "user", createdAt: "2026-01-01",
    }] as UserProfile[];
    const speakers = [
      { id: "speaker-member", userId: "member-1", name: "Tên hiển thị khác", email: "member@example.com", checkedInAt: "2026-01-01", seconds: 30 },
      { id: "speaker-unlisted-member", userId: "member-2", name: "Thành viên chưa tải hồ sơ", checkedInAt: "2026-01-01", seconds: 30 },
      { id: "speaker-guest", name: "Khách của buổi này", checkedInAt: "2026-01-01", seconds: 30 },
    ] as Speaker[];

    const participants = buildMeetingParticipants(users, speakers);

    expect(participants.find(item => item.id === "speaker-member")?.type).toBe("member_present");
    expect(participants.find(item => item.id === "speaker-unlisted-member")?.type).toBe("member_present");
    expect(participants.find(item => item.id === "speaker-guest")?.type).toBe("guest");
    expect(participants.some(item => item.name === "Khách từ cuộc họp khác")).toBe(false);
  });

  it("does not classify a guest as a member from a partial name match", () => {
    const users = [{
      uid: "member-an", email: "an@example.com", displayName: "An", role: "user", createdAt: "2026-01-01",
    }] as UserProfile[];
    const speakers = [{
      id: "guest-an-nguyen", name: "An Nguyễn", checkedInAt: "2026-01-01", seconds: 30,
    }] as Speaker[];

    const participants = buildMeetingParticipants(users, speakers);
    expect(participants.find(item => item.id === "member-an")?.type).toBe("member_absent");
    expect(participants.find(item => item.id === "guest-an-nguyen")?.type).toBe("guest");
  });
});

describe("Bingo Cage initialization logic", () => {
  it("initializes balls with correct numbering and physics constraints", async () => {
    const { initBingoBalls } = await import("./WheelOfNamesPage");
    const testParticipants = [
      { id: "p1", name: "Nguyễn Văn A", selected: true, type: "member_present" as const },
      { id: "p2", name: "Trần Thị B", selected: true, type: "member_absent" as const },
      { id: "p3", name: "Khách C", selected: true, type: "guest" as const },
    ];

    const balls = initBingoBalls(testParticipants, 150);
    expect(balls.length).toBe(3);
    expect(balls[0].ballNumber).toBe(1);
    expect(balls[0].participant.name).toBe("Nguyễn Văn A");
    expect(balls[1].ballNumber).toBe(2);
    expect(balls[2].ballNumber).toBe(3);
    expect(balls[0].radius).toBeGreaterThan(0);
  });

  it("returns empty array when participant list is empty", async () => {
    const { initBingoBalls } = await import("./WheelOfNamesPage");
    expect(initBingoBalls([], 150)).toEqual([]);
  });
});
