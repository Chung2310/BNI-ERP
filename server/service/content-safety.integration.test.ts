import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
const deps = vi.hoisted(() => ({
  disconnectUserSockets: vi.fn(), emitToUser: vi.fn(), deletePublicMedia: vi.fn(),
  finalizeAvatar: vi.fn(), finalizeCover: vi.fn(), finalizeGallery: vi.fn(),
}));
vi.mock("../socket", () => ({ disconnectUserSockets: deps.disconnectUserSockets, emitToUser: deps.emitToUser }));
vi.mock("./cloudinary.service", () => ({ cloudinaryService: { deletePublicMedia: deps.deletePublicMedia } }));
vi.mock("./profile-resource.service", () => ({ profileResourceService: { finalizeAvatar: deps.finalizeAvatar, finalizeCover: deps.finalizeCover, finalizeGallery: deps.finalizeGallery } }));
vi.mock("./mobile-push.service", () => ({ mobilePushService: { sendToUser: vi.fn() } }));
vi.mock("./push.service", () => ({ pushService: { sendToUser: vi.fn() } }));
import { UserModel } from "../model/user.model";
import { ContentSafetyReportModel } from "../model/content-safety.model";
import { PendingUploadModel } from "../model/pending-upload.model";
import { ResourceItemModel } from "../model/resource-item.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { contentSafetyService, ownProfilePreview, queueProfileMedia } from "./content-safety.service";
import { resourceService } from "./resource.service";
import { isResourceReadable, type ResourceAccessContext } from "./resource-access.service";
import { managedUploadService } from "./managed-upload.service";

let database: MongoMemoryServer;
beforeAll(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: "content_safety_test" });
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
}, 60000);
beforeEach(async () => {
  vi.clearAllMocks();
  deps.deletePublicMedia.mockResolvedValue(undefined);
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).deleteMany({})));
});
afterAll(async () => { await mongoose.disconnect(); if (database) await database.stop(); });

async function fixture() {
  const [admin, author, reader, other] = await UserModel.create([
    { email: "admin@safe.test", displayName: "Admin", role: "admin", companyCode: "SAFE" },
    { email: "author@safe.test", displayName: "Author", role: "user", companyCode: "SAFE", photoURL: "https://example.com/approved.jpg" },
    { email: "reader@safe.test", displayName: "Reader", role: "user", companyCode: "SAFE" },
    { email: "other@other.test", displayName: "Other", role: "admin", companyCode: "OTHER" },
  ]);
  const access = (user: typeof reader): ResourceAccessContext => ({
    userId: String(user._id), companyCode: user.companyCode!, role: user.role, permissions: new Set(["resource:read"]),
  });
  return { admin, author, reader, other, access };
}
async function upload(author: Awaited<ReturnType<typeof fixture>>["author"], token: string, url: string, sourceType = "profile.avatar") {
  return PendingUploadModel.create({
    token, companyCode: "SAFE", actorId: String(author._id), sourceType,
    fileName: "photo.jpg", fileUrl: url, storageProvider: "cloudinary", storagePublicId: token,
    expiresAt: new Date(Date.now() + 3600000),
  });
}

it("keeps pending profile photos private and exposes a preview only to their owner", async () => {
  const { author } = await fixture();
  await queueProfileMedia(String(author._id), { photoURL: "https://example.com/new.jpg" });
  const publicUser = await UserModel.findById(author._id);
  expect(publicUser?.photoURL).toBe("https://example.com/approved.jpg");
  expect(publicUser?.pendingProfileMedia).toBeUndefined();
  const own = await ownProfilePreview(await UserModel.findById(author._id).select("+pendingProfileMedia"));
  expect(own?.toObject()).toMatchObject({ photoURL: "https://example.com/new.jpg", profileMediaPending: true });
  expect(own?.toObject().pendingProfileMedia).toBeUndefined();
});

it("approves the current profile proposal and rejects a stale proposal", async () => {
  const { admin, author } = await fixture();
  await queueProfileMedia(String(author._id), { photoURL: "https://example.com/first.jpg" });
  const first = await ContentSafetyReportModel.findOne();
  await queueProfileMedia(String(author._id), { photoURL: "https://example.com/second.jpg" });
  await expect(contentSafetyService.resolve("SAFE", String(first!._id), String(admin._id), "approve")).rejects.toThrow();
  const second = await ContentSafetyReportModel.findOne({ state: "pending" });
  await contentSafetyService.resolve("SAFE", String(second!._id), String(admin._id), "approve");
  expect((await UserModel.findById(author._id))?.photoURL).toBe("https://example.com/second.jpg");
  expect(await contentSafetyService.moderation("SAFE")).toEqual([]);
});

