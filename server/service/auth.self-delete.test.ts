import bcrypt from "bcryptjs";
import { afterEach, expect, it, vi } from "vitest";
const sockets = vi.hoisted(() => ({ disconnectUserSockets: vi.fn() }));
vi.mock("../socket", () => sockets);
import { authService } from "./auth.service";
import { UserModel } from "../model/user.model";
import { PushSubscriptionModel } from "../model/push-subscription.model";
import { MobilePushTokenModel } from "../model/mobile-push-token.model";
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
it("deletes only the authenticated account after verification and revokes notifications and sockets", async () => {
  vi.spyOn(UserModel, "findById").mockResolvedValue({ role: "user", companyCode: "BNI", password: bcrypt.hashSync("password", 4) });
  const remove = vi.spyOn(authService, "deleteUser").mockResolvedValue();
  const push = vi.spyOn(PushSubscriptionModel, "deleteMany").mockResolvedValue(({ deletedCount: 1 } as unknown as Parameters<((value: Awaited<ReturnType<typeof PushSubscriptionModel.deleteMany>>) => void)>[0]));
  const mobilePush = vi.spyOn(MobilePushTokenModel, "deleteMany").mockResolvedValue(({ deletedCount: 1 } as unknown as Parameters<((value: Awaited<ReturnType<typeof MobilePushTokenModel.deleteMany>>) => void)>[0]));
  await authService.deleteOwnAccount("me", "password", "XÓA TÀI KHOẢN");
  expect(remove).toHaveBeenCalledWith("me", "BNI", "user");
  expect(sockets.disconnectUserSockets).toHaveBeenCalledWith("me");
  expect(push).toHaveBeenCalledWith({ uid: "me" });
  expect(mobilePush).toHaveBeenCalledWith({ uid: "me" });
});
it("does not delete or disconnect when password verification fails", async () => {
  vi.spyOn(UserModel, "findById").mockResolvedValue({ role: "user", companyCode: "BNI", password: bcrypt.hashSync("password", 4) });
  const remove = vi.spyOn(authService, "deleteUser").mockResolvedValue();
  await expect(authService.deleteOwnAccount("me", "wrong", "XÓA TÀI KHOẢN")).rejects.toThrow();
  expect(remove).not.toHaveBeenCalled();
  expect(sockets.disconnectUserSockets).not.toHaveBeenCalled();
});
