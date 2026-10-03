import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findOne: vi.fn(), findOneAndUpdate: vi.fn(), findById: vi.fn(), message: vi.fn(), sender: vi.fn() }));
vi.mock("../model/chat-room.model", () => ({ ChatRoomModel: { findOne: mocks.findOne, findOneAndUpdate: mocks.findOneAndUpdate, findById: mocks.findById } }));
vi.mock("../model/chat-message.model", () => ({ ChatMessageModel: mocks.message }));
vi.mock("../model/user.model", () => ({ UserModel: { findById: mocks.sender } }));
vi.mock("./chat-resource-indexing.service", () => ({ chatResourceIndexingService: {} }));
import { chatService } from "./chat.service";
import { assertChatNotBlocked } from "./chat-blocking";
import { setRoomBlockedSchema } from "../validation/chat.validation";

beforeEach(() => vi.resetAllMocks());

it.each([true, false])("changes only the acting member's block using an atomic operation: %s", async (blocked) => {
  const updated = { _id: "room", blockedBy: blocked ? ["me", "other"] : ["other"] };
  mocks.findOneAndUpdate.mockResolvedValue(updated);
  const query = { populate: vi.fn(), exec: vi.fn().mockResolvedValue(updated) };
  query.populate.mockReturnValue(query);
  mocks.findById.mockReturnValue(query);
  expect(await chatService.setRoomBlocked("room", "me", "BNI", blocked)).toEqual(updated);
  expect(mocks.findOneAndUpdate).toHaveBeenCalledWith({
    _id: "room", companyCode: "BNI", isGroup: false, isChatbot: { $ne: true }, members: { $size: 2 }, "members.userId": "me",
  }, blocked ? { $addToSet: { blockedBy: "me" } } : { $pull: { blockedBy: "me" } }, { returnDocument: "after" });
});

it("rejects unmatched rooms instead of changing another tenant, nonmember, group, bot or self-chat", async () => {
  mocks.findOneAndUpdate.mockResolvedValue(null);
  await expect(chatService.setRoomBlocked("room", "outsider", "OTHER", true)).rejects.toThrow("1–1");
  expect(mocks.findById).not.toHaveBeenCalled();
});

it.each(["me", "other"])("refuses text and attachment sends when %s has blocked the room", async (blocker) => {
  mocks.findOne.mockResolvedValue({ isGroup: false, blockedBy: [blocker] });
  await expect(chatService.sendMessage("room", "me", "text", [], "BNI")).rejects.toMatchObject({ statusCode: 403 });
  await expect(chatService.sendMessage("room", "me", "", [{ url: "/file", name: "audio", type: "audio/webm" }], "BNI")).rejects.toMatchObject({ statusCode: 403 });
  expect(mocks.sender).not.toHaveBeenCalled();
  expect(mocks.message).not.toHaveBeenCalled();
});

it("refuses edits and reactions to existing messages while blocked", async () => {
  mocks.findOne.mockResolvedValue({ isGroup: false, blockedBy: ["other"] });
  await expect(chatService.editMessage("room", "message", "me", "BNI", "new text")).rejects.toMatchObject({ statusCode: 403 });
  await expect(chatService.toggleReaction("room", "message", "me", "BNI", "👍")).rejects.toMatchObject({ statusCode: 403 });
});

it("allows legacy rooms and conversations after all parties unblock", () => {
  expect(() => assertChatNotBlocked({ isGroup: false })).not.toThrow();
  expect(() => assertChatNotBlocked({ isGroup: false, blockedBy: [] })).not.toThrow();
  expect(() => assertChatNotBlocked({ isGroup: false, blockedBy: ["other"] })).toThrow();
});

it("requires an explicit boolean and rejects arbitrary blocker ids", () => {
  expect(setRoomBlockedSchema.body.validate({ blocked: true }).error).toBeUndefined();
  expect(setRoomBlockedSchema.body.validate({ blocked: false }).error).toBeUndefined();
  for (const payload of [{}, { blocked: "false" }, { blocked: true, userId: "other" }]) {
    expect(setRoomBlockedSchema.body.validate(payload).error).toBeDefined();
  }
});