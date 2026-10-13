import assert from "node:assert/strict";
import test from "node:test";
import { setRateLimitRedisClientForTesting } from "../../infrastructure/rate-limit-redis";
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { reorderMeetingSpeakers, controlMeeting, checkIn, startMeetingPresentation, deferMeetingSpeaker, deferMeetingSpeakers } = await import("./meeting.service");
import { allocateSpeakers } from "./meeting.rules";
import { MeetingModel } from "./meeting.model";

const now = new Date("2026-10-01T08:00:30Z");
function meeting() {
  const item = MeetingModel.hydrate({ _id: "507f1f77bcf86cd799439011", companyCode: "ACME", __v: 0, status: "live", currentIndex: 0,
    elapsedSeconds: 0, speakerStartedAt: new Date("2026-10-01T08:00:00Z"),
    tiers: [{ count: 1, seconds: 60 }], fallbackSeconds: 20,
    speakers: [
      { id: "early", name: "Early", seconds: 60, checkedInAt: new Date("2026-10-01T07:00:00Z") },
      { id: "second", name: "Second", seconds: 20, checkedInAt: new Date("2026-10-01T07:10:00Z") },
      { id: "chair", name: "Chair", seconds: 20, checkedInAt: new Date("2026-10-01T07:30:00Z") },
    ] });
  item.save = async () => item;
  return item;
}

test("bulk deferral keeps list order rather than selection order and saves once", async t => {
  const item = meeting();
  const save = t.mock.method(item, "save", async () => {});
  await deferMeetingSpeakers((item as unknown as Parameters<typeof deferMeetingSpeakers>[0]), ["chair", "early"], now);
  assert.deepEqual(item.speakers.map((s) => s.id), ["second", "early", "chair"]);
  assert.deepEqual(item.speakers.map((s) => s.seconds), [20, 60, 20]);
  assert.equal(item.speakers[1].deferred, true);
  assert.equal(item.speakers[2].deferred, true);
  assert.equal(item.currentIndex, 0);
  assert.equal(item.speakerStartedAt, now);
  assert.equal(save.mock.callCount(), 1);
});

test("invalid batches do not partially mutate or save the queue", async t => {
  const item = meeting(); item.currentIndex = 1;
  const original = JSON.stringify(item);
  const save = t.mock.method(item, "save", async () => {});
  for (const ids of [[], ["second", "second"], ["second", "missing"], ["second", "early"], ["second", "chair"], "second"]) {
    await assert.rejects(deferMeetingSpeakers((item as unknown as Parameters<typeof deferMeetingSpeakers>[0]), ids, now));
    assert.equal(JSON.stringify(item), original);
  }
  assert.equal(save.mock.callCount(), 0);
});

test("previous speaker resets the target timer and preserves live or paused state", async () => {
  for (const status of ["live", "paused"] as const) {
    const item = meeting(); item.currentIndex = 1; item.status = status;
    if (status === "paused") { item.speakerStartedAt = undefined; item.elapsedSeconds = 12; }
    await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "previous", now);
    assert.equal(item.currentIndex, 0);
    assert.equal(item.status, status);
    assert.equal(item.elapsedSeconds, 0);
    assert.equal(item.speakerStartedAt, status === "live" ? now : undefined);
    assert.equal(item.speakers[1].spokenSeconds, status === "live" ? 20 : 12);
    await assert.rejects(controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "previous", now), { status: 409 });
  }
});

test("next switches the shared display to speaker view", async () => {
  const item = meeting();
  item.set("presentation", { view: "checkin", autoAdvance: false, autoAdvanceDelay: 3 });
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "next", now);
  assert.equal(item.currentIndex, 1);
  assert.equal(item.presentation?.view, "speaker");
});
test("manual next records no more than the allocated speaking time after a long delay", async () => {
  const item = meeting();
  item.currentIndex = 1;
  item.speakerStartedAt = new Date(+now - 6_083_000);
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "next", now);
  assert.equal(item.speakers[1].seconds, 20);
  assert.equal(item.speakers[1].spokenSeconds, 20);
});
test("changing the presenter also caps the completed speaker's recorded time", async () => {
  const item = meeting();
  item.currentIndex = 1;
  item.speakerStartedAt = new Date(+now - 6_083_000);
  await startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "chair", now);
  assert.equal(item.speakers[1].spokenSeconds, 20);
});
test("deferring the current speaker moves them to the end and starts the next allocated turn", async () => {
  const item = meeting();
  await deferMeetingSpeaker((item as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "early", now);
  assert.deepEqual(item.speakers.map((s) => s.id), ["second", "chair", "early"]);
  assert.deepEqual(item.speakers.map((s) => s.seconds), [20, 20, 60]);
  assert.equal(item.currentIndex, 0);
  assert.equal(item.speakerStartedAt, now);
  assert.equal(item.elapsedSeconds, 0);
  assert.equal(item.speakers[2].deferred, true);
  assert.equal(item.speakers[2].spokenSeconds, undefined);
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "next", now);
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "next", now);
  assert.equal(item.speakers[item.currentIndex].id, "early");
  assert.equal(item.speakers[item.currentIndex].deferred, false);
});

