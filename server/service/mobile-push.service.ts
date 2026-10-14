import { getFirebaseMessaging } from "../config/firebase-admin";
import { MobilePushTokenModel } from "../model/mobile-push-token.model";
import { privatePushContent } from "./private-push-content";

const MAX_FCM_BATCH_SIZE = 500;
const MAX_EXPO_BATCH_SIZE = 100;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const PERMANENT_FCM_TOKEN_ERRORS = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

export type MobilePushPayload = {
  title: string;
  body: string;
  notificationId: string;
  type: string;
  route?: string;
};

type MobilePushProvider = "fcm" | "expo";
type MobilePushPlatform = "android" | "ios";
type MobilePushDevice = { token: string; provider: MobilePushProvider; platform: MobilePushPlatform };
type DeliverySummary = { successCount: number; failureCodes: string[] };
type ExpoPushTicket = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function isExpoPushToken(token: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]\s]+\]$/.test(token);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function sendFcmToDevices(devices: MobilePushDevice[], payload: MobilePushPayload): Promise<DeliverySummary> {
  const messaging = getFirebaseMessaging();
  let successCount = 0;
  const failureCodes: string[] = [];

  for (const batch of chunks(devices, MAX_FCM_BATCH_SIZE)) {
    const tokens = batch.map(({ token }) => token);
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: {
        notificationId: payload.notificationId,
        type: payload.type,
        route: payload.route || "/notifications",
      },
      android: {
        priority: "high",
        notification: { channelId: "default", sound: "default" },
      },
    });

    successCount += result.responses.filter((response) => response.success).length;
    failureCodes.push(...result.responses.flatMap((response) =>
      !response.success ? [response.error?.code || "messaging/unknown-error"] : [],
    ));

    const invalidTokens = result.responses.flatMap((response, index) =>
      !response.success && response.error?.code && PERMANENT_FCM_TOKEN_ERRORS.has(response.error.code)
        ? [tokens[index]]
        : [],
    ).filter((token): token is string => Boolean(token));
    if (invalidTokens.length > 0) {
      await MobilePushTokenModel.deleteMany({ token: { $in: invalidTokens } });
    }
  }

  return { successCount, failureCodes };
}

async function sendExpoToDevices(devices: MobilePushDevice[], payload: MobilePushPayload): Promise<DeliverySummary> {
  let successCount = 0;
  const failureCodes: string[] = [];

  for (const batch of chunks(devices, MAX_EXPO_BATCH_SIZE)) {
    const messages = batch.map(({ token }) => ({
      to: token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      priority: "high",
      data: {
        notificationId: payload.notificationId,
        type: payload.type,
        route: payload.route || "/notifications",
      },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      throw new Error(`Expo Push Service trả HTTP ${response.status}.`);
    }

    const result = await response.json() as { data?: ExpoPushTicket[]; errors?: Array<{ message?: string }> };
    if (!Array.isArray(result.data) || result.data.length !== batch.length) {
      const apiError = result.errors?.map((item) => item.message).filter(Boolean).join(", ");
      throw new Error(apiError || "Expo Push Service trả kết quả không hợp lệ.");
    }

    const invalidTokens: string[] = [];
    result.data.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        successCount += 1;
        return;
      }
      const code = ticket.details?.error || ticket.message || "expo/unknown-error";
      failureCodes.push(code);
      if (ticket.details?.error === "DeviceNotRegistered") invalidTokens.push(batch[index].token);
    });
    if (invalidTokens.length > 0) {
      await MobilePushTokenModel.deleteMany({ token: { $in: invalidTokens } });
    }
  }

  return { successCount, failureCodes };
}

export const mobilePushService = {
  isValidToken(token: string, provider: MobilePushProvider = "fcm") {
    const normalized = token.trim();
    if (normalized.length < 20 || normalized.length > 4096 || /\s/.test(normalized)) return false;
    return provider === "expo" ? isExpoPushToken(normalized) : !isExpoPushToken(normalized);
  },

  async saveToken(input: {
    uid: string;
    companyCode: string;
    token: string;
    platform: MobilePushPlatform;
    provider: MobilePushProvider;
    deviceName?: string;
  }) {
    const token = input.token.trim();
    if (input.provider === "expo" && input.platform !== "ios") {
      throw new Error("Cặp provider/platform không hợp lệ: Expo Push chỉ dùng cho thiết bị iOS.");
    }
    if (input.provider === "fcm" && input.platform !== "android") {
      throw new Error("Cặp provider/platform không hợp lệ: FCM trong ứng dụng này chỉ dùng cho Android.");
    }
    if (!this.isValidToken(token, input.provider)) throw new Error("Push token không hợp lệ.");
    return MobilePushTokenModel.findOneAndUpdate(
      { token },
      { ...input, token, lastSeenAt: new Date() },
      { upsert: true, returnDocument: "after" },
    );
  },

  async removeToken(uid: string, token: string) {
    await MobilePushTokenModel.deleteOne({ uid, token: token.trim() });
  },

  async sendToUser(uid: string, payload: MobilePushPayload): Promise<void> {
    payload = { ...payload, ...privatePushContent(payload.type === "chat") };
    const devices = await MobilePushTokenModel.find({ uid }).select("token provider platform").lean() as MobilePushDevice[];
    if (devices.length === 0) return;

    const fcmDevices = devices.filter(({ provider, platform }) => provider === "fcm" && platform === "android");
    const expoDevices = devices.filter(({ provider, platform }) => provider === "expo" && platform === "ios");
    const unsupportedDeviceTokens = devices
      .filter(({ provider, platform }) => !((provider === "fcm" && platform === "android") || (provider === "expo" && platform === "ios")))
      .map(({ token }) => token);
    if (unsupportedDeviceTokens.length > 0) {
      await MobilePushTokenModel.deleteMany({ token: { $in: unsupportedDeviceTokens } });
    }

    let successCount = 0;
    const failures: string[] = [];
    if (fcmDevices.length > 0) {
      try {
        const result = await sendFcmToDevices(fcmDevices, payload);
        successCount += result.successCount;
        failures.push(...result.failureCodes.map((code) => `fcm:${code}`));
      } catch (error) {
        failures.push(`fcm:${errorMessage(error)}`);
      }
    }
    if (expoDevices.length > 0) {
      try {
        const result = await sendExpoToDevices(expoDevices, payload);
        successCount += result.successCount;
        failures.push(...result.failureCodes.map((code) => `expo:${code}`));
      } catch (error) {
        failures.push(`expo:${errorMessage(error)}`);
      }
    }

    if (failures.length > 0) {
      const summary = Array.from(new Set(failures)).join(", ");
      console.error(`[mobilePushService] Push delivery failed for ${failures.length}/${devices.length} device(s): ${summary}`);
      if (successCount === 0) throw new Error(`Không gửi được thông báo tới thiết bị: ${summary}`);
    }
  },
};
