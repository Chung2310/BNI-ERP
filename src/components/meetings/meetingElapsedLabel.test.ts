import { expect, it } from "vitest";
import { meetingElapsedLabel } from "./meetingElapsedLabel";
const now = Date.parse("2026-10-03T02:00:00Z");
it("does not fabricate one minute for a future meeting without an actual start", () => {
  expect(meetingElapsedLabel({ startsAt: "2026-10-03T10:00:00+07:00" }, now)).toBe("Chưa đến giờ họp");
});
it("counts from an actual early or late start instead of the scheduled time", () => {
  const startedAt = "2026-10-03T01:58:00Z";
  expect(meetingElapsedLabel({ startsAt: "2026-10-03T03:00:00Z", startedAt }, now)).toBe("Đang diễn ra 2 phút");
  expect(meetingElapsedLabel({ startsAt: "2026-10-03T01:00:00Z", startedAt }, now)).toBe("Đang diễn ra 2 phút");
});
it("shows zero for the first minute and handles legacy timestamps and invalid dates", () => {
  expect(meetingElapsedLabel({ startsAt: new Date(now) }, now)).toBe("Đang diễn ra 0 phút");
  expect(meetingElapsedLabel({ startsAt: new Date(now - 30_000) }, now)).toBe("Đang diễn ra 0 phút");
  expect(meetingElapsedLabel({ startsAt: new Date(now - 96 * 60_000) }, now)).toBe("Đang diễn ra 96 phút");
  expect(meetingElapsedLabel({ startsAt: "invalid" }, now)).toBe("Đang diễn ra");
});