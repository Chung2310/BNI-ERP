import { entityId } from "../../src/utils/entityId";
import { Types } from "mongoose";
import { ChatUserBlockModel, ChatReportModel } from "../model/chat-safety.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { UserModel } from "../model/user.model";
import { ResourceItemModel } from "../model/resource-item.model";
import { chatResourceIndexingService } from "./chat-resource-indexing.service";
import { emitToUser, disconnectUserSockets } from "../socket";
import { mobilePushService } from "./mobile-push.service";
import { pushService } from "./push.service";
import { privatePushContent } from "./private-push-content";

export { assertSafeContentText as assertSafeChatText } from "../utils/content-filter";

export async function blockedChatPeers(userId: string, companyCode: string) {
  const rows = await ChatUserBlockModel.find({ companyCode, $or: [{ userId }, { blockedUserId: userId }] }).lean();
  return rows.map(row => String(row.userId) === userId ? String(row.blockedUserId) : String(row.userId));
}

export function visibleChatMessage(message: unknown, userId: string, peers: string[]) {
  if (!message || typeof message !== "object") return true;
  const row = message as { senderId?: unknown; awaitingReview?: boolean };
  return !peers.includes(entityId(row.senderId)) && (!row.awaitingReview || entityId(row.senderId) === userId);
}

export function sanitizeChatRoom<T extends { lastMessage?: unknown; pinnedMessageIds?: unknown[] }>(room: T, userId: string, peers: string[]): T {
  if ("toObject" in room && typeof room.toObject === "function") room = room.toObject() as T;
  return { ...room, lastMessage: visibleChatMessage(room.lastMessage, userId, peers) ? room.lastMessage : undefined,
    pinnedMessageIds: room.pinnedMessageIds?.filter(message => visibleChatMessage(message, userId, peers)) };
}

export function emitSafeChatToUser(userId: string, event: string, payload: unknown) {
  void (async () => {
    const user = await UserModel.findById(userId).select("companyCode").lean();
    if (!user) return;
    const peers = await blockedChatPeers(userId, user.companyCode || "SYSTEM");
    const data = payload as { message?: unknown; roomUpdate?: { lastMessage?: unknown; pinnedMessageIds?: unknown[] }; members?: unknown[]; lastMessage?: unknown; pinnedMessageIds?: unknown[] };
    if (!visibleChatMessage(data.message, userId, peers)) return;
    const message = data.message as { toObject?: () => Record<string, unknown>; replyTo?: unknown } | undefined;
    const safeMessage = message ? { ...(message.toObject ? message.toObject() : message), ...(!visibleChatMessage(message.replyTo, userId, peers) ? { replyTo: null } : {}) } : undefined;
    const safe = data.members ? sanitizeChatRoom(data, userId, peers) : { ...data, ...(safeMessage ? { message: safeMessage } : {}), ...(data.roomUpdate ? { roomUpdate: sanitizeChatRoom(data.roomUpdate, userId, peers) } : {}) };
    emitToUser(userId, event, safe);
  })().catch(error => console.error("[ChatSafety] Delivery failed", error));
}

export function sanitizeChatResponse(value: unknown, userId: string, peers: string[]): unknown {
  if (Array.isArray(value)) return value.map(item => sanitizeChatResponse(item, userId, peers)).filter(item => item !== null);
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  if (row.senderId && ("content" in row || "attachments" in row) && !visibleChatMessage(row, userId, peers)) return null;
  return Object.fromEntries(Object.entries(row).map(([key, item]) => [key, sanitizeChatResponse(item, userId, peers)]));
}