it("rejects new profile media while preserving previously approved photos", async () => {
  const { admin, author } = await fixture();
  await queueProfileMedia(String(author._id), { photoURL: "https://example.com/rejected.jpg" });
  const report = await ContentSafetyReportModel.findOne();
  await contentSafetyService.resolve("SAFE", String(report!._id), String(admin._id), "remove");
  expect((await UserModel.findById(author._id))?.photoURL).toBe("https://example.com/approved.jpg");
  expect((await UserModel.findById(author._id).select("+pendingProfileMedia"))?.pendingProfileMedia).toBeUndefined();
});

it("holds uploads during moderation and preserves accepted files after the normal upload expiry", async () => {
  const { admin, author } = await fixture();
  await upload(author, "owned-upload", "https://example.com/held.jpg");
  await queueProfileMedia(String(author._id), { photoURL: "https://example.com/held.jpg" }, { photoUploadToken: "owned-upload" });
  await PendingUploadModel.updateMany({}, { $set: { expiresAt: new Date(0) } });
  expect((await managedUploadService.purgeExpiredUploadRecords()).scanned).toBe(0);
  const report = await ContentSafetyReportModel.findOne();
  await contentSafetyService.resolve("SAFE", String(report!._id), String(admin._id), "approve");
  expect(deps.finalizeAvatar).toHaveBeenCalled();
  await managedUploadService.purgeExpiredUploadRecords();
  expect(deps.deletePublicMedia).not.toHaveBeenCalled();
  expect((await UserModel.findById(author._id))?.photoURL).toBe("https://example.com/held.jpg");
});

it("rejects an upload token owned by another member", async () => {
  const { author, reader } = await fixture();
  await upload(author, "private-token", "https://example.com/private.jpg");
  await expect(queueProfileMedia(String(reader._id), { photoURL: "https://example.com/private.jpg" }, { photoUploadToken: "private-token" })).rejects.toThrow();
  expect(await ContentSafetyReportModel.countDocuments()).toBe(0);
});

it("hides new resources until approved and prevents transferring or sharing unapproved content", async () => {
  const { admin, author, reader, access } = await fixture();
  const item = await resourceService.createFile("SAFE", { name: "File", fileUrl: "https://example.com/file.pdf" }, { uid: String(author._id) });
  expect(item.awaitingReview).toBe(true);
  expect(isResourceReadable(item, access(author))).toBe(true);
  expect(isResourceReadable(item, access(reader))).toBe(false);
  await expect(resourceService.updateShares("SAFE", String(item._id), [{ targetType: "user", targetId: String(reader._id), targetName: "Reader" }], String(author._id), "user")).rejects.toThrow();
  await expect(resourceService.move("SAFE", String(item._id), null, String(author._id), "user", null, String(reader._id))).rejects.toThrow();
  const report = await ContentSafetyReportModel.findOne();
  await contentSafetyService.resolve("SAFE", String(report!._id), String(admin._id), "approve");
  expect(isResourceReadable((await ResourceItemModel.findById(item._id))!, access(reader))).toBe(true);
});

it("prevents restoring a resource removed by moderation", async () => {
  const { admin, author, access } = await fixture();
  const item = await resourceService.createFile("SAFE", { name: "File", fileUrl: "https://example.com/file.pdf" }, { uid: String(author._id) });
  const report = await ContentSafetyReportModel.findOne();
  await contentSafetyService.resolve("SAFE", String(report!._id), String(admin._id), "remove");
  expect(isResourceReadable((await ResourceItemModel.findById(item._id))!, access(author))).toBe(false);
  await expect(resourceService.restore("SAFE", String(item._id), String(author._id), "user")).rejects.toThrow();
});

it("allows reporting inherited folder shares and rejects reports across Chapters", async () => {
  const { author, reader, other, access } = await fixture();
  const folder = await ResourceItemModel.create({ companyCode: "SAFE", section: "local", type: "folder", name: "Shared", creatorUid: String(author._id), shares: [{ targetType: "user", targetId: String(reader._id) }] });
  const item = await ResourceItemModel.create({ companyCode: "SAFE", section: "local", type: "file", name: "Shared file", parentId: String(folder._id), creatorUid: String(author._id) });
  await expect(contentSafetyService.report(access(reader), "resource", String(item._id), "spam", "Report")).resolves.toBeTruthy();
  await expect(contentSafetyService.report(access(other), "resource", String(item._id), "spam", "Report")).rejects.toThrow();
});

it("removes a reported profile photo from its source and cached chat avatars", async () => {
  const { admin, author, reader, access } = await fixture();
  const item = await ResourceItemModel.create({ companyCode: "SAFE", section: "local", type: "file", name: "Avatar", creatorUid: String(author._id),
    managedType: "system", requiredPermissions: ["resource:read"], fileUrl: author.photoURL, sourceEntityType: "user", sourceEntityId: String(author._id), sourceField: "photoURL" });
  const message = await ChatMessageModel.create({ roomId: new mongoose.Types.ObjectId(), senderId: author._id, senderName: author.displayName, senderPhoto: author.photoURL, content: "Hi" });
  const report = await contentSafetyService.report(access(reader), "resource", String(item._id), "sexual", "Report");
  await contentSafetyService.resolve("SAFE", String(report._id), String(admin._id), "remove");
  expect((await UserModel.findById(author._id))?.photoURL).toBe("");
  expect((await ChatMessageModel.findById(message._id))?.senderPhoto).toBe("");
});

