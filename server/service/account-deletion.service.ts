import { createHash, randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { AccountDeletionModel } from "../model/account-deletion.model";
import { ContentSafetyReportModel } from "../model/content-safety.model";
import { OwnedMediaModel } from "../model/owned-media.model";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { BranchModel } from "../model/branch.model";
import { OperatingExpenseModel } from "../model/operating-expense.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { ChatReportModel, ChatUserBlockModel } from "../model/chat-safety.model";
import { ResourceItemModel } from "../model/resource-item.model";
import { ResourceModel } from "../model/resource.model";
import { PendingUploadModel } from "../model/pending-upload.model";
import { MembershipApplicationModel } from "../model/membership-application.model";
import { ChapterLeaveRequestModel } from "../model/chapter-leave-request.model";
import { PushSubscriptionModel } from "../model/push-subscription.model";
import { MobilePushTokenModel } from "../model/mobile-push-token.model";
import { NotificationModel } from "../model/notification.model";
import { CelebrationDeliveryModel } from "../model/celebration-delivery.model";
import { MeetingModel, MeetingDeliveryModel } from "../modules/meetings/meeting.model";
import { MeetingInteractionModel, MeetingInteractionResponseModel } from "../modules/meetings/meeting-interaction.model";
import { MemberFeeModel } from "../modules/member-fees/member-fee.model";
import { SePayTransactionModel } from "../modules/member-fees/sepay.model";
import { verifySelfAccountDeletion } from "./self-account-deletion";
import { cloudinaryService } from "./cloudinary.service";
import { getCompanyDriveContext } from "./company-drive-context.service";
import { DriveFileService } from "./drive-file.service";
import type { IUser } from "../interface/user.interface";

const hashReceipt = (value: string) => createHash("sha256").update(value).digest("hex");
const removedName = "Tài khoản đã xóa";
type Asset = { provider: "cloudinary" | "google-drive"; publicId: string; resourceType: string; access: string; companyCode?: string };

async function deletionOptions(user: IUser) {
  const company = user.companyCode ? await CompanyModel.findOne({ code: user.companyCode }).lean() : null;
  const managesCompany = user.role === "admin" || company?.ownerEmail?.toLowerCase() === user.email.toLowerCase();
  const candidates = managesCompany && user.companyCode ? await UserModel.find({
    _id: { $ne: user._id }, companyCode: user.companyCode,
    isActive: { $ne: false }, deletionRequestedAt: null, disabledAt: null,
  }).select("displayName role email").sort({ createdAt: 1 }).lean() : [];
  return {
    requiresTransfer: managesCompany && candidates.length > 0,
    archivesChapter: managesCompany && candidates.length === 0 && Boolean(company),
    successors: candidates.map((candidate) => ({ id: String(candidate._id), name: candidate.displayName, role: candidate.role })),
  };
}

export const accountDeletionService = {
  async options(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    return deletionOptions(user);
  },
  async request(userId: string, password: string, confirmation: string, successorId?: string) {
    const user = await UserModel.findById(userId);
    await verifySelfAccountDeletion(user, password, confirmation);
    if (user!.deletionRequestedAt) throw new Error("Yêu cầu xóa tài khoản đã được tiếp nhận.");
    if (await AccountDeletionModel.exists({ successorId: userId, state: { $ne: "completed" }, administrationTransferred: { $ne: true } })) throw new Error("Bạn đang nhận quyền quản trị từ một yêu cầu xóa khác. Vui lòng thử lại sau khi chuyển quyền hoàn tất.");
    const options = await deletionOptions(user!);
    if (options.requiresTransfer && !options.successors.some((candidate) => candidate.id === successorId)) {
      throw new Error("Vui lòng chọn thành viên đang hoạt động trong cùng Chapter để nhận quyền quản trị.");
    }
    if (successorId && !options.requiresTransfer) throw new Error("Tài khoản này không cần chuyển quyền quản trị.");
    if (await AccountDeletionModel.exists({ userId })) throw new Error("Yêu cầu xóa tài khoản đã được tiếp nhận.");
    const receiptToken = randomBytes(32).toString("hex");
    await AccountDeletionModel.create({ userId, successorId, receiptHash: hashReceipt(receiptToken) });
    // The durable job also performs revocation if this write is interrupted.
    await UserModel.updateOne({ _id: userId }, { $set: { deletionRequestedAt: new Date(), isActive: false, activeSessionId: "" } })
      .catch((error) => console.error("[AccountDeletion] Revocation will be retried", error));
    const { disconnectUserSockets } = await import("../socket");
    try { disconnectUserSockets(userId); } catch (error) { console.error("[AccountDeletion] Socket revocation failed", error); }
    return { receiptToken, state: "pending" as const };
  },
  async status(receipt: string) {
    if (!/^[a-f0-9]{64}$/.test(receipt)) throw new Error("Mã theo dõi không hợp lệ.");
    const job = await AccountDeletionModel.findOne({ receiptHash: hashReceipt(receipt) }).select("state requestedAt completedAt").lean();
    if (!job) throw new Error("Không tìm thấy yêu cầu hoặc mã theo dõi đã hết hạn.");
    return { state: job.state, requestedAt: job.requestedAt, completedAt: job.completedAt };
  },
};

// Pre-registry uploads have only delivery URLs. Accept our cloud and versioned,
// untransformed URLs; never send arbitrary user supplied paths to a storage API.
function legacyCloudinaryAsset(value: string): Asset | null {
  try {
    const url = new URL(value);
    const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
    if (url.hostname !== "res.cloudinary.com" || !process.env.CLOUDINARY_CLOUD_NAME || parts[0] !== process.env.CLOUDINARY_CLOUD_NAME) return null;
    if (!["image", "video", "raw"].includes(parts[1]) || !["upload", "authenticated"].includes(parts[2]) || !/^v\d+$/.test(parts[3])) return null;
    const publicId = parts.slice(4).join("/");
    if (!publicId || publicId.split("/").some((part) => part === ".." || part === ".")) return null;
    return { provider: "cloudinary", publicId: parts[1] === "raw" ? publicId : publicId.replace(/\.[^/.]+$/, ""), resourceType: parts[1], access: parts[2] };
  } catch { return null; }
}

async function inventory(user: IUser): Promise<Asset[]> {
  const userId = String(user._id);
  const [resources, pending, messages, owned, drive] = await Promise.all([
    ResourceItemModel.find({ $or: [{ creatorUid: userId }, { sourceEntityType: "user", sourceEntityId: userId }] }).lean(),
    PendingUploadModel.find({ actorId: userId }).lean(),
    ChatMessageModel.find({ senderId: userId }).select("attachments").lean(),
    OwnedMediaModel.find({ userId }).lean(),
    ResourceModel.find({ uploadedBy: userId }).lean(),
  ]);
  const assets: Asset[] = owned.map((row) => ({ provider: "cloudinary", publicId: row.publicId, resourceType: row.resourceType, access: "upload" }));
  // Replaced avatars/covers uploaded before ownership tracking still live in a
  // server-assigned per-account folder, even when no longer in the profile.
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    for (const oldProfile of await cloudinaryService.listAccountProfileMedia(userId)) {
      if (!await OwnedMediaModel.exists({ publicId: oldProfile.publicId, userId: { $ne: userId } })) assets.push({ provider: "cloudinary", publicId: oldProfile.publicId, resourceType: oldProfile.resourceType, access: "upload" });
    }
  }
  for (const row of [...resources, ...pending]) {
    if (row.storageProvider === "cloudinary" && row.storagePublicId) assets.push({
      provider: "cloudinary", publicId: row.storagePublicId, resourceType: row.storageResourceType || "image",
      access: "storageAccess" in row && row.storageAccess === "authenticated" ? "authenticated" : "upload",
    });
  }
  for (const row of drive) assets.push({ provider: "google-drive", publicId: row.driveFileId, resourceType: "raw", access: "", companyCode: row.companyCode });
  for (const url of [user.photoURL, user.coverImage, ...(user.galleryImages || []), ...messages.flatMap((row) => row.attachments.map((item) => item.url)), ...resources.map((row) => row.fileUrl)]) {
    if (!url) continue;
    const asset = legacyCloudinaryAsset(url);
    if (!asset) continue;
    // A pasted URL is not proof of ownership. Do not destroy another account's asset.
    const sharedOwner = await OwnedMediaModel.exists({ publicId: asset.publicId, userId: { $ne: userId } });
    const sharedProfile = await UserModel.exists({ _id: { $ne: userId }, $or: [{ photoURL: url }, { coverImage: url }, { galleryImages: url }] });
    const sharedResource = await ResourceItemModel.exists({ creatorUid: { $ne: userId }, sourceEntityId: { $ne: userId }, fileUrl: url });
    const sharedMessage = await ChatMessageModel.exists({ senderId: { $ne: userId }, "attachments.url": url });
    if (!sharedOwner && !sharedProfile && !sharedResource && !sharedMessage) assets.push(asset);
  }
  return [...new Map(assets.map((asset) => [`${asset.provider}:${asset.resourceType}:${asset.access}:${asset.publicId}`, asset])).values()];
}

