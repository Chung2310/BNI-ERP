import assert from "node:assert/strict";
import test from "node:test";
import { setRateLimitRedisClientForTesting } from "../../infrastructure/rate-limit-redis";
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { buildProfileSlide, getMeetingSlides, updateMeetingSlide } = await import("./meeting-slides.service");
import { slideProfileInput } from "./meeting.validation";
import { MeetingModel } from "./meeting.model";
import { UserModel } from "../../model/user.model";

test("member slide uses latest profile and explicit blank overrides; guest keeps check-in company", () => {
  const member = buildProfileSlide({ id: "s", userId: "u", name: "Old", slideProfile: { company: "", bio: "Giới thiệu" } },
    { displayName: "Nguyễn An", companyName: "ACME", phone: "0901234567", industry: "Thiết kế" });
  assert.equal(member.kind, "member");
  assert.equal(member.name, "Nguyễn An");
  assert.equal(member.company, "");
  assert.equal(member.phone, "0901234567");
  assert.equal(member.bio, "Giới thiệu");
  const guest = buildProfileSlide({ id: "g", name: "Guest", company: "Guest Co", phone: "0901234567", slideProfile: { industry: "Legacy industry" } });
  assert.equal(guest.kind, "guest");
  assert.equal(guest.company, "Guest Co");
  assert.equal(guest.phone, "");
  assert.equal(guest.industry, "");
});

test("slide input rejects oversized phone numbers, script URLs, oversized bio and unknown fields", () => {
  const profile = { name: "An", company: "", photoURL: "", coverImage: "", phone: "", industry: "", bio: "" };
  assert.equal(slideProfileInput.validate({ version: 0, profile }).error, undefined);
  assert.equal(slideProfileInput.validate({ version: 0, profile: null }).error, undefined);
  for (const patch of [{ phone: "1".repeat(41) }, { photoURL: "javascript:alert(1)" }, { bio: "x".repeat(1001) }, { userId: "other" }]) {
    assert.ok(slideProfileInput.validate({ version: 0, profile: { ...profile, ...patch } }).error);
  }
});

test("slide reads scope both meeting and profile queries to the requesting company", async t => {
  const meeting = new MeetingModel({ companyCode: "ACME", title: "Meeting", speakers: [{ id: "s", userId: "507f1f77bcf86cd799439011", name: "Stored", seconds: 30, checkedInAt: new Date() }], __v: 2 });
  t.mock.method(MeetingModel, "findOne", async (query: any) => {
    assert.deepEqual(query, { _id: "meeting-1", companyCode: "ACME" }); return meeting;
  });
  t.mock.method(UserModel, "find", (query: any) => {
    assert.equal(query.companyCode, "ACME");
    assert.deepEqual(query.isActive, { $ne: false });
    return { select: () => ({ lean: async () => [{ _id: "507f1f77bcf86cd799439011", displayName: "Current" }] }) };
  });
  const deck = await getMeetingSlides("ACME", "meeting-1");
  assert.equal(deck.slides[0].name, "Current");
  assert.equal(deck.version, 2);
});

test("stale slide edits cannot overwrite a newer meeting", async t => {
  t.mock.method(MeetingModel, "findOne", async () => ({ __v: 3 }));
  await assert.rejects(updateMeetingSlide("ACME", "meeting-1", "s", { version: 2, profile: null }), { status: 409 });
});

test("slide overrides survive Mongoose serialization and reset without changing identity", () => {
  const meeting = new MeetingModel({ speakers: [{ id: "s", userId: "u", name: "Original", seconds: 30, checkedInAt: new Date() }] });
  const speaker = meeting.speakers[0];
  speaker.set("slideProfile", { name: "Slide name", bio: "Bio", company: "" });
  const reloaded = new MeetingModel(meeting.toObject());
  assert.equal(buildProfileSlide(reloaded.speakers[0]).name, "Slide name");
  reloaded.speakers[0].set("slideProfile", undefined);
  assert.equal(buildProfileSlide(reloaded.speakers[0]).name, "Original");
  assert.equal(reloaded.speakers[0].userId, "u");
});
