import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

const FIREBASE_APP_NAME = "igen-mobile-push";

function readServiceAccount(): ServiceAccount {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (!encoded) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 chưa được cấu hình.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 không phải service-account JSON Base64 hợp lệ.");
  }

  const projectId = typeof parsed.project_id === "string" ? parsed.project_id : "";
  const clientEmail = typeof parsed.client_email === "string" ? parsed.client_email : "";
  const privateKey = typeof parsed.private_key === "string" ? parsed.private_key : "";
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase service account thiếu project_id, client_email hoặc private_key.");
  }

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseMessaging(): Messaging {
  const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  const app = existingApp ?? initializeApp(
    { credential: cert(readServiceAccount()) },
    FIREBASE_APP_NAME,
  );
  return getMessaging(app);
}
