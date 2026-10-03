import { expect, it } from "vitest";
import { chatBlockState } from "./chatBlocking";
import type { ChatRoom } from "../../services/internalChatService";
const room = { isGroup: false, members: [{ userId: { _id: "me" } }, { userId: { _id: "other" } }] } as ChatRoom;
it("distinguishes who can unblock without allowing one user to clear the other's block", () => {
  expect(chatBlockState({ ...room, blockedBy: ["me"] }, "me")).toEqual({ canBlock: true, blockedByMe: true, isBlocked: true });
  expect(chatBlockState({ ...room, blockedBy: ["other"] }, "me")).toEqual({ canBlock: true, blockedByMe: false, isBlocked: true });
  expect(chatBlockState({ ...room, blockedBy: [] }, "me").isBlocked).toBe(false);
});
it("excludes groups, AI and self-chat and supports rooms created before blocking existed", () => {
  for (const value of [null, { ...room, isGroup: true }, { ...room, isChatbot: true }, { ...room, members: room.members.slice(0, 1) }]) {
    expect(chatBlockState(value, "me").canBlock).toBe(false);
  }
  expect(chatBlockState(room, "me").isBlocked).toBe(false);
});