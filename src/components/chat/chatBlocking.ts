import type { ChatRoom } from "../../services/internalChatService";
export function chatBlockState(room: ChatRoom | null, userId: string) {
  const canBlock = !!room && !room.isGroup && !room.isChatbot && room.members.length === 2;
  return {
    canBlock,
    blockedByMe: canBlock && !!room.blockedBy?.includes(userId),
    isBlocked: canBlock && !!room.blockedBy?.length,
  };
}