import assert from "node:assert/strict";
import test from "node:test";
import { setRateLimitRedisClientForTesting } from "../../infrastructure/rate-limit-redis";
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { reorderMeetingSpeakers, controlMeeting, checkIn } = await import("./meeting.service");
import { allocateSpeakers } from "./meeting.rules";

const now = new Date("2026-10-01T08:00:30Z");
function meeting(): any {
  return { _id: "m", companyCode: "ACME", __v: 0, status: "live", currentIndex: 0,
    elapsedSeconds: 0, speakerStartedAt: new Date("2026-10-01T08:00:00Z"),
    tiers: [{ count: 1, seconds: 60 }], fallbackSeconds: 20, save: async () => {},
    speakers: [
      { id: "early", name: "Early", seconds: 60, checkedInAt: new Date("2026-10-01T07:00:00Z") },
      { id: "second", name: "Second", seconds: 20, checkedInAt: new Date("2026-10-01T07:10:00Z") },
      { id: "chair", name: "Chair", seconds: 20, checkedInAt: new Date("2026-10-01T07:30:00Z") },
    ] };
}

test("priority insertion shifts waiting speakers down without changing current speaker or allocations", async () => {
  const item = meeting();
  await reorderMeetingSpeakers(item, ["early", "chair", "second"]);
  assert.deepEqual(item.speakers.map((s: any) => s.id), ["early", "chair", "second"]);
  assert.deepEqual(item.speakers.map((s: any) => s.seconds), [60, 20, 20]);
  assert.equal(item.currentIndex, 0);
  assert.equal(item.speakerStartedAt.toISOString(), "2026-10-01T08:00:00.000Z");
});

test("cannot move active or completed speakers and rejects duplicate ranks/IDs", async () => {
  const item = meeting();
  await assert.rejects(reorderMeetingSpeakers(item, ["chair", "early", "second"]), { status: 409 });
  await assert.rejects(reorderMeetingSpeakers(item, ["early", "chair", "chair"]), { status: 400 });
  item.currentIndex = 1;
  await assert.rejects(reorderMeetingSpeakers(item, ["second", "early", "chair"]), { status: 409 });
});

test("can change priority one before the first timer starts, preserving arrival-based time on start", async () => {
  const item = meeting();
  item.status = "scheduled"; item.currentIndex = -1; item.speakerStartedAt = undefined;
  await reorderMeetingSpeakers(item, ["chair", "early", "second"]);
  await controlMeeting(item, "start", now);
  assert.equal(item.speakers[0].id, "chair");
  assert.deepEqual(item.speakers.map((s: any) => s.seconds), [20, 60, 20]);
  assert.equal(item.speakerStartedAt, undefined);
  await reorderMeetingSpeakers(item, ["early", "chair", "second"]);
  assert.equal(item.speakers[0].id, "early");
});

test("tier recalculation keeps arrival order even after the speaking queue changes", () => {
  const people = meeting().speakers.reverse();
  assert.deepEqual(allocateSpeakers(people, [{ count: 1, seconds: 90 }], 30).map(s => s.seconds), [30, 30, 90]);
});

test("last next completes speeches without ending the meeting; explicit finish still works", async () => {
  const item = meeting(); item.currentIndex = 2;
  await controlMeeting(item, "next", now);
  assert.equal(item.status, "live");
  assert.equal(item.currentIndex, 3);
  assert.equal(item.speechesCompletedAt, now);
  assert.equal(item.speakerStartedAt, undefined);
  assert.equal(item.endedAt, undefined);
  await assert.rejects(controlMeeting(item, "next", now), { status: 409 });
  await controlMeeting(item, "finish", now);
  assert.equal(item.status, "ended");
});

test("a new guest can check in after speeches complete and resumes the queue without starting a timer", async () => {
  const item = meeting(); item.currentIndex = 2;
  await controlMeeting(item, "next", now);
  await checkIn(item, { name: "Late guest", email: "" }, "manager", true);
  assert.equal(item.status, "live");
  assert.equal(item.currentIndex, 3);
  assert.equal(item.speakers[3].name, "Late guest");
  assert.equal(item.speechesCompletedAt, undefined);
  assert.equal(item.speakerStartedAt, undefined);
});

test("pausing and resuming a completed queue does not create a phantom timer", async () => {
  const item = meeting(); item.currentIndex = 2;
  await controlMeeting(item, "next", now);
  await controlMeeting(item, "pause", now);
  await controlMeeting(item, "resume", now);
  assert.equal(item.speakerStartedAt, undefined);
  assert.equal(item.status, "live");
});
