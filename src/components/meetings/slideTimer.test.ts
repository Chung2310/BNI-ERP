import { expect, it } from "vitest";
import { getSlideTimer } from "./slideTimer";

const now = Date.parse("2026-10-01T08:00:20Z");
const meeting = { status: "live", currentIndex: 0, elapsedSeconds: 5, speakerStartedAt: "2026-10-01T08:00:00Z",
  speakers: [{ id: "early", seconds: 60 }, { id: "late", seconds: 20 }] };

it("uses the allocation of each attendee, counting down only the current speaker", () => {
  expect(getSlideTimer(meeting, "early", now)).toMatchObject({ time: "00:35", seconds: 60, label: "Đang phát biểu" });
  expect(getSlideTimer(meeting, "late", now)).toMatchObject({ time: "00:20", seconds: 20, label: "", arrivalOrder: 2 });
});
it("freezes on pause and restores the allocation when the speaker timer resets", () => {
  expect(getSlideTimer({ ...meeting, status: "paused", elapsedSeconds: 25 }, "early", now + 90000)?.time).toBe("00:35");
  expect(getSlideTimer({ ...meeting, speakerStartedAt: undefined, elapsedSeconds: 0 }, "early", now)).toMatchObject({ time: "01:00", label: "Chờ bắt đầu" });
});
it("shows overtime and preserves completed speaker time", () => {
  expect(getSlideTimer(meeting, "early", now + 40000, true)).toMatchObject({ time: "+00:05", overtime: true, urgent: true });
  expect(getSlideTimer({ ...meeting, currentIndex: 1, speakers: [{ id: "early", seconds: 60, spokenSeconds: 45 }, { id: "late", seconds: 20 }] }, "early", now)).toMatchObject({ time: "00:15", label: "Đã phát biểu" });
});
it("ignores invalid timestamps and missing allocations", () => {
  expect(getSlideTimer({ ...meeting, speakerStartedAt: "invalid" }, "early", now)?.time).toBe("00:55");
  expect(getSlideTimer(meeting, "missing", now)).toBeNull();
});

it("ranks check-in time rather than the reordered speaking queue", () => {
  const reordered = { ...meeting, speakers: [
    { id: "late", seconds: 20, checkedInAt: "2026-10-01T07:59:00Z" },
    { id: "early", seconds: 60, checkedInAt: "2026-10-01T07:30:00Z" },
  ] };
  expect(getSlideTimer(reordered, "early", now)?.arrivalOrder).toBe(1);
  expect(getSlideTimer(reordered, "late", now)?.arrivalOrder).toBe(2);
  expect(reordered.speakers[0].id).toBe("late");
});

it("manual countdown stays at zero and shows Hết giờ instead of counting overtime", () => {
  expect(getSlideTimer(meeting, "early", now + 40000)).toMatchObject({ time: "00:00", label: "Hết giờ" });
  expect(getSlideTimer(meeting, "early", now + 100000)).toMatchObject({ time: "00:00", label: "Hết giờ" });
});
