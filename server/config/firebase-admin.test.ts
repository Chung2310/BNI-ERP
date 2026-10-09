import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  cert: vi.fn((serviceAccount) => ({ serviceAccount })),
  getApps: vi.fn(),
  initializeApp: vi.fn(() => ({ name: "igen-mobile-push" })),
  getMessaging: vi.fn(() => ({ sendEachForMulticast: vi.fn() })),
}));

vi.mock("firebase-admin/app", () => ({
  cert: dependencies.cert,
  getApps: dependencies.getApps,
  initializeApp: dependencies.initializeApp,
}));

vi.mock("firebase-admin/messaging", () => ({
  getMessaging: dependencies.getMessaging,
}));

import { getFirebaseMessaging } from "./firebase-admin";

describe("Firebase Admin configuration", () => {
  const originalCredential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;

  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getApps.mockReturnValue([]);
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  });

  afterEach(() => {
    if (originalCredential === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = originalCredential;
  });

  it("fails without the server-only Base64 credential", () => {
    expect(() => getFirebaseMessaging()).toThrow("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
    expect(dependencies.initializeApp).not.toHaveBeenCalled();
  });

  it("decodes the service account and initializes one named Firebase app", () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(JSON.stringify({
      project_id: "igen-test",
      client_email: "firebase-admin@igen-test.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
    })).toString("base64");

    getFirebaseMessaging();

    expect(dependencies.cert).toHaveBeenCalledWith({
      projectId: "igen-test",
      clientEmail: "firebase-admin@igen-test.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
    });
    expect(dependencies.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ credential: expect.any(Object) }),
      "igen-mobile-push",
    );
    expect(dependencies.getMessaging).toHaveBeenCalledWith({ name: "igen-mobile-push" });
  });
});