async function eraseDatabaseData(user: IUser, successorId: string | undefined, tombstone: string) {
  const userId = String(user._id);
  const objectId = user._id;
  await ChatUserBlockModel.deleteMany({ $or: [{ userId: objectId }, { blockedUserId: objectId }] });
  await ChatReportModel.deleteMany({ $or: [{ reporterId: objectId }, { reportedUserId: objectId }, { messageId: { $in: (await ChatMessageModel.find({ senderId: objectId }).select("_id").lean()).map(row => row._id) } }] });
  await ChatReportModel.updateMany({ moderatorId: objectId }, { $unset: { moderatorId: 1 } });
  const ownMessages = await ChatMessageModel.find({ senderId: objectId }).select("_id roomId createdAt").lean();
  const messageIds = ownMessages.map((row) => row._id);
  await ChatMessageModel.updateMany({ replyTo: { $in: messageIds } }, { $unset: { replyTo: 1 } });
  await ChatRoomModel.updateMany({}, { $pull: { pinnedMessageIds: { $in: messageIds } } });
  await ChatRoomModel.updateMany({ lastMessage: { $in: messageIds } }, { $unset: { lastMessage: 1 } });
  await ChatMessageModel.deleteMany({ senderId: objectId });
  await ChatMessageModel.updateMany({}, { $pull: { readBy: objectId, reactions: { userId: objectId } } });
  const rooms = await ChatRoomModel.find({ $or: [{ "members.userId": objectId }, { creatorId: objectId }] });
  for (const room of rooms) {
    room.members = room.members.filter((member) => String(member.userId) !== userId);
    room.blockedBy = (room.blockedBy || []).filter((id) => String(id) !== userId);
    if (!room.members.length) { await ChatMessageModel.deleteMany({ roomId: room._id }); await room.deleteOne(); continue; }
    if (!room.members.some((member) => member.role === "admin")) room.members[0].role = "admin";
    if (String(room.creatorId) === userId) room.creatorId = room.members.find((member) => member.role === "admin")!.userId;
    // Direct rooms may use the former member's name/photo as their title.
    if (!room.isGroup) { room.name = removedName; room.avatarURL = ""; room.hasDeletedMember = true; }
    const latest = await ChatMessageModel.findOne({ roomId: room._id }).sort({ createdAt: -1 }).select("_id").lean();
    room.lastMessage = latest?._id;
    await room.save();
    try {
      const { emitToUser } = await import("../socket");
      const { chatService } = await import("./chat.service");
      const updated = await chatService.getFullRoom(String(room._id));
      for (const member of room.members) {
        emitToUser(String(member.userId), "internal_room_updated", updated);
        for (const message of ownMessages.filter((item) => String(item.roomId) === String(room._id))) {
          emitToUser(String(member.userId), "internal_message_deleted", {
            roomId: String(room._id), messageId: String(message._id), roomUpdate: updated,
            message: { _id: String(message._id), roomId: String(room._id), senderId: tombstone, senderName: removedName, senderPhoto: "", content: "", attachments: [], readBy: [], reactions: [], isDeleted: true, createdAt: message.createdAt },
          });
        }
      }
    } catch (error) { console.error("[AccountDeletion] Room refresh event failed", error); }
  }
  // Shared folders survive; their children belonging to other accounts are moved up.
  const folders = await ResourceItemModel.find({ creatorUid: userId, type: "folder" }).select("_id parentId").lean();
  for (const folder of folders) await ResourceItemModel.updateMany({ parentId: String(folder._id), creatorUid: { $ne: userId } }, { $set: { parentId: null } });
  await ResourceItemModel.deleteMany({ $or: [{ creatorUid: userId }, { sourceEntityType: "user", sourceEntityId: userId }] });
  await ResourceItemModel.updateMany({}, { $pull: { shares: { targetType: "user", targetId: userId }, sourceAudienceIds: userId } });
  await ResourceModel.deleteMany({ uploadedBy: objectId });
  await PendingUploadModel.deleteMany({ actorId: userId });
  await ContentSafetyReportModel.deleteMany({ $or: [{ reporterId: objectId }, { reportedUserId: objectId }, { moderatorId: objectId }, { targetType: "profile", targetId: userId }] });
  await MembershipApplicationModel.deleteMany({ applicantUserId: objectId });
  await MembershipApplicationModel.updateMany({ decidedBy: objectId }, { $unset: { decidedBy: 1 } });
  await ChapterLeaveRequestModel.deleteMany({ userId: objectId });
  await ChapterLeaveRequestModel.updateMany({ decidedBy: objectId }, { $unset: { decidedBy: 1 } });
  await PushSubscriptionModel.deleteMany({ uid: userId });
  await MobilePushTokenModel.deleteMany({ uid: userId });
  await NotificationModel.deleteMany({ recipientUid: userId });
  await CelebrationDeliveryModel.deleteMany({ $or: [{ recipientUserId: userId }, { recipientEmail: user.email }] });
  await MeetingDeliveryModel.deleteMany({ email: user.email });
  await mongoose.connection.collection("user_activity_events").deleteMany({ userId: objectId });
  // Keep meeting timing/order and aggregate totals without the member's identity.
  const redact = (row: string) => ({ $cond: [{ $or: [{ $eq: [`$$${row}.userId`, userId] }, { $eq: [`$$${row}.email`, user.email] }] }, {
    $mergeObjects: [`$$${row}`, { id: { $cond: [{ $eq: [`$$${row}.id`, userId] }, tombstone, `$$${row}.id`] }, userId: null, deletedAccount: true, name: removedName, email: "", phone: "", company: "", industry: "", bio: "", photoURL: "", coverImage: "", slideProfile: null, winnerId: tombstone, drawnBy: "", verificationHash: "", seed: "", timestamp: "" }],
  }, { $mergeObjects: [`$$${row}`, { drawnBy: { $cond: [{ $eq: [`$$${row}.drawnBy`, userId] }, "", `$$${row}.drawnBy`] } }] }] });
  // Pipeline avoids shifting currentIndex for an ongoing meeting.
  await MeetingModel.updateMany({ $or: [{ createdBy: userId }, { "speakers.userId": userId }, { "speakers.email": user.email }, { "gameWinners.userId": userId }, { "gameWinners.email": user.email }, { "gameWinners.drawnBy": userId }, { "luckyDraw.prizes.winners.userId": userId }, { "luckyDraw.prizes.winners.email": user.email }, { "luckyDraw.prizes.winners.drawnBy": userId }, { "presentation.drawParticipantIds": userId }] }, [{ $set: {
    speakers: { $map: { input: { $ifNull: ["$speakers", []] }, as: "person", in: redact("person") } },
    gameWinners: { $map: { input: { $ifNull: ["$gameWinners", []] }, as: "winner", in: redact("winner") } },
    "luckyDraw.prizes": { $map: { input: { $ifNull: ["$luckyDraw.prizes", []] }, as: "prize", in: { $mergeObjects: ["$$prize", { winners: { $map: { input: { $ifNull: ["$$prize.winners", []] }, as: "winner", in: redact("winner") } } }] } } },
    createdBy: { $cond: [{ $eq: ["$createdBy", userId] }, successorId || "", "$createdBy"] },
    "presentation.drawParticipantIds": { $filter: { input: { $ifNull: ["$presentation.drawParticipantIds", []] }, as: "id", cond: { $ne: ["$$id", userId] } } },
  } }], { updatePipeline: true });
  await MeetingInteractionResponseModel.deleteMany({ participantId: { $in: [userId, `user:${userId}`] } });
  await MeetingInteractionModel.updateMany({ createdBy: userId }, { $set: { createdBy: successorId || tombstone } });
  const fees = await MemberFeeModel.find({ memberId: userId }).select("_id").lean();
  await NotificationModel.deleteMany({ "action.feeId": { $in: fees.map((fee) => String(fee._id)) } });
  await SePayTransactionModel.updateMany({ feeId: { $in: fees.map((fee) => String(fee._id)) } }, { $set: { payload: { redactedForAccountDeletion: true }, reason: "" } });
  await MemberFeeModel.updateMany({ memberId: userId }, [{ $set: { memberId: tombstone, memberName: removedName, memberEmail: "", note: "", title: "Khoản thu đã ẩn danh", titleKey: { $concat: ["deleted-", { $toString: "$_id" }] } } }], { updatePipeline: true });
  await MemberFeeModel.updateMany({ createdBy: userId }, { $set: { createdBy: tombstone } });
  await MemberFeeModel.updateMany({ "payments.recordedBy": userId }, { $set: { "payments.$[payment].recordedBy": tombstone } }, { arrayFilters: [{ "payment.recordedBy": userId }] });
  await MemberFeeModel.updateMany({ "payments.voidedBy": userId }, { $set: { "payments.$[payment].voidedBy": tombstone } }, { arrayFilters: [{ "payment.voidedBy": userId }] });
  await MemberFeeModel.updateMany({ memberId: tombstone }, { $set: { "payments.$[].note": "", "payments.$[].reference": "", "payments.$[].voidReason": "" } });
  const nextParent = successorId || user.parentId;
  await UserModel.updateMany({ parentId: userId }, nextParent ? { $set: { parentId: nextParent } } : { $unset: { parentId: 1 } });
  await BranchModel.updateMany({ managerId: userId }, { $set: { managerId: successorId || "", pendingOwnerSetup: !successorId } });
  await OperatingExpenseModel.updateMany({ createdBy: userId }, { $set: { createdBy: tombstone, description: "Khoản chi đã ẩn danh" } });
  if (!successorId && user.companyCode) {
    const company = await CompanyModel.findOne({ code: user.companyCode }).lean();
    if (company && (user.role === "admin" || company.ownerEmail === user.email)) {
      await CompanyModel.updateOne({ _id: company._id }, { $set: { ...(company.ownerEmail === user.email ? { ownerEmail: "" } : {}), lifecycleStatus: "archived", lifecycleChangedAt: new Date() } });
    }
  }
}

