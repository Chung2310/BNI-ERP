import assert from "node:assert/strict";
import test from "node:test";
import { pickSelfServiceProfileUpdate } from "./self-service-profile-update";

test("discards removed integrations from self-service profile updates", () => {
  const zaloIntegration = { isConnected: true, oaId: "oa-1" };
  const aiAutoReplyConfig = { enabled: true, autoClassify: true };

  assert.deepEqual(
    pickSelfServiceProfileUpdate({ zaloIntegration, aiAutoReplyConfig }),
    {},
  );
});

test("discards privilege-sensitive and unknown fields", () => {
  assert.deepEqual(
    pickSelfServiceProfileUpdate({
      displayName: "Safe Name",
      email: "member@example.com",
      role: "admin",
      companyCode: "OTHER",
      level: 1,
      parentId: "admin-1",
      unknownField: "ignored",
    }),
    { displayName: "Safe Name", email: "member@example.com" },
  );
});

test("allows members to update their product and activity gallery", () => {
  const galleryImages = ["https://example.com/product.jpg", "https://example.com/activity.jpg"];
  assert.deepEqual(
    pickSelfServiceProfileUpdate({ galleryImages, galleryUploadTokens: [{ index: 0, uploadToken: "token" }] }),
    { galleryImages },
  );
});
