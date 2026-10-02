import assert from "node:assert/strict";
import test from "node:test";
import { setRateLimitRedisClientForTesting } from "../../infrastructure/rate-limit-redis";
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { checkInFromModule, updateMeeting } = await import("./meeting.service");
const { UserModel } = await import("../../model/user.model");
const { MeetingModel } = await import("./meeting.model");
const { meetingInput, updateMeetingInput } = await import("./meeting.validation");

function setup(t: any) {
  const queries: any[] = [];
  const item: any = { _id: "meeting", companyCode: "ACME", status: "scheduled", allowDirectCheckIn: true, latitude: 10, longitude: 106, gpsRadiusMeters: 200,
    speakers: [], tiers: [{ count: 10, seconds: 30 }], fallbackSeconds: 20, save: async () => {} };
  t.mock.method(UserModel, "findOne", (query: any) => {
    queries.push(query);
    return { select: () => ({ lean: async () => query._id === "member" && query.companyCode === "ACME"
      ? { displayName: "Thành viên", email: "member@test.com" } : null }) };
  });
  return { item, queries };
}
test("direct check-in is off by default and configuration validates and persists", async t => {
  assert.equal(new MeetingModel().allowDirectCheckIn, false);
  const input = { title: "Họp", startsAt: "2030-01-01T08:00:00Z", tiers: [{ count: 10, seconds: 30 }], fallbackSeconds: 20 };
  assert.equal(meetingInput.validate(input).value.allowDirectCheckIn, false);
  assert.ok(updateMeetingInput.validate({ allowDirectCheckIn: "invalid" }).error);
  const { item } = setup(t);
  t.mock.method(MeetingModel, "findOne", async () => item);
  await updateMeeting("ACME", "meeting", { allowDirectCheckIn: false });
  assert.equal(item.allowDirectCheckIn, false);
});
test("legacy and disabled meetings require QR", async t => {
  const { item, queries } = setup(t);
  for (const value of [undefined, false]) {
    item.allowDirectCheckIn = value;
    await assert.rejects(checkInFromModule(item, { latitude: 10, longitude: 106 }, "member", false), { status: 403 });
  }
  assert.equal(queries.length, 0);
});
test("members check themselves in once without QR after GPS verification in open meeting states", async t => {
  const { item, queries } = setup(t);
  for (const status of ["scheduled", "live", "paused"]) {
    item.status = status; item.speakers = [];
    await checkInFromModule(item, { latitude: 10, longitude: 106 }, "member", false);
    await checkInFromModule(item, { latitude: 10, longitude: 106 }, "member", false);
    assert.equal(item.speakers.length, 1);
    assert.equal(item.speakers[0].userId, "member");
    assert.equal(item.speakers[0].name, "Thành viên");
    assert.ok(item.speakers[0].checkedInAt);
  }
  assert.ok(queries.every(query => query.companyCode === "ACME" && query.isActive.$ne === false));
});
test("direct attendance rejects impersonation, guests, closed meetings and unavailable members", async t => {
  const { item } = setup(t);
  await assert.rejects(checkInFromModule(item, { userId: "other", latitude: 10, longitude: 106 }, "member", false), { status: 403 });
  await assert.rejects(checkInFromModule(item, { name: "Guest", latitude: 10, longitude: 106 }, "member", false), { status: 403 });
  await assert.rejects(checkInFromModule(item, { latitude: 10, longitude: 106 }, "foreign", false), { status: 404 });
  for (const status of ["ended", "cancelled"]) {
    item.status = status;
    await assert.rejects(checkInFromModule(item, { latitude: 10, longitude: 106 }, "member", false), { status: 409 });
  }
  assert.equal(item.speakers.length, 0);
});
test("organizers can still check members in when direct attendance is disabled", async t => {
  const { item } = setup(t);
  item.allowDirectCheckIn = false;
  await checkInFromModule(item, { userId: "member" }, "admin", true);
  assert.equal(item.speakers[0].userId, "member");
});

test("direct member check-in requires valid GPS inside the configured radius", async t => {
  const { item } = setup(t);
  for (const input of [{}, { latitude: NaN, longitude: 106 }, { latitude: 91, longitude: 106 }]) {
    await assert.rejects(checkInFromModule(item, input, "member", false), { status: 400 });
  }
  await assert.rejects(checkInFromModule(item, { latitude: 11, longitude: 106 }, "member", false), { status: 403 });
  item.latitude = undefined;
  await assert.rejects(checkInFromModule(item, { latitude: 10, longitude: 106 }, "member", false), { status: 409 });
  assert.equal(item.speakers.length, 0);
});

test("starting the meeting opens direct GPS attendance even for legacy or disabled settings", async t => {
  const { item } = setup(t);
  for (const status of ["live", "paused"]) {
    for (const setting of [false, undefined]) {
      item.status = status; item.allowDirectCheckIn = setting; item.speakers = [];
      await assert.rejects(checkInFromModule(item, { latitude: 11, longitude: 106 }, "member", false), { status: 403 });
      await checkInFromModule(item, { latitude: 10, longitude: 106 }, "member", false);
      assert.equal(item.speakers.length, 1);
    }
  }
});