export async function processAccountDeletionQueue() {
  // A lease and claim token prevent two backend instances from running one job.
  const claimToken = randomUUID();
  const now = new Date();
  const job = await AccountDeletionModel.findOneAndUpdate({ state: { $ne: "completed" }, nextAttemptAt: { $lte: now }, $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }] }, {
    $set: { state: "processing", leaseUntil: new Date(Date.now() + 120_000), claimToken }, $inc: { attempts: 1 },
  }, { returnDocument: "after", sort: { requestedAt: 1 } });
  if (!job) return;
  const lease = setInterval(() => { void AccountDeletionModel.updateOne({ _id: job._id, claimToken }, { $set: { leaseUntil: new Date(Date.now() + 120_000) } }).catch((error) => console.error("[AccountDeletion] Lease renewal failed", error)); }, 30_000);
  lease.unref();
  const persist = async (fields: Record<string, unknown>) => {
    const result = await AccountDeletionModel.updateOne({ _id: job._id, claimToken, leaseUntil: { $gt: new Date() } }, { $set: fields });
    if (!result.matchedCount) throw new Error("Account deletion lease was lost");
  };
  try {
    const user = job.userId ? await UserModel.findById(job.userId) : null;
    if (user) {
      await UserModel.updateOne({ _id: user._id }, { $set: { deletionRequestedAt: job.requestedAt, isActive: false, activeSessionId: "" } });
      const { disconnectUserSockets } = await import("../socket");
      disconnectUserSockets(String(user._id));
      // Administration changes happen only after the durable deletion job exists.
      // Repeating them after a restart is safe. Never promote an account with a deletion job.
      if (job.successorId && !job.administrationTransferred) {
        if (await AccountDeletionModel.exists({ userId: job.successorId, state: { $ne: "completed" } })) throw new Error("The selected successor is deleting their account; administrator assistance is required");
        const successor = await UserModel.findOneAndUpdate({ _id: job.successorId, companyCode: user.companyCode, deletionRequestedAt: null, disabledAt: null, isActive: { $ne: false } }, { $set: { role: "admin" }, $unset: { parentId: 1 } }, { returnDocument: "after" });
        if (!successor) throw new Error("The selected successor is unavailable; administrator assistance is required");
        await CompanyModel.updateOne({ code: user.companyCode }, { $set: { ownerEmail: successor.email } });
        await persist({ administrationTransferred: true });
        job.administrationTransferred = true;
      }
      if (!job.inventoryReady) {
        job.set("assets", await inventory(user));
        job.inventoryReady = true;
        await persist({ assets: job.assets.toObject(), inventoryReady: true });
      }
      await eraseDatabaseData(user, job.successorId, String(job._id));
    }
    // Keep assets in the job until each provider has acknowledged deletion.
    while (job.assets.length) {
      await persist({ leaseUntil: new Date(Date.now() + 120_000) });
      const asset = job.assets[0];
      if (asset.provider === "cloudinary") await cloudinaryService.deleteOwnedMedia(asset.publicId, asset.resourceType || "image", asset.access || "upload");
      else {
        const context = await getCompanyDriveContext(asset.companyCode || "");
        if (!context.authClient) throw new Error("Google Drive is disconnected; asset deletion will be retried");
        try { await DriveFileService.deleteFile(context.authClient, asset.publicId); }
        catch (error) { if ((error as { code?: number }).code !== 404) throw error; }
      }
      job.assets.shift();
      await persist({ assets: job.assets.toObject() });
    }
    if (user) {
      // Uploads that finished during cleanup were registered after the initial inventory.
      const lateMedia = await OwnedMediaModel.find({ userId: String(user._id) }).lean();
      for (const media of lateMedia) {
        await cloudinaryService.deleteOwnedMedia(media.publicId, media.resourceType);
        await OwnedMediaModel.deleteOne({ _id: media._id });
      }
      await eraseDatabaseData(user, job.successorId, String(job._id));
      await UserModel.deleteOne({ _id: user._id, deletionRequestedAt: { $ne: null } });
    }
    await AccountDeletionModel.updateOne({ _id: job._id, claimToken }, {
      $set: { state: "completed", completedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), assets: [] },
      $unset: { userId: 1, successorId: 1, leaseUntil: 1, claimToken: 1 },
    });
  } catch (error) {
    console.error("[AccountDeletion] Cleanup failed; retry scheduled", String(job._id), error);
    await AccountDeletionModel.updateOne({ _id: job._id, claimToken }, { $set: { state: "pending", nextAttemptAt: new Date(Date.now() + 60_000) }, $unset: { leaseUntil: 1, claimToken: 1 } });
  } finally { clearInterval(lease); }
}