it("never partially suspends an admin and restricts decisions to the owning Chapter", async () => {
  const { admin, reader, other, access } = await fixture();
  const report = await contentSafetyService.report(access(reader), "profile", String(admin._id), "other", "Report");
  await expect(contentSafetyService.resolve("OTHER", String(report._id), String(other._id), "remove")).rejects.toThrow();
  await expect(contentSafetyService.resolve("SAFE", String(report._id), String(admin._id), "suspend")).rejects.toThrow();
  expect((await UserModel.findById(admin._id))?.displayName).toBe("Admin");
  expect((await ContentSafetyReportModel.findById(report._id))?.state).toBe("pending");
});

it("keeps valid pending reviews visible after more than 100 stale entries", async () => {
  const { author } = await fixture();
  await ContentSafetyReportModel.insertMany(Array.from({ length: 105 }, () => ({
    companyCode: "SAFE", targetType: "profile", targetId: String(new mongoose.Types.ObjectId()),
    reporterId: author._id, reportedUserId: author._id, reason: "other",
  })));
  await queueProfileMedia(String(author._id), { photoURL: "https://example.com/new.jpg" });
  expect(await contentSafetyService.moderation("SAFE")).toHaveLength(1);
});

it("releases a superseded upload without exposing or deleting the new proposal", async () => {
  const { author } = await fixture();
  await upload(author, "first-upload", "https://example.com/first.jpg");
  await queueProfileMedia(String(author._id), { photoURL: "https://example.com/first.jpg" }, { photoUploadToken: "first-upload" });
  await upload(author, "second-upload", "https://example.com/second.jpg");
  await queueProfileMedia(String(author._id), { photoURL: "https://example.com/second.jpg" }, { photoUploadToken: "second-upload" });
  expect((await PendingUploadModel.findOne({ token: "first-upload" }))?.heldForReview).toBe(false);
  expect((await PendingUploadModel.findOne({ token: "second-upload" }))?.heldForReview).toBe(true);
});

it("does not hold any upload when another token in the same proposal is invalid", async () => {
  const { author, reader } = await fixture();
  await upload(author, "valid-photo", "https://example.com/valid.jpg");
  await upload(reader, "foreign-cover", "https://example.com/foreign.jpg", "profile.cover");
  await expect(queueProfileMedia(String(author._id), { photoURL: "https://example.com/valid.jpg", coverImage: "https://example.com/foreign.jpg" },
    { photoUploadToken: "valid-photo", coverUploadToken: "foreign-cover" })).rejects.toThrow();
  expect((await PendingUploadModel.findOne({ token: "valid-photo" }))?.heldForReview).toBe(false);
  expect(await ContentSafetyReportModel.countDocuments()).toBe(0);
});

it("releases upload holds if saving the review fails", async () => {
  const { author } = await fixture();
  await upload(author, "save-failure", "https://example.com/failure.jpg");
  const create = vi.spyOn(ContentSafetyReportModel, "create").mockRejectedValueOnce(new Error("Database write failed"));
  try {
    await expect(queueProfileMedia(String(author._id), { photoURL: "https://example.com/failure.jpg" }, { photoUploadToken: "save-failure" })).rejects.toThrow("Database write failed");
  } finally { create.mockRestore(); }
  expect((await PendingUploadModel.findOne({ token: "save-failure" }))?.heldForReview).toBe(false);
});

it("retains gallery uploads through edits and releases all of them after rejection", async () => {
  const { admin, author } = await fixture();
  await upload(author, "gallery-first", "https://example.com/gallery-first.jpg", "profile.gallery");
  await queueProfileMedia(String(author._id), { galleryImages: ["https://example.com/gallery-first.jpg"] }, { galleryUploadTokens: [{ index: 0, uploadToken: "gallery-first" }] });
  await upload(author, "gallery-second", "https://example.com/gallery-second.jpg", "profile.gallery");
  await queueProfileMedia(String(author._id), { galleryImages: ["https://example.com/gallery-first.jpg", "https://example.com/gallery-second.jpg"] }, { galleryUploadTokens: [{ index: 1, uploadToken: "gallery-second" }] });
  const report = await ContentSafetyReportModel.findOne({ state: "pending" });
  expect(await PendingUploadModel.countDocuments({ heldForReview: true })).toBe(2);
  await contentSafetyService.resolve("SAFE", String(report!._id), String(admin._id), "remove");
  expect(await PendingUploadModel.countDocuments({ heldForReview: true })).toBe(0);
});
