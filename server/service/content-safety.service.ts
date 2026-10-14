import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { ContentSafetyReportModel } from "../model/content-safety.model";
import { UserModel } from "../model/user.model";
import { ResourceItemModel, type IResourceItem } from "../model/resource-item.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { PendingUploadModel } from "../model/pending-upload.model";
import type { IUser } from "../interface/user.interface";
import { assertResourceReadable, type ResourceAccessContext } from "./resource-access.service";
import { assertSafeContentText as assertSafeChatText } from "../utils/content-filter";

type MediaValues = NonNullable<IUser["pendingProfileMedia"]>["values"];
type Uploads = NonNullable<IUser["pendingProfileMedia"]>["uploads"];
type Reason = "harassment" | "sexual" | "violence" | "spam" | "other";
const mediaFields = ["photoURL", "coverImage", "galleryImages"] as const;

export function assertSafeProfileText(data: Record<string, unknown>) {
  for (const key of ["displayName", "companyName", "industry", "address", "targetMarket"]) {
    if (typeof data[key] === "string") assertSafeChatText(data[key]);
  }
}

export async function queueProfileMedia(userId: string, changes: MediaValues, uploads?: Uploads) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const user = await UserModel.findById(userId).select("+pendingProfileMedia");
    if (!user || user.deletionRequestedAt || user.disabledAt) throw new Error("Tài khoản không còn hoạt động.");
    const old = user.pendingProfileMedia;
    const values = { ...old?.values, ...changes };
    const nextUploads = { ...old?.uploads, ...Object.fromEntries(Object.entries(uploads || {}).filter(([, value]) => value !== undefined)) };
    if (changes.photoURL !== undefined && !uploads?.photoUploadToken) delete nextUploads.photoUploadToken;
    if (changes.coverImage !== undefined && !uploads?.coverUploadToken) delete nextUploads.coverUploadToken;
    if (changes.galleryImages !== undefined && !uploads?.galleryUploadTokens) delete nextUploads.galleryUploadTokens;
    const revision = randomUUID();
    const uploadRefs = [
      ...(nextUploads.photoUploadToken ? [{ token: nextUploads.photoUploadToken, url: values.photoURL, type: "profile.avatar" }] : []),
      ...(nextUploads.coverUploadToken ? [{ token: nextUploads.coverUploadToken, url: values.coverImage, type: "profile.cover" }] : []),
      ...(nextUploads.galleryUploadTokens || []).map(upload => ({ token: upload.uploadToken, url: values.galleryImages?.[upload.index], type: "profile.gallery" })),
    ];
    // Validate the complete proposal before holding any file.
    const priorUploads = [];
    for (const upload of uploadRefs) {
      if (!upload.url) throw new Error("Ảnh tải lên không khớp hồ sơ. Hãy chọn lại ảnh.");
      const pending = await PendingUploadModel.findOne({
        token: upload.token, actorId: userId, companyCode: user.companyCode || "SYSTEM",
        sourceType: upload.type, fileUrl: upload.url,
        $or: [{ status: "finalized" }, { heldForReview: true }, { expiresAt: { $gt: new Date() } }],
      }).lean();
      if (!pending) throw new Error("Ảnh tải lên không hợp lệ hoặc đã hết hạn. Hãy chọn lại ảnh.");
      priorUploads.push(pending);
    }
    const restoreHolds = async () => {
      for (const prior of priorUploads) {
        try {
          await PendingUploadModel.updateOne({ _id: prior._id, reviewRevision: revision }, {
            $set: { heldForReview: Boolean(prior.heldForReview), ...(prior.reviewRevision ? { reviewRevision: prior.reviewRevision } : {}) },
            ...(!prior.reviewRevision ? { $unset: { reviewRevision: 1 } } : {}),
          });
        } catch (cause) { console.error("[ContentSafety] Upload hold rollback failed", cause); }
      }
    };
    let reportId: Types.ObjectId | undefined;
    let reportCreatedAt: Date | undefined;
    let committed = false;
    try {
      for (const prior of priorUploads) {
        const held = await PendingUploadModel.updateOne({ _id: prior._id, actorId: userId },
          { $set: { heldForReview: true, reviewRevision: revision } });
        if (!held.matchedCount) throw new Error("Ảnh tải lên đã hết hạn. Hãy chọn lại ảnh.");
      }
      const report = await ContentSafetyReportModel.create({
        companyCode: user.companyCode || "SYSTEM", targetType: "profile", targetId: userId,
        reporterId: userId, reportedUserId: userId, reason: "media_review", revision,
        snapshot: { values, uploads: nextUploads },
      });
      reportId = report._id;
      reportCreatedAt = report.createdAt;
      const result = await UserModel.updateOne({
        _id: userId, deletionRequestedAt: null, disabledAt: null,
        "pendingProfileMedia.revision": old?.revision ?? { $exists: false },
      }, { $set: { pendingProfileMedia: { revision, values, uploads: nextUploads } } });
      if (!result.matchedCount) {
        await ContentSafetyReportModel.deleteOne({ _id: reportId });
        await restoreHolds();
        continue;
      }
      committed = true;
    } catch (cause) {
      if (!committed) {
        if (reportId) await ContentSafetyReportModel.deleteOne({ _id: reportId }).catch(error => console.error("[ContentSafety] Review rollback failed", error));
        await restoreHolds();
      }
      throw cause;
    }
    // Once accepted, cleanup failure must not roll back files needed by the durable proposal.
    try {
      if (old?.revision) {
        const pendingUrls = [values.photoURL, values.coverImage, ...(values.galleryImages || [])].filter(Boolean);
        const publishedUrls = [user.photoURL, user.coverImage, ...(user.galleryImages || [])].filter(Boolean);
        await PendingUploadModel.updateMany({ actorId: userId, heldForReview: true, reviewRevision: old.revision, fileUrl: { $nin: [...pendingUrls, ...publishedUrls] } },
          { $set: { heldForReview: false }, $unset: { reviewRevision: 1 } });
        await PendingUploadModel.updateMany({ actorId: userId, heldForReview: true, reviewRevision: old.revision, fileUrl: { $in: pendingUrls } },
          { $set: { reviewRevision: revision } });
      }
      await ContentSafetyReportModel.updateMany({
        targetType: "profile", targetId: userId, reason: "media_review", state: "pending",
        createdAt: { $lt: reportCreatedAt },
      }, { $set: { state: "resolved", action: "dismiss", resolvedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 86400000) } });
    } catch (cause) { console.error("[ContentSafety] Superseded proposal cleanup failed", cause); }
    return;
  }
  throw new Error("Hồ sơ vừa được thay đổi. Vui lòng tải lại rồi thử lại.");
}

