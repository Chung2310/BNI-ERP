import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";
import { setRateLimitRedisClientForTesting } from "../../infrastructure/rate-limit-redis";
setRateLimitRedisClientForTesting({ eval: async () => [1, 1000], decr: async () => 0, del: async () => 0 });
const { qrCheckInGuest } = await import("./meeting.service");
const { meetingCheckInRouter } = await import("./meeting-checkin.router");
import { guestAvatarError, MAX_GUEST_AVATAR_BYTES } from "./meeting-guest-avatar";
import { MeetingModel } from "./meeting.model";
import { cloudinaryService } from "../../service/cloudinary.service";
const { buildProfileSlide } = await import("./meeting-slides.service");

const buffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1kAAAAASUVORK5CYII=", "base64");
const avatar = { buffer, size: buffer.length, mimetype: "image/png" };
const input = { name: "Khách An", email: "", phone: "0901234567", company: "ACME", latitude: 10, longitude: 106 };
const asset = { publicId: "meetings/m/guests/avatar", secureUrl: "https://example.com/avatar.png", resourceType: "image", bytes: buffer.length };
function meeting(): any {
  return { _id: "507f1f77bcf86cd799439011", companyCode: "ACME", __v: 0, status: "scheduled", checkInQrTokenHash: "hash",
    checkInQrExpiresAt: new Date(Date.now() + 60000), latitude: 10, longitude: 106, gpsRadiusMeters: 200,
    speakers: [], tiers: [{ count: 10, seconds: 30 }], fallbackSeconds: 20, save: async () => {} };
}

test("validates file bytes, MIME type and size before upload", () => {
  assert.equal(guestAvatarError(avatar), null);
  assert.ok(guestAvatarError({ ...avatar, mimetype: "image/jpeg" }));
  assert.ok(guestAvatarError({ buffer: Buffer.from("<svg/>"), size: 6, mimetype: "image/png" }));
  assert.ok(guestAvatarError({ ...avatar, size: MAX_GUEST_AVATAR_BYTES + 1 }));
});

test("stores uploaded avatar with guest check-in and keeps tier duration", async t => {
  const item = meeting();
  t.mock.method(MeetingModel, "findOne", async () => item);
  const upload = t.mock.method(cloudinaryService, "uploadMediaAsset", async () => asset);
  await qrCheckInGuest("token", input, avatar);
  assert.equal(upload.mock.callCount(), 1);
  assert.equal(item.speakers[0].photoURL, asset.secureUrl);
  assert.equal(item.speakers[0].company, "ACME");
  assert.equal(item.speakers[0].seconds, 30);
});

test("rejects expired QR and out-of-range GPS before upload", async t => {
  const upload = t.mock.method(cloudinaryService, "uploadMediaAsset", async () => asset);
  const find = t.mock.method(MeetingModel, "findOne", async () => null);
  await assert.rejects(qrCheckInGuest("expired", input, avatar), { status: 410 });
  find.mock.mockImplementation(async () => meeting());
  await assert.rejects(qrCheckInGuest("token", { ...input, latitude: 12 }, avatar), { status: 403 });
  assert.equal(upload.mock.callCount(), 0);
});

test("removes unreferenced upload if QR expires while uploading", async t => {
  let count = 0;
  t.mock.method(MeetingModel, "findOne", async () => ++count === 1 ? meeting() : null);
  t.mock.method(MeetingModel, "exists", async () => null);
  t.mock.method(cloudinaryService, "uploadMediaAsset", async () => asset);
  const remove = t.mock.method(cloudinaryService, "deletePublicMedia", async () => {});
  await assert.rejects(qrCheckInGuest("token", input, avatar), { status: 410 });
  assert.equal(remove.mock.callCount(), 1);
  assert.deepEqual(remove.mock.calls[0].arguments, [asset.publicId, "image"]);
});

test("multipart guest endpoint accepts optional avatar and enforces 5 MB limit", async t => {
  const item = meeting();
  t.mock.method(MeetingModel, "findOne", async () => item);
  const upload = t.mock.method(cloudinaryService, "uploadMediaAsset", async () => asset);
  const app = express();
  app.use(express.json());
  app.use("/checkin", meetingCheckInRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const port = (server.address() as { port: number }).port;
  const endpoint = `http://127.0.0.1:${port}/checkin/token/guest`;
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.append(key, String(value));
  form.append("industry", "Thiết kế");
  form.append("bio", "ấ".repeat(1000));
  form.append("avatar", new Blob([buffer], { type: "image/png" }), "avatar.png");
  form.append("coverImage", new Blob([buffer], { type: "image/png" }), "cover.png");
  const res = await fetch(endpoint, { method: "POST", body: form });
  assert.equal(res.status, 200, JSON.stringify(await res.json()));
  assert.equal(item.speakers[0].photoURL, asset.secureUrl);
  assert.equal(item.speakers[0].coverImage, asset.secureUrl);
  assert.equal(buildProfileSlide(item.speakers[0]).industry, "Thiết kế");
  assert.equal(buildProfileSlide(item.speakers[0]).bio, "ấ".repeat(1000));
  const oversized = new FormData();
  oversized.append("avatar", new Blob([new Uint8Array(MAX_GUEST_AVATAR_BYTES + 1)], { type: "image/png" }), "large.png");
  const invalid = await fetch(endpoint, { method: "POST", body: oversized });
  assert.equal(invalid.status, 413);
  assert.equal(upload.mock.callCount(), 2);
});

test("cover-only check-in persists optional profile fields through Mongoose", async t => {
  const item = meeting();
  t.mock.method(MeetingModel, "findOne", async () => item);
  t.mock.method(cloudinaryService, "uploadMediaAsset", async () => asset);
  await qrCheckInGuest("token", { ...input, industry: "Design", bio: "Short bio" }, undefined, avatar);
  const reloaded = new MeetingModel({ speakers: item.speakers });
  const slide = buildProfileSlide(reloaded.speakers[0]);
  assert.equal(slide.photoURL, "");
  assert.equal(slide.coverImage, asset.secureUrl);
  assert.equal(slide.industry, "Design");
  assert.equal(slide.bio, "Short bio");
});

test("cleans up the first image when uploading the second image fails", async t => {
  t.mock.method(MeetingModel, "findOne", async () => meeting());
  t.mock.method(MeetingModel, "exists", async () => null);
  let calls = 0;
  t.mock.method(cloudinaryService, "uploadMediaAsset", async () => {
    if (++calls === 2) throw new Error("Upload failed");
    return asset;
  });
  const remove = t.mock.method(cloudinaryService, "deletePublicMedia", async () => {});
  await assert.rejects(qrCheckInGuest("token", input, avatar, avatar), { status: 502 });
  assert.equal(remove.mock.callCount(), 1);
});

test("guest may omit all optional profile fields", async t => {
  const item = meeting();
  t.mock.method(MeetingModel, "findOne", async () => item);
  const upload = t.mock.method(cloudinaryService, "uploadMediaAsset", async () => asset);
  await qrCheckInGuest("token", input);
  const slide = buildProfileSlide(item.speakers[0]);
  assert.equal(slide.industry, "");
  assert.equal(slide.bio, "");
  assert.equal(slide.coverImage, "");
  assert.equal(upload.mock.callCount(), 0);
});
