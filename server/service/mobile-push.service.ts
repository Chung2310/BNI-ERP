import { getFirebaseMessaging } from "../config/firebase-admin";
import { MobilePushTokenModel } from "../model/mobile-push-token.model";

const MAX_FCM_BATCH_SIZE = 500;
const PERMANENT_TOKEN_ERRORS = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

export type MobilePushPayload = {
  title: string;
  body: string;
  notificationId: string;
  type: string;
};

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export const mobilePushService = {
  isValidToken(token: string) {
    const normalized = token.trim();
    return normalized.length >= 20
      && normalized.length <= 4096
      && !/\s/.test(normalized)
      && !/^(ExponentPushToken|ExpoPushToken)\[/.test(normalized);
  },

  async saveToken(input: {
    uid: string;
    companyCode: string;
    token: string;
    platform: "android" | "ios";
    deviceName?: string;
  }) {
    const token = input.token.trim();
    if (!this.isValidToken(token)) throw new Error("FCM token không hợp lệ.");
    return MobilePushTokenModel.findOneAndUpdate(
      { token },
      { ...input, token, provider: "fcm", lastSeenAt: new Date() },
      { upsert: true, returnDocument: "after" },
    );
  },

  async removeToken(uid: string, token: string) {
    await MobilePushTokenModel.deleteOne({ uid, token: token.trim() });
  },

  async sendToUser(uid: string, payload: MobilePushPayload): Promise<void> {
    const devices = await MobilePushTokenModel.find({ uid }).select("token").lean();
    if (devices.length === 0) return;

    const messaging = getFirebaseMessaging();
    for (const batch of chunks(devices, MAX_FCM_BATCH_SIZE)) {
      const tokens = batch.map(({ token }) => token);
      const result = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          notificationId: payload.notificationId,
          type: payload.type,
          route: "/notifications",
        },
        android: {
          priority: "high",
          notification: { channelId: "default", sound: "default" },
        },
        apns: {
          headers: { "apns-push-type": "alert", "apns-priority": "10" },
          payload: { aps: { sound: "default" } },
        },
      });

      const invalidTokens = result.responses.flatMap((response, index) =>
        !response.success && response.error?.code && PERMANENT_TOKEN_ERRORS.has(response.error.code)
          ? [tokens[index]]
          : [],
      ).filter((token): token is string => Boolean(token));
      if (invalidTokens.length > 0) {
        await MobilePushTokenModel.deleteMany({ token: { $in: invalidTokens } });
      }
    }
  },
};
