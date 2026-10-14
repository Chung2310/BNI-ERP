import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";

const deps = vi.hoisted(() => ({ emitToUser: vi.fn(), disconnectUserSockets: vi.fn(), deleteOwnedMedia: vi.fn(), finalizeMessage: vi.fn(), sendToUser: vi.fn() }));
vi.mock("../socket", () => ({ emitToUser: deps.emitToUser, disconnectUserSockets: deps.disconnectUserSockets, isUserOnline: vi.fn().mockResolvedValue(false) }));
vi.mock("./cloudinary.service", () => ({ cloudinaryService: { deleteOwnedMedia: deps.deleteOwnedMedia, listAccountProfileMedia: vi.fn().mockResolvedValue([]) } }));
vi.mock("./chat-resource-indexing.service", () => ({ chatResourceIndexingService: { finalizeMessage: deps.finalizeMessage } }));
vi.mock("./mobile-push.service", () => ({ mobilePushService: { sendToUser: deps.sendToUser } }));
vi.mock("./push.service", () => ({ pushService: { sendToUser: deps.sendToUser } }));
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { ChatReportModel, ChatUserBlockModel } from "../model/chat-safety.model";
import { AccountDeletionModel } from "../model/account-deletion.model";
import { OwnedMediaModel } from "../model/owned-media.model";
import { chatService } from "./chat.service";
import { assertSafeChatText, chatSafetyService } from "./chat-safety.service";
import { accountDeletionService, processAccountDeletionQueue } from "./account-deletion.service";
import { chatRouter } from "../router/chat.router";

let database: MongoMemoryServer;
let server: Server;
let baseUrl: string;
const secret = "chat-safety-test-secret-not-production";
beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = secret;
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: "chat_safety_test" });
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  const app = express(); app.use(express.json()); app.use("/api/v1/chat", chatRouter);
  server = await new Promise<Server>(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No test port");
  baseUrl = `http://127.0.0.1:${address.port}/api/v1/chat`;
}, 60000);
beforeEach(async () => {
  vi.clearAllMocks(); deps.deleteOwnedMedia.mockResolvedValue(undefined); deps.finalizeMessage.mockResolvedValue([]); deps.sendToUser.mockResolvedValue(undefined);
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).deleteMany({})));
});
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await mongoose.disconnect(); if (database) await database.stop(); });