test("deferred order and marker survive Mongoose serialization", async t => {
  const item = new MeetingModel({ ...meeting().toObject(), _id: "507f1f77bcf86cd799439011" });
  t.mock.method(item, "save", async () => item);
  await deferMeetingSpeaker(item, "early", now);
  const restored = new MeetingModel(item.toObject());
  assert.deepEqual(restored.speakers.map(s => s.id), ["second", "chair", "early"]);
  assert.equal(restored.speakers[2].deferred, true);
  assert.equal(restored.speakers[2].seconds, 60);
});

test("deferring a waiting person preserves the active speaker and clock; multiple deferrals remain queued", async () => {
  const item = meeting(); const started = item.speakerStartedAt;
  await deferMeetingSpeaker((item as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "second", now);
  assert.equal(item.speakers[0].id, "early");
  assert.equal(item.speakerStartedAt, started);
  assert.equal(item.speakers[2].deferred, true);
  await deferMeetingSpeaker((item as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "early", now);
  assert.deepEqual(item.speakers.map((s) => s.id), ["chair", "second", "early"]);
  assert.equal(item.speakers[1].deferred, true);
  assert.equal(item.speakers[2].deferred, true);
});

test("deferral preserves paused/scheduled state and rejects completed, last or missing attendees", async () => {
  const paused = meeting(); paused.status = "paused"; paused.speakerStartedAt = undefined; paused.elapsedSeconds = 12;
  await deferMeetingSpeaker((paused as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "early", now);
  assert.equal(paused.status, "paused"); assert.equal(paused.speakerStartedAt, undefined); assert.equal(paused.elapsedSeconds, 0);
  const scheduled = meeting(); scheduled.status = "scheduled"; scheduled.currentIndex = -1; scheduled.speakerStartedAt = undefined;
  await deferMeetingSpeaker((scheduled as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "early", now);
  assert.equal(scheduled.currentIndex, -1); assert.equal(scheduled.speakerStartedAt, undefined);
  const item = meeting(); item.currentIndex = 1;
  await assert.rejects(deferMeetingSpeaker((item as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "early", now), { status: 409 });
  await assert.rejects(deferMeetingSpeaker((item as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "chair", now), { status: 409 });
  await assert.rejects(deferMeetingSpeaker((item as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "missing", now), { status: 404 });
  item.status = "ended";
  await assert.rejects(deferMeetingSpeaker((item as unknown as Parameters<typeof deferMeetingSpeaker>[0]), "second", now), { status: 409 });
});

test("priority insertion shifts waiting speakers down without changing current speaker or allocations", async () => {
  const item = meeting();
  await reorderMeetingSpeakers((item as unknown as Parameters<typeof reorderMeetingSpeakers>[0]), ["early", "chair", "second"]);
  assert.deepEqual(item.speakers.map((s) => s.id), ["early", "chair", "second"]);
  assert.deepEqual(item.speakers.map((s) => s.seconds), [60, 20, 20]);
  assert.equal(item.currentIndex, 0);
  assert.equal(item.speakerStartedAt.toISOString(), "2026-10-01T08:00:00.000Z");
});

test("cannot move active or completed speakers and rejects duplicate ranks/IDs", async () => {
  const item = meeting();
  await assert.rejects(reorderMeetingSpeakers((item as unknown as Parameters<typeof reorderMeetingSpeakers>[0]), ["chair", "early", "second"]), { status: 409 });
  await assert.rejects(reorderMeetingSpeakers((item as unknown as Parameters<typeof reorderMeetingSpeakers>[0]), ["early", "chair", "chair"]), { status: 400 });
  item.currentIndex = 1;
  await assert.rejects(reorderMeetingSpeakers((item as unknown as Parameters<typeof reorderMeetingSpeakers>[0]), ["second", "early", "chair"]), { status: 409 });
});

test("can change priority one before the first timer starts, preserving arrival-based time on start", async () => {
  const item = meeting();
  item.status = "scheduled"; item.currentIndex = -1; item.speakerStartedAt = undefined;
  await reorderMeetingSpeakers((item as unknown as Parameters<typeof reorderMeetingSpeakers>[0]), ["chair", "early", "second"]);
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "start", now);
  assert.equal(item.speakers[0].id, "chair");
  assert.deepEqual(item.speakers.map((s) => s.seconds), [20, 60, 20]);
  assert.equal(item.speakerStartedAt, undefined);
  await reorderMeetingSpeakers((item as unknown as Parameters<typeof reorderMeetingSpeakers>[0]), ["early", "chair", "second"]);
  assert.equal(item.speakers[0].id, "early");
});

test("tier recalculation keeps arrival order even after the speaking queue changes", () => {
  const people = meeting().speakers.reverse();
  assert.deepEqual(allocateSpeakers(people, [{ count: 1, seconds: 90 }], 30).map(s => s.seconds), [30, 30, 90]);
});

test("last next completes speeches without ending the meeting; explicit finish still works", async () => {
  const item = meeting(); item.currentIndex = 2;
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "next", now);
  assert.equal(item.status, "live");
  assert.equal(item.currentIndex, 3);
  assert.equal(item.speechesCompletedAt, now);
  assert.equal(item.speakerStartedAt, undefined);
  assert.equal(item.endedAt, undefined);
  await assert.rejects(controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "next", now), { status: 409 });
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "finish", now);
  assert.equal(item.status, "ended");
});

test("a new guest can check in after speeches complete and resumes the queue without starting a timer", async () => {
  const item = meeting(); item.currentIndex = 2;
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "next", now);
  await checkIn((item as unknown as Parameters<typeof checkIn>[0]), { name: "Late guest", email: "" }, "manager", true);
  assert.equal(item.status, "live");
  assert.equal(item.currentIndex, 3);
  assert.equal(item.speakers[3].name, "Late guest");
  assert.equal(item.speechesCompletedAt, undefined);
  assert.equal(item.speakerStartedAt, undefined);
});

test("pausing and resuming a completed queue does not create a phantom timer", async () => {
  const item = meeting(); item.currentIndex = 2;
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "next", now);
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "pause", now);
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "resume", now);
  assert.equal(item.speakerStartedAt, undefined);
  assert.equal(item.status, "live");
});

