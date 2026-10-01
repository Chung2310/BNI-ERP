import { describe, it, expect } from "vitest";
import { matchesFilterCategory } from "./WheelOfNamesPage";

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

  it("filter 'all' includes present members, absent members, and guests", () => {
    expect(matchesFilterCategory(memberPresent, "all")).toBe(true);
    expect(matchesFilterCategory(memberAbsent, "all")).toBe(true);
    expect(matchesFilterCategory(guestAttendee, "all")).toBe(true);
  });

  it("filter 'all_members' includes only chapter members (present + absent), excludes guests", () => {
    expect(matchesFilterCategory(memberPresent, "all_members")).toBe(true);
    expect(matchesFilterCategory(memberAbsent, "all_members")).toBe(true);
    expect(matchesFilterCategory(guestAttendee, "all_members")).toBe(false);
  });

  it("filter 'present_members' includes only present members", () => {
    expect(matchesFilterCategory(memberPresent, "present_members")).toBe(true);
    expect(matchesFilterCategory(memberAbsent, "present_members")).toBe(false);
    expect(matchesFilterCategory(guestAttendee, "present_members")).toBe(false);
  });

  it("filter 'guests' includes only guests", () => {
    expect(matchesFilterCategory(memberPresent, "guests")).toBe(false);
    expect(matchesFilterCategory(memberAbsent, "guests")).toBe(false);
    expect(matchesFilterCategory(guestAttendee, "guests")).toBe(true);
  });
});
