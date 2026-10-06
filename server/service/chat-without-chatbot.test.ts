import { afterEach, expect, it, vi } from "vitest";
import { chatService } from "./chat.service";
import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";

afterEach(() => vi.restoreAllMocks());

it("lists only internal rooms and does not create a chatbot room", async () => {
  const cloudExec = vi.fn().mockResolvedValue({ _id: "cloud" });
  const findOne = vi.spyOn(ChatRoomModel, "findOne").mockReturnValue({ exec: cloudExec } as never);
  const rooms = [{ _id: "room-1", members: [{ userId: "member-1", isPinned: false }], updatedAt: new Date() }];
  const roomQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  roomQuery.populate = vi.fn(() => roomQuery);
  roomQuery.sort = vi.fn(() => roomQuery);
  roomQuery.lean = vi.fn(() => roomQuery);
  roomQuery.exec = vi.fn().mockResolvedValue(rooms);
  const find = vi.spyOn(ChatRoomModel, "find").mockReturnValue(roomQuery as never);
  vi.spyOn(ChatMessageModel, "countDocuments").mockResolvedValue(0);

  await expect(chatService.getRooms("member-1", "BNI")).resolves.toEqual([{ ...rooms[0], unreadCount: 0 }]);
  expect(findOne).toHaveBeenCalledTimes(1);
  expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ isGroup: false, isChatbot: { $ne: true } }));
  expect(find).toHaveBeenCalledWith({ companyCode: "BNI", isChatbot: { $ne: true }, "members.userId": "member-1" });
});

it("rejects direct access to a legacy chatbot room", async () => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.populate = vi.fn(() => query);
  query.exec = vi.fn().mockResolvedValue(null);
  const findOne = vi.spyOn(ChatRoomModel, "findOne").mockReturnValue(query as never);

  await expect(chatService.getRoomById("legacy-bot", "member-1", "BNI")).rejects.toThrow(/không có quyền truy cập/i);
  expect(findOne).toHaveBeenCalledWith({
    _id: "legacy-bot",
    companyCode: "BNI",
    isChatbot: { $ne: true },
    "members.userId": "member-1",
  });
});