export async function ownProfilePreview(user: IUser | null): Promise<IUser | null> {
  if (!user) return null;
  const pending = user.pendingProfileMedia;
  if (pending) {
    // Move a guest's pending review into their Chapter after membership approval.
    await ContentSafetyReportModel.updateMany({
      targetType: "profile", targetId: String(user._id), revision: pending.revision, state: "pending",
    }, { $set: { companyCode: user.companyCode || "SYSTEM" } });
    for (const field of mediaFields) if (pending.values[field] !== undefined) user.set(field, pending.values[field]);
    user.set("profileMediaPending", true, { strict: false });
    user.set("pendingProfileMedia", undefined);
  }
  return user;
}

export async function queueResourceReview(item: IResourceItem) {
  await ContentSafetyReportModel.create({
    companyCode: item.companyCode, targetType: "resource", targetId: String(item._id),
    reporterId: item.creatorUid, reportedUserId: item.creatorUid, reason: "media_review",
  });
}

async function removeResourceSource(item: IResourceItem) {
  if (item.sourceEntityType === "user" && Types.ObjectId.isValid(item.sourceEntityId || "")) {
    const field = item.sourceField || "";
    if (field.startsWith("galleryImages")) {
      await UserModel.updateOne({ _id: item.sourceEntityId, companyCode: item.companyCode }, { $pull: { galleryImages: item.fileUrl } });
    } else if (field === "photoURL" || field === "coverImage") {
      await UserModel.updateOne({ _id: item.sourceEntityId, companyCode: item.companyCode, [field]: item.fileUrl }, { $set: { [field]: "" } });
      if (field === "photoURL") await ChatMessageModel.updateMany({ senderId: item.sourceEntityId, senderPhoto: item.fileUrl }, { $set: { senderPhoto: "" } });
    }
  }
  if (item.sourceEntityType === "chat-room" && Types.ObjectId.isValid(item.sourceRecordId || "")) {
    const message = await ChatMessageModel.findById(item.sourceRecordId);
    const room = message ? await ChatRoomModel.findOne({ _id: message.roomId, companyCode: item.companyCode }) : null;
    if (!message || !room) return;
    message.isDeleted = true; message.awaitingReview = false; message.content = ""; message.attachments = [];
    await message.save();
    await ResourceItemModel.deleteMany({ companyCode: item.companyCode, sourceEntityType: "chat-room", sourceRecordId: String(message._id) });
    const { chatService } = await import("./chat.service");
    const { emitSafeChatToUser } = await import("./chat-safety.service");
    const roomUpdate = await chatService.getFullRoom(String(room._id));
    for (const member of room.members) emitSafeChatToUser(String(member.userId), "internal_message_deleted", { roomId: String(room._id), messageId: String(message._id), message, roomUpdate });
  }
}

