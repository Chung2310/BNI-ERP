import type { IChatRoom } from "../interface/chat-room.interface";

export function assertChatNotBlocked(room: Pick<IChatRoom, "isGroup" | "blockedBy">): void {
  if (!room.isGroup && room.blockedBy?.length) {
    throw Object.assign(new Error("Cuộc trò chuyện đang bị chặn. Không thể gửi hoặc tương tác tin nhắn."), { statusCode: 403 });
  }
}