import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock("../model/mobile-push-token.model", () => ({
  MobilePushTokenModel: {
    findOneAndUpdate: dependencies.findOneAndUpdate,
    deleteOne: dependencies.deleteOne,
  },
}));

import { mobilePushService } from "./mobile-push.service";

describe("mobilePushService device registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed Expo push tokens", async () => {
    await expect(mobilePushService.saveToken({
      uid: "member",
      companyCode: "ACME",
      token: "not-a-push-token",
      platform: "android",
    })).rejects.toThrow("không hợp lệ");
    expect(dependencies.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("upserts a valid token and reassigns it to the current authenticated user", async () => {
    dependencies.findOneAndUpdate.mockResolvedValue({ token: "ExpoPushToken[device_123]" });
    await mobilePushService.saveToken({
      uid: "member",
      companyCode: "ACME",
      token: "ExpoPushToken[device_123]",
      platform: "ios",
      deviceName: "iPhone",
    });

    expect(dependencies.findOneAndUpdate).toHaveBeenCalledWith(
      { token: "ExpoPushToken[device_123]" },
      expect.objectContaining({ uid: "member", companyCode: "ACME", platform: "ios" }),
      { upsert: true, returnDocument: "after" },
    );
  });

  it("only removes a token owned by the authenticated user", async () => {
    dependencies.deleteOne.mockResolvedValue({ deletedCount: 1 });
    await mobilePushService.removeToken("member", "ExpoPushToken[device_123]");
    expect(dependencies.deleteOne).toHaveBeenCalledWith({
      uid: "member",
      token: "ExpoPushToken[device_123]",
    });
  });
});