export function startAccountDeletionScheduler() {
  let running = false;
  let lastOrphanScan = 0;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processAccountDeletionQueue();
      if (Date.now() - lastOrphanScan > 60_000) {
        lastOrphanScan = Date.now();
        await purgeOrphanedAccountMedia();
      }
    }
    catch (error) { console.error("[AccountDeletion] Scheduler failed", error); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(run, 5_000);
  timer.unref();
  return () => clearInterval(timer);
}

async function purgeOrphanedAccountMedia() {
  // Catch uploads that finished after the account/job had already been removed.
  const rows = await OwnedMediaModel.aggregate<{ _id: mongoose.Types.ObjectId; publicId: string; resourceType: string }>([
    { $set: { ownerObjectId: { $convert: { input: "$userId", to: "objectId", onError: null, onNull: null } } } },
    { $lookup: { from: UserModel.collection.name, localField: "ownerObjectId", foreignField: "_id", as: "owner" } },
    { $match: { owner: { $size: 0 } } }, { $limit: 100 },
  ]);
  for (const row of rows) {
    try {
      await cloudinaryService.deleteOwnedMedia(row.publicId, row.resourceType);
      await PendingUploadModel.deleteMany({ storagePublicId: row.publicId });
      await OwnedMediaModel.deleteOne({ _id: row._id });
    } catch (error) { console.error("[AccountDeletion] Orphan media cleanup failed; ownership retained", error); }
  }
  const events = await mongoose.connection.collection("user_activity_events").aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $lookup: { from: UserModel.collection.name, localField: "userId", foreignField: "_id", as: "owner" } },
    { $match: { owner: { $size: 0 } } }, { $limit: 500 }, { $project: { _id: 1 } },
  ]).toArray();
  if (events.length) await mongoose.connection.collection("user_activity_events").deleteMany({ _id: { $in: events.map((event) => event._id) } });
}