export const chatSafetyService = {
  async setBlock(userId: string, companyCode: string, targetId: string, blocked: boolean) {
    if (targetId === userId) throw new Error("Bạn không thể chặn chính mình.");
    const target = await UserModel.exists({ _id: targetId, companyCode, deletionRequestedAt: null });
    if (!target) throw new Error("Thành viên không thuộc Chapter của bạn.");
    if (blocked) await ChatUserBlockModel.updateOne({ companyCode, userId, blockedUserId: targetId }, { $setOnInsert: { companyCode, userId, blockedUserId: targetId } }, { upsert: true });
    else await ChatUserBlockModel.deleteOne({ companyCode, userId, blockedUserId: targetId });
    emitToUser(userId, "internal_safety_changed", {});
    emitToUser(targetId, "internal_safety_changed", {});
  },
  async report(userId: string, companyCode: string, roomId: string, messageId: string, reason: "harassment" | "sexual" | "violence" | "spam" | "other", details: string) {
    if (!await ChatRoomModel.exists({ _id: roomId, companyCode, "members.userId": userId, isChatbot: { $ne: true } })) throw new Error("Bạn không có quyền truy cập cuộc trò chuyện.");
    const message = await ChatMessageModel.findOne({ _id: messageId, roomId, isDeleted: { $ne: true } }).lean();
    if (!message || String(message.senderId) === userId) throw new Error("Không thể báo cáo tin nhắn này.");
    return ChatReportModel.findOneAndUpdate({ reporterId: userId, messageId, reason }, { $setOnInsert: { companyCode, roomId, reportedUserId: message.senderId, details } }, { upsert: true, returnDocument: "after" });
  },
  async resolve(companyCode: string, reportId: string, moderatorId: string, action: "approve" | "remove" | "suspend" | "dismiss") {
    const report = await ChatReportModel.findOne({ _id: reportId, companyCode, state: "pending" });
    if (!report) throw new Error("Báo cáo không còn chờ xử lý.");
    const message = await ChatMessageModel.findById(report.messageId);
    const room = await ChatRoomModel.findOne({ _id: report.roomId, companyCode });
    if (!room) throw new Error("Cuộc trò chuyện đã bị xóa.");
    if (action === "dismiss" && report.reason === "media_review") throw new Error("Chọn duyệt hoặc gỡ nội dung đính kèm.");
    if (action === "approve" && report.reason !== "media_review") throw new Error("Chỉ dùng duyệt với nội dung đính kèm đang chờ.");
    if (message && action === "approve" && !message.isDeleted) {
      const sender = await UserModel.findById(message.senderId).lean();
      if (!sender || sender.deletionRequestedAt || sender.disabledAt) throw new Error("Tài khoản gửi không còn hoạt động.");
      message.awaitingReview = false;
      await message.save();
      await chatResourceIndexingService.finalizeMessage({ companyCode, actorId: String(sender._id), actorName: sender.displayName || sender.email }, message, room);
      const { chatService } = await import("./chat.service");
      const fullRoom = await chatService.getFullRoom(String(room._id));
      const peers = await blockedChatPeers(String(sender._id), companyCode);
      for (const member of room.members) {
        const recipient = entityId(member.userId);
        emitSafeChatToUser(recipient, "internal_new_message", { roomId: String(room._id), message, roomUpdate: fullRoom });
        if (recipient !== String(sender._id) && !peers.includes(recipient)) {
          const content = privatePushContent(true);
          await Promise.allSettled([mobilePushService.sendToUser(recipient, { ...content, type: "chat", notificationId: String(message._id), route: `/chat/${room._id}` }), pushService.sendToUser(recipient, { ...content, url: "/tro-chuyen", tag: `chat-${room._id}` })]);
        }
      }
    }
    if (message && (action === "remove" || action === "suspend")) {
      message.isDeleted = true; message.awaitingReview = false; message.content = ""; message.attachments = [];
      await message.save();
      await ResourceItemModel.deleteMany({ sourceRecordId: String(message._id), sourceEntityType: "chat-room" });
      const { chatService } = await import("./chat.service");
      const fullRoom = await chatService.getFullRoom(String(room._id));
      for (const member of room.members) emitSafeChatToUser(entityId(member.userId), "internal_message_deleted", { roomId: String(room._id), messageId: String(message._id), message, roomUpdate: fullRoom });
    }
    if (action === "suspend") {
      const result = await UserModel.updateOne({ _id: report.reportedUserId, companyCode, role: { $nin: ["admin", "superadmin"] } }, { $set: { disabledAt: new Date(), isActive: false, activeSessionId: "" } });
      if (!result.matchedCount) throw new Error("Không thể đình chỉ quản trị viên từ màn hình này; nội dung đã được gỡ.");
      disconnectUserSockets(String(report.reportedUserId));
    }
    report.state = "resolved"; report.action = action; report.moderatorId = new Types.ObjectId(moderatorId); report.resolvedAt = new Date();
    report.expiresAt = new Date(Date.now() + 30 * 86400000);
    await report.save();
    return report;
  },
};