async function fixture() {
  const [admin, sender, receiver, outsider] = await UserModel.create([
    { email: "admin@test.vn", displayName: "Admin", role: "admin", companyCode: "SAFE", password: bcrypt.hashSync("password", 4) },
    { email: "sender@test.vn", displayName: "Sender", role: "user", companyCode: "SAFE", password: bcrypt.hashSync("password", 4) },
    { email: "receiver@test.vn", displayName: "Receiver", role: "user", companyCode: "SAFE" },
    { email: "other@test.vn", displayName: "Other", role: "admin", companyCode: "OTHER" },
  ]);
  await CompanyModel.create([{ code: "SAFE", name: "Safety Chapter", ownerEmail: admin.email, isBniChapter: true }, { code: "OTHER", name: "Other Chapter", ownerEmail: outsider.email, isBniChapter: true }]);
  const room = await ChatRoomModel.create({ companyCode: "SAFE", creatorId: admin._id, isGroup: true, name: "Test group", members: [{ userId: admin._id, role: "admin" }, { userId: sender._id }, { userId: receiver._id }] });
  return { admin, sender, receiver, outsider, room };
}
function token(user: { _id: unknown; email: string; role: string; companyCode?: string }) { return jwt.sign({ id: String(user._id), email: user.email, role: user.role, companyCode: user.companyCode }, secret); }
async function request(path: string, user: Parameters<typeof token>[0], method = "GET", body?: unknown) {
  const response = await fetch(baseUrl + path, { method, headers: { Authorization: `Bearer ${token(user)}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}

it("rejects obvious abuse including zero-width obfuscation before storing messages", async () => {
  const { sender, room } = await fixture();
  expect(() => assertSafeChatText("i will ki\u200bll you")).toThrow();
  await expect(chatService.sendMessage(String(room._id), String(sender._id), "Tao sẽ giết mày", [], "SAFE")).rejects.toThrow();
  expect(await ChatMessageModel.countDocuments()).toBe(0);
  expect(() => assertSafeChatText("Chào mọi người, hẹn gặp ở cuộc họp")).not.toThrow();
});

it("blocks senders across groups, history, searches, quoted messages, room previews and direct chat", async () => {
  const { sender, receiver, admin, outsider, room } = await fixture();
  const message = await chatService.sendMessage(String(room._id), String(sender._id), "hello", [], "SAFE");
  await chatSafetyService.setBlock(String(receiver._id), "SAFE", String(sender._id), true);
  await expect(chatSafetyService.setBlock(String(receiver._id), "SAFE", String(outsider._id), true)).rejects.toThrow();
  expect(await chatService.getMessages(String(room._id), String(receiver._id), "SAFE")).toHaveLength(0);
  expect(await chatService.searchMessages(String(room._id), String(receiver._id), "SAFE", "hello")).toHaveLength(0);
  expect((await chatService.getRoomById(String(room._id), String(receiver._id), "SAFE")).lastMessage).toBeUndefined();
  const reply = await chatService.sendMessage(String(room._id), String(admin._id), "reply", [], "SAFE", String(message._id));
  const visible = await chatService.getMessages(String(room._id), String(receiver._id), "SAFE");
  expect(visible[0]._id.toString()).toBe(reply._id.toString()); expect(visible[0].replyTo).toBeNull();
  const direct = await ChatRoomModel.create({ companyCode: "SAFE", creatorId: sender._id, isGroup: false, members: [{ userId: sender._id }, { userId: receiver._id }] });
  await expect(chatService.sendMessage(String(direct._id), String(sender._id), "hello", [], "SAFE")).rejects.toMatchObject({ statusCode: 403 });
  await chatSafetyService.setBlock(String(receiver._id), "SAFE", String(sender._id), false);
  expect(await chatService.getMessages(String(room._id), String(receiver._id), "SAFE")).toHaveLength(2);
});

it("stores idempotent reports, restricts moderation to the Chapter and removes or suspends offending content", async () => {
  const { sender, receiver, admin, outsider, room } = await fixture();
  const message = await chatService.sendMessage(String(room._id), String(sender._id), "reported", [], "SAFE");
  const path = `/rooms/${room._id}/messages/${message._id}/report`;
  expect((await request(path, outsider, "POST", { reason: "spam" })).status).toBe(400);
  expect((await request(path, receiver, "POST", { reason: "spam", details: "Unwanted message" })).status).toBe(200);
  await request(path, receiver, "POST", { reason: "spam" });
  expect(await ChatReportModel.countDocuments()).toBe(1);
  expect((await request("/moderation", receiver)).status).toBe(403);
  expect((await request("/moderation", outsider)).body.data).toEqual([]);
  const report = await ChatReportModel.findOne();
  expect((await request(`/moderation/${report!._id}`, outsider, "PATCH", { action: "suspend" })).status).toBe(400);
  expect((await request(`/moderation/${report!._id}`, admin, "PATCH", { action: "suspend" })).status).toBe(200);
  expect((await ChatMessageModel.findById(message._id))?.isDeleted).toBe(true);
  expect((await UserModel.findById(sender._id))?.disabledAt).toBeInstanceOf(Date);
  expect((await request("/rooms", sender)).status).toBe(401);
});

it("keeps new media private until approved and indexes it only after moderation", async () => {
  const { sender, receiver, admin, room } = await fixture();
  const message = await chatService.sendMessage(String(room._id), String(sender._id), "attachment", [{ url: "https://example.com/image.png", name: "image.png", type: "image/png" }], "SAFE");
  expect(message.awaitingReview).toBe(true); expect(deps.finalizeMessage).not.toHaveBeenCalled();
  expect(await chatService.getMessages(String(room._id), String(receiver._id), "SAFE")).toHaveLength(0);
  expect(await chatService.getMessages(String(room._id), String(sender._id), "SAFE")).toHaveLength(1);
  const report = await ChatReportModel.findOne({ reason: "media_review" });
  await chatSafetyService.resolve("SAFE", String(report!._id), String(admin._id), "approve");
  expect(deps.finalizeMessage).toHaveBeenCalledTimes(1);
  expect(await chatService.getMessages(String(room._id), String(receiver._id), "SAFE")).toHaveLength(1);
});

it("does not send sockets or push to a blocked recipient and sanitizes mutation responses", async () => {
  const { sender, receiver, admin, room } = await fixture();
  await chatSafetyService.setBlock(String(receiver._id), "SAFE", String(sender._id), true);
  deps.emitToUser.mockClear(); deps.sendToUser.mockClear();
  const sent = await request(`/rooms/${room._id}/messages`, sender, "POST", { content: "ordinary message", attachments: [] });
  expect(sent.status).toBe(201);
  await vi.waitFor(() => expect(deps.emitToUser).toHaveBeenCalledWith(String(admin._id), "internal_new_message", expect.any(Object)));
  expect(deps.emitToUser.mock.calls.some(([recipient, event]) => recipient === String(receiver._id) && event === "internal_new_message")).toBe(false);
  expect(deps.sendToUser.mock.calls.some(([recipient]) => recipient === String(receiver._id))).toBe(false);
  const direct = await request("/rooms", receiver, "POST", { isGroup: false, memberIds: [String(sender._id)] });
  expect(direct.status).toBe(201);
  expect(direct.body.data.lastMessage).toBeFalsy();
});

it("rejects media before sharing and clears content and attachments", async () => {
  const { sender, receiver, admin, room } = await fixture();
  const message = await chatService.sendMessage(String(room._id), String(sender._id), "attachment", [{ url: "https://example.com/image.png", name: "image.png", type: "image/png" }], "SAFE");
  const report = await ChatReportModel.findOne({ messageId: message._id });
  await chatSafetyService.resolve("SAFE", String(report!._id), String(admin._id), "remove");
  expect((await ChatMessageModel.findById(message._id))?.attachments).toHaveLength(0);
  expect(deps.finalizeMessage).not.toHaveBeenCalled();
  const history = await chatService.getMessages(String(room._id), String(receiver._id), "SAFE");
  expect(history[0].isDeleted).toBe(true); expect(history[0].content).toBe("");
});

it("does not transfer administration when accepting the deletion job fails", async () => {
  const { admin, receiver } = await fixture();
  const create = vi.spyOn(AccountDeletionModel, "create").mockRejectedValueOnce(new Error("Write unavailable"));
  await expect(accountDeletionService.request(String(admin._id), "password", "XÓA TÀI KHOẢN", String(receiver._id))).rejects.toThrow("Write unavailable");
  create.mockRestore();
  expect((await UserModel.findById(receiver._id))?.role).toBe("user");
  expect((await CompanyModel.findOne({ code: "SAFE" }))?.ownerEmail).toBe(admin.email);
  expect((await UserModel.findById(admin._id))?.deletionRequestedAt).toBeNull();
});

it("retries failed cloud deletion, clears safety data and deletes only the requesting account", async () => {
  const { sender, receiver, room } = await fixture();
  const message = await chatService.sendMessage(String(room._id), String(sender._id), "mine", [], "SAFE");
  await chatSafetyService.report(String(receiver._id), "SAFE", String(room._id), String(message._id), "other", "test");
  await chatSafetyService.setBlock(String(receiver._id), "SAFE", String(sender._id), true);
  await OwnedMediaModel.create({ userId: String(sender._id), publicId: "account-owned-image", resourceType: "image", url: "https://example.com/image" });
  const receipt = await accountDeletionService.request(String(sender._id), "password", "XÓA TÀI KHOẢN");
  deps.deleteOwnedMedia.mockRejectedValueOnce(new Error("Transient cloud failure"));
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await processAccountDeletionQueue(); log.mockRestore();
  expect((await accountDeletionService.status(receipt.receiptToken)).state).toBe("pending");
  expect(await UserModel.exists({ _id: sender._id })).not.toBeNull();
  await AccountDeletionModel.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
  await processAccountDeletionQueue();
  expect((await accountDeletionService.status(receipt.receiptToken)).state).toBe("completed");
  expect(await UserModel.exists({ _id: sender._id })).toBeNull();
  expect(await UserModel.exists({ _id: receiver._id })).not.toBeNull();
  expect(await ChatReportModel.countDocuments()).toBe(0); expect(await ChatUserBlockModel.countDocuments()).toBe(0);
  expect(deps.deleteOwnedMedia).toHaveBeenCalledWith("account-owned-image", "image", "upload");
});
