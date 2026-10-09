import { MobilePushTokenModel } from "../model/mobile-push-token.model";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

type ExpoTicket = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

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
    return TOKEN_PATTERN.test(token);
  },

  async saveToken(input: {
    uid: string;
    companyCode: string;
    token: string;
    platform: "android" | "ios";
    deviceName?: string;
  }) {
    if (!this.isValidToken(input.token)) throw new Error("Expo Push Token không hợp lệ.");
    return MobilePushTokenModel.findOneAndUpdate(
      { token: input.token },
      { ...input, lastSeenAt: new Date() },
      { upsert: true, returnDocument: "after" },
    );
  },

  async removeToken(uid: string, token: string) {
    await MobilePushTokenModel.deleteOne({ uid, token });
  },

  async sendToUser(uid: string, payload: MobilePushPayload): Promise<void> {
    const devices = await MobilePushTokenModel.find({ uid }).select("token").lean();
    if (devices.length === 0) return;

    for (const batch of chunks(devices, 100)) {
      const messages = batch.map(({ token }) => ({
        to: token,
        title: payload.title,
        body: payload.body,
        sound: "default",
        priority: "high",
        channelId: "default",
        data: {
          notificationId: payload.notificationId,
          type: payload.type,
          route: "/notifications",
        },
      }));
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      if (!response.ok) throw new Error(`Expo Push Service trả về HTTP ${response.status}.`);

      const result = await response.json() as { data?: ExpoTicket[] | ExpoTicket };
      const tickets = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      const invalidTokens = tickets.flatMap((ticket, index) =>
        ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
          ? [batch[index]?.token]
          : [],
      ).filter((token): token is string => Boolean(token));
      if (invalidTokens.length > 0) {
        await MobilePushTokenModel.deleteMany({ token: { $in: invalidTokens } });
      }
    }
  },
};
