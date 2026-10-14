import bcrypt from "bcryptjs";
import { afterEach, expect, it, vi } from "vitest";
const sockets = vi.hoisted(() => ({ disconnectUserSockets: vi.fn() }));
vi.mock("../socket", () => sockets);
import { authService } from "./auth.service";
import { UserModel } from "../model/user.model";
import { AccountDeletionModel } from "../model/account-deletion.model";
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
it("queues deletion of only the authenticated account and revokes access after verification", async () => {
  vi.spyOn(UserModel, "findById").mockResolvedValue({ _id: "me", email: "me@example.com", role: "user", password: bcrypt.hashSync("password", 4) });
  vi.spyOn(AccountDeletionModel, "exists").mockResolvedValue(null);
  const queue = vi.spyOn(AccountDeletionModel, "create").mockResolvedValue(undefined);
  const revoke = vi.spyOn(UserModel, "updateOne").mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
  const result = await authService.deleteOwnAccount("me", "password", "XÓA TÀI KHOẢN");
  expect(queue).toHaveBeenCalledWith(expect.objectContaining({ userId: "me", receiptHash: expect.any(String) }));
  expect(result.receiptToken).toMatch(/^[a-f0-9]{64}$/);
  expect(queue.mock.calls[0][0]).not.toHaveProperty("receiptToken");
  expect(queue.mock.calls[0][0]).not.toHaveProperty("password");
  expect(revoke).toHaveBeenCalledWith({ _id: "me" }, expect.objectContaining({ $set: expect.objectContaining({ isActive: false, deletionRequestedAt: expect.any(Date) }) }));
  expect(sockets.disconnectUserSockets).toHaveBeenCalledWith("me");
});
it("does not delete or disconnect when password verification fails", async () => {
  vi.spyOn(UserModel, "findById").mockResolvedValue({ role: "user", companyCode: "BNI", password: bcrypt.hashSync("password", 4) });
  const queue = vi.spyOn(AccountDeletionModel, "create");
  await expect(authService.deleteOwnAccount("me", "wrong", "XÓA TÀI KHOẢN")).rejects.toThrow();
  expect(queue).not.toHaveBeenCalled();
  expect(sockets.disconnectUserSockets).not.toHaveBeenCalled();
});