async function readableResource(id: string, access: ResourceAccessContext) {
  const item = await ResourceItemModel.findOne({ _id: id, companyCode: access.companyCode, isDeleted: { $ne: true } }).lean();
  if (!item) throw new Error("Không tìm thấy tài nguyên.");
  assertResourceReadable(item, access);
  if (item.managedType === "system" || access.role === "admin" || item.creatorUid === access.userId) return item;
  let current = item;
  const visited = new Set<string>();
  while (current && !visited.has(String(current._id))) {
    visited.add(String(current._id));
    if (current.shares?.some(s => s.targetType === "user" && s.targetId === access.userId)) return item;
    const roomIds = [current.roomId, ...(current.shares || []).filter(s => s.targetType === "room").map(s => s.targetId)].filter(id => Types.ObjectId.isValid(id || ""));
    if (roomIds.length && await ChatRoomModel.exists({ _id: { $in: roomIds }, companyCode: access.companyCode, "members.userId": access.userId })) return item;
    if (!Types.ObjectId.isValid(current.parentId || "")) break;
    const parent = await ResourceItemModel.findOne({ _id: current.parentId, companyCode: access.companyCode, isDeleted: { $ne: true } }).lean();
    if (!parent) break;
    assertResourceReadable(parent, access);
    current = parent;
  }
  throw new Error("Bạn không có quyền truy cập tài nguyên này.");
}

