import assert from "node:assert/strict";
import test from "node:test";
import { setRateLimitRedisClientForTesting } from "../../infrastructure/rate-limit-redis";
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { checkInFromModule } = await import("./meeting.service");
const { UserModel } = await import("../../model/user.model");
const { MeetingModel } = await import("./meeting.model");
const { meetingInput, updateMeetingInput, recurringMeetingInput } = await import("./meeting.validation");

function setup(t: import("node:test").TestContext) {
  const queries: Array<{ _id?: string; companyCode?: string; isActive?: { $ne?: boolean } }> = [];
  const item = { _id: "meeting", companyCode: "ACME", status: "scheduled", latitude: 10, longitude: 106, gpsRadiusMeters: 200, allowDirectCheckIn: undefined as boolean | undefined,
    speakers: [], tiers: [{ count: 10, seconds: 30 }], fallbackSeconds: 20, save: async () => {} };
  t.mock.method(UserModel, "findOne", (query) => {
    queries.push(query);
    return { select: () => ({ lean: async () => query._id === "member" && query.companyCode === "ACME"
      ? { displayName: "Thành viên", email: "member@test.com" } : null }) };
  });
  return { item, queries };
}
test("meeting forms ignore the retired direct check-in setting from older clients", () => {
  assert.equal(MeetingModel.schema.path("allowDirectCheckIn"), undefined);
  const input = { title: "Họp", startsAt: "2030-01-01T08:00:00Z", tiers: [{ startTime: "07:00", endTime: "08:00", seconds: 30 }], fallbackSeconds: 20 };
  const { startsAt: _startsAt, ...details } = input;
  const recurrence = { startDate: "2030-01-01", months: 6, weekday: 3, time: "07:00" };
  for (const allowDirectCheckIn of [undefined, false, true]) {
    for (const result of [
      meetingInput.validate({ ...input, allowDirectCheckIn }),
      updateMeetingInput.validate({ title: "Họp mới", allowDirectCheckIn }),
      recurringMeetingInput.validate({ ...details, recurrence, allowDirectCheckIn }),
    ]) {
      assert.equal(result.error, undefined);
      assert.equal(Object.hasOwn(result.value, "allowDirectCheckIn"), false);
    }
  }
});

test("scheduled legacy meetings allow direct GPS attendance regardless of the old setting", async t => {
  const { item, queries } = setup(t);
  for (const value of [undefined, false, true]) {
    item.allowDirectCheckIn = value;
    item.speakers = [];
    await checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 10, longitude: 106 }, "member", false);
    assert.equal(item.speakers.length, 1);
    assert.equal(item.speakers[0].userId, "member");
  }
  assert.equal(queries.length, 3);
});
test("members check themselves in once without QR after GPS verification in open meeting states", async t => {
  const { item, queries } = setup(t);
  for (const status of ["scheduled", "live", "paused"]) {
    item.status = status; item.speakers = [];
    await checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 10, longitude: 106 }, "member", false);
    await checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 10, longitude: 106 }, "member", false);
    assert.equal(item.speakers.length, 1);
    assert.equal(item.speakers[0].userId, "member");
    assert.equal(item.speakers[0].name, "Thành viên");
    assert.ok(item.speakers[0].checkedInAt);
  }
  assert.ok(queries.every(query => query.companyCode === "ACME" && query.isActive.$ne === false));
});
test("direct attendance rejects impersonation, guests, closed meetings and unavailable members", async t => {
  const { item } = setup(t);
  await assert.rejects(checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { userId: "other", latitude: 10, longitude: 106 }, "member", false), { status: 403 });
  await assert.rejects(checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { name: "Guest", latitude: 10, longitude: 106 }, "member", false), { status: 403 });
  await assert.rejects(checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 10, longitude: 106 }, "foreign", false), { status: 404 });
  for (const status of ["ended", "cancelled"]) {
    item.status = status;
    await assert.rejects(checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 10, longitude: 106 }, "member", false), { status: 409 });
  }
  assert.equal(item.speakers.length, 0);
});
test("organizers can still check members in with a legacy disabled setting", async t => {
  const { item } = setup(t);
  item.allowDirectCheckIn = false;
  await checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { userId: "member" }, "admin", true);
  assert.equal(item.speakers[0].userId, "member");
});

test("direct member check-in requires valid GPS inside the configured radius", async t => {
  const { item } = setup(t);
  for (const input of [{}, { latitude: NaN, longitude: 106 }, { latitude: 91, longitude: 106 }]) {
    await assert.rejects(checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), input, "member", false), { status: 400 });
  }
  await assert.rejects(checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 11, longitude: 106 }, "member", false), { status: 403 });
  item.latitude = undefined;
  await assert.rejects(checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 10, longitude: 106 }, "member", false), { status: 409 });
  assert.equal(item.speakers.length, 0);
});

test("ongoing meetings allow direct GPS attendance regardless of the old setting", async t => {
  const { item } = setup(t);
  for (const status of ["live", "paused"]) {
    for (const setting of [false, undefined, true]) {
      item.status = status; item.allowDirectCheckIn = setting; item.speakers = [];
      await assert.rejects(checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 11, longitude: 106 }, "member", false), { status: 403 });
      await checkInFromModule((item as unknown as Parameters<typeof checkInFromModule>[0]), { latitude: 10, longitude: 106 }, "member", false);
      assert.equal(item.speakers.length, 1);
    }
  }
});
