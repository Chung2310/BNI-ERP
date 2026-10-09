import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  lean: vi.fn(),
  sendEachForMulticast: vi.fn(),
}));

vi.mock("../config/firebase-admin", () => ({
  getFirebaseMessaging: () => ({ sendEachForMulticast: dependencies.sendEachForMulticast }),
}));

vi.mock("../model/mobile-push-token.model", () => ({
  MobilePushTokenModel: {
    findOneAndUpdate: dependencies.findOneAndUpdate,
    deleteOne: dependencies.deleteOne,
    deleteMany: dependencies.deleteMany,
    find: vi.fn(() => ({
      select: vi.fn(() => ({ lean: dependencies.lean })),
    })),
  },
}));

import { mobilePushService } from "./mobile-push.service";

describe("mobilePushService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed and legacy Expo push tokens", async () => {
    await expect(mobilePushService.saveToken({
      uid: "member",
      companyCode: "ACME",
      token: "not-a-push-token",
      platform: "android",
    })).rejects.toThrow("không hợp lệ");
    await expect(mobilePushService.saveToken({
      uid: "member",
      companyCode: "ACME",
      token: "ExpoPushToken[legacy_device_123]",
      platform: "ios",
    })).rejects.toThrow("không hợp lệ");
    expect(dependencies.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("upserts an FCM token and reassigns it to the authenticated user", async () => {
    const token = "fcm_registration_token_123456789";
    dependencies.findOneAndUpdate.mockResolvedValue({ token });
    await mobilePushService.saveToken({
      uid: "member",
      companyCode: "ACME",
      token: ` ${token} `,
      platform: "ios",
      deviceName: "iPhone",
    });

    expect(dependencies.findOneAndUpdate).toHaveBeenCalledWith(
      { token },
      expect.objectContaining({
        uid: "member",
        companyCode: "ACME",
        platform: "ios",
        provider: "fcm",
        token,
      }),
      { upsert: true, returnDocument: "after" },
    );
  });

  it("only removes a token owned by the authenticated user", async () => {
    dependencies.deleteOne.mockResolvedValue({ deletedCount: 1 });
    await mobilePushService.removeToken("member", " fcm_registration_token_123456789 ");
    expect(dependencies.deleteOne).toHaveBeenCalledWith({
      uid: "member",
      token: "fcm_registration_token_123456789",
    });
  });

  it("sends a platform-aware Firebase multicast and removes permanently invalid tokens", async () => {
    dependencies.lean.mockResolvedValue([
      { token: "fcm_registration_token_valid_123" },
      { token: "fcm_registration_token_stale_456" },
    ]);
    dependencies.sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        { success: false, error: { code: "messaging/registration-token-not-registered" } },
      ],
    });

    await mobilePushService.sendToUser("member", {
      title: "Thông báo mới",
      body: "Nội dung",
      notificationId: "notification-id",
      type: "he-thong",
    });

    expect(dependencies.sendEachForMulticast).toHaveBeenCalledWith(expect.objectContaining({
      tokens: ["fcm_registration_token_valid_123", "fcm_registration_token_stale_456"],
      notification: { title: "Thông báo mới", body: "Nội dung" },
      data: expect.objectContaining({ notificationId: "notification-id", route: "/notifications" }),
      android: expect.objectContaining({ priority: "high" }),
      apns: expect.objectContaining({ headers: expect.objectContaining({ "apns-push-type": "alert" }) }),
    }));
    expect(dependencies.deleteMany).toHaveBeenCalledWith({
      token: { $in: ["fcm_registration_token_stale_456"] },
    });
  });

  it("surfaces Firebase credential failures instead of silently dropping every push", async () => {
    dependencies.lean.mockResolvedValue([{ token: "fcm_registration_token_123456789" }]);
    dependencies.sendEachForMulticast.mockResolvedValue({
      responses: [{ success: false, error: { code: "messaging/mismatched-credential" } }],
    });

    await expect(mobilePushService.sendToUser("member", {
      title: "Thong bao",
      body: "Noi dung",
      notificationId: "notification-id",
      type: "he-thong",
    })).rejects.toThrow("messaging/mismatched-credential");
  });
});