export const contentSafetyService = {
  async report(access: ResourceAccessContext, targetType: "profile" | "resource", targetId: string, reason: Reason, details: string) {
    let owner: string;
    if (targetType === "profile") {
      const user = await UserModel.findOne({ _id: targetId, companyCode: access.companyCode, deletionRequestedAt: null }).select("_id").lean();
      if (!user) throw new Error("Không tìm thấy thành viên trong Chapter.");
      owner = String(user._id);
    } else {
      const resource = await readableResource(targetId, access);
      owner = resource.creatorUid || "";
      if (!Types.ObjectId.isValid(owner)) {
        const admin = await UserModel.findOne({ companyCode: access.companyCode, role: "admin", deletionRequestedAt: null }).select("_id").lean();
        if (!admin) throw new Error("Hãy liên hệ hỗ trợ để báo cáo tài nguyên hệ thống.");
        owner = String(admin._id);
      }
    }
    if (owner === access.userId) throw new Error("Không thể báo cáo nội dung của chính mình.");
    return ContentSafetyReportModel.create({
      companyCode: access.companyCode, targetType, targetId, reporterId: access.userId,
      reportedUserId: owner, reason, details,
    });
  },
  async moderation(companyCode: string) {
    const reports = ContentSafetyReportModel.find({ companyCode, state: "pending" }).sort({ createdAt: 1, _id: 1 }).select("+snapshot").lean().cursor();
    const result = [];
    try {
      for await (const report of reports) {
        if (report.targetType === "profile") {
          const user = await UserModel.findOne({ _id: report.targetId, companyCode, deletionRequestedAt: null }).select("displayName photoURL coverImage galleryImages +pendingProfileMedia").lean();
          if (!user || (report.reason === "media_review" && user.pendingProfileMedia?.revision !== report.revision)) continue;
          const values = report.reason === "media_review" ? user.pendingProfileMedia?.values : user;
          result.push({ ...report, snapshot: undefined, title: user.displayName || "Hồ sơ thành viên",
            attachments: [values?.photoURL, values?.coverImage, ...(values?.galleryImages || [])].filter(Boolean).map((url, index) => ({ url, name: "Ảnh hồ sơ " + (index + 1) })) });
        } else {
          const item = await ResourceItemModel.findOne({ _id: report.targetId, companyCode, isDeleted: { $ne: true } }).lean();
          if (!item) continue;
          result.push({ ...report, snapshot: undefined, title: item.name,
            attachments: item.fileUrl ? [{ url: item.fileUrl, name: item.name }] : [] });
        }
        if (result.length >= 100) break;
      }
    } finally { await reports.close(); }
    return result;
  },
  async resolve(companyCode: string, id: string, moderatorId: string, action: "approve" | "remove" | "suspend" | "dismiss") {
    const report = await ContentSafetyReportModel.findOne({ _id: id, companyCode, state: "pending" }).select("+snapshot");
    if (!report) throw new Error("Báo cáo không còn chờ xử lý.");
    if ((action === "approve" && report.reason !== "media_review") || (action === "dismiss" && report.reason === "media_review")) {
      throw new Error("Chọn duyệt hoặc gỡ đối với nội dung mới đang chờ.");
    }
    // Validate suspension first; never partially remove an admin's content and then fail.
    if (action === "suspend" && !await UserModel.exists({ _id: report.reportedUserId, companyCode, role: { $nin: ["admin", "superadmin"] }, deletionRequestedAt: null })) {
      throw new Error("Không thể đình chỉ quản trị viên từ màn hình này. Bạn có thể gỡ nội dung hoặc liên hệ hỗ trợ.");
    }
    if (report.targetType === "profile" && action !== "dismiss") {
      const match: Record<string, unknown> = { _id: report.targetId, companyCode, deletionRequestedAt: null };
      if (action === "approve") match.disabledAt = null;
      if (report.reason === "media_review") match["pendingProfileMedia.revision"] = report.revision;
      const values = action === "approve" ? report.snapshot?.values : { photoURL: "", coverImage: "", galleryImages: [], displayName: "Thành viên", companyName: "", industry: "", address: "", targetMarket: "", phone: "" };
      if (!values) throw new Error("Không tìm thấy nội dung chờ duyệt.");
      // Rejecting a new upload keeps previously approved photos.
      const update = action === "remove" && report.reason === "media_review"
        ? { $unset: { pendingProfileMedia: 1 } }
        : { $set: values, $unset: { pendingProfileMedia: 1 } };
      const user = await UserModel.findOneAndUpdate(match, update, { returnDocument: "after" });
      if (!user) throw new Error("Hồ sơ đã thay đổi. Hãy tải lại hàng đợi.");
      if (action === "approve" && report.snapshot?.uploads) {
        const { profileResourceService } = await import("./profile-resource.service");
        const actor = { companyCode, actorId: String(user._id), actorName: user.displayName || user.email };
        const uploads = report.snapshot.uploads as Uploads;
        try {
          if (uploads.photoUploadToken) await profileResourceService.finalizeAvatar(actor, user, uploads.photoUploadToken);
          if (uploads.coverUploadToken) await profileResourceService.finalizeCover(actor, user, uploads.coverUploadToken);
          if (uploads.galleryUploadTokens?.length) await profileResourceService.finalizeGallery(actor, user, uploads.galleryUploadTokens);
        } catch (error) { console.error("[ContentSafety] Approved profile resource indexing failed", error); }
      }
      if (action !== "approve" && report.reason !== "media_review") {
        await ChatMessageModel.updateMany({ senderId: report.targetId }, { $set: { senderPhoto: "" } });
        await ResourceItemModel.deleteMany({ companyCode, sourceEntityType: "user", sourceEntityId: report.targetId, sourceField: /^(photoURL|coverImage|galleryImages)/ });
      }
      // Accepted assets must survive upload cleanup even if resource indexing fails.
      if (action === "approve") {
        const approvedUrls = [user.photoURL, user.coverImage, ...(user.galleryImages || [])].filter(Boolean);
        await PendingUploadModel.updateMany({ actorId: report.targetId, heldForReview: true, fileUrl: { $in: approvedUrls } },
          { $set: { status: "finalized", heldForReview: false }, $unset: { reviewRevision: 1 } });
      } else if (report.revision) {
        await PendingUploadModel.updateMany({ actorId: report.targetId, heldForReview: true, reviewRevision: report.revision },
          { $set: { heldForReview: false }, $unset: { reviewRevision: 1 } });
      }
    }
    if (report.targetType === "resource" && action !== "dismiss") {
      const item = await ResourceItemModel.findOne({ _id: report.targetId, companyCode, isDeleted: { $ne: true } });
      if (!item) throw new Error("Tài nguyên đã được gỡ.");
      if (action === "approve" && !await UserModel.exists({ _id: report.reportedUserId, companyCode, deletionRequestedAt: null, disabledAt: null })) throw new Error("Tài khoản gửi không còn hoạt động.");
      const result = await ResourceItemModel.updateOne({ _id: report.targetId, companyCode, isDeleted: { $ne: true } }, {
        $set: action === "approve" ? { awaitingReview: false } : { isDeleted: true, deletedAt: new Date(), awaitingReview: false, moderationRejected: true, shares: [] },
      });
      if (!result.matchedCount) throw new Error("Tài nguyên đã được gỡ.");
      if (action !== "approve") {
        if (item.type === "folder") await ResourceItemModel.updateMany({ companyCode, parentId: String(item._id) }, { $set: { parentId: item.parentId || null } });
        await removeResourceSource(item);
      }
    }
    if (action === "suspend") {
      await UserModel.updateOne({ _id: report.reportedUserId, companyCode, role: { $nin: ["admin", "superadmin"] } }, { $set: { disabledAt: new Date(), isActive: false, activeSessionId: "" } });
      const { disconnectUserSockets } = await import("../socket");
      disconnectUserSockets(String(report.reportedUserId));
    }
    report.state = "resolved"; report.action = action; report.moderatorId = new Types.ObjectId(moderatorId);
    report.resolvedAt = new Date(); report.expiresAt = new Date(Date.now() + 30 * 86400000);
    await report.save();
    return { resolved: true };
  },
};