test("presentation resumes a paused speaker without resetting remaining time", async () => {
  const item = meeting(); item.status = "paused"; item.elapsedSeconds = 41; item.speakerStartedAt = undefined;
  await startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "early", now);
  assert.equal(item.status, "live"); assert.equal(item.elapsedSeconds, 41); assert.equal(item.speakerStartedAt, now);
});
test("reopening an already running speaker preserves the clock", async () => {
  const item = meeting(); const started = item.speakerStartedAt;
  await startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "early", now);
  assert.equal(item.speakerStartedAt, started); assert.equal(item.elapsedSeconds, 0);
});
test("presentation starts the selected guest with their allocated time", async () => {
  const item = meeting();
  await startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "chair", now);
  assert.equal(item.currentIndex, 2); assert.equal(item.speakerStartedAt, now); assert.equal(item.elapsedSeconds, 0);
  assert.equal(item.speakers[2].seconds, 20); assert.equal(item.speakers[0].spokenSeconds, 30);
});
test("presentation can atomically enable automatic speaker advancement", async () => {
  const item = meeting(); item.presentation.autoAdvance = false;
  await startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "chair", now, { autoAdvance: true });
  assert.equal(item.presentation.autoAdvance, true);
  assert.equal(item.presentation.view, "speaker");
});
test("scheduled presentation starts selected person and rejects invalid or ended selections", async () => {
  const item = meeting(); item.status = "scheduled"; item.currentIndex = -1;
  await startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "chair", now);
  assert.equal(item.status, "live"); assert.equal(item.currentIndex, 2); assert.equal(item.speakers[2].seconds, 20);
  await assert.rejects(startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "missing", now), { status: 400 });
  item.status = "ended";
  await assert.rejects(startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "chair", now), { status: 409 });
});

test("records the actual meeting start and does not reset it when resuming", async () => {
  const item = meeting(); item.status = "scheduled"; item.startsAt = new Date(now.getTime() + 3600000);
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "start", now);
  assert.equal(item.startedAt, now);
  assert.equal(item.startsAt.getTime(), now.getTime() + 3600000);
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "pause", new Date(now.getTime() + 60000));
  await controlMeeting((item as unknown as Parameters<typeof controlMeeting>[0]), "resume", new Date(now.getTime() + 120000));
  assert.equal(item.startedAt, now);
});
test("records the actual start when starting a presentation directly", async () => {
  const item = meeting(); item.status = "scheduled";
  await startMeetingPresentation((item as unknown as Parameters<typeof startMeetingPresentation>[0]), "early", now);
  assert.equal(item.startedAt, now);
});
