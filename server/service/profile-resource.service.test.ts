import { describe, expect, it, vi } from "vitest";
import { createProfileResourceService } from "./profile-resource.service";

describe("ProfileResourceService", () => {
  it("finalizes an avatar only after the user profile has been persisted", async () => {
    const finalize = vi.fn(async () => []);
    const service = createProfileResourceService({ finalize });

    await service.finalizeAvatar(
      { companyCode: "ACME", branchId: "branch-1", actorId: "user-1" },
      { _id: "user-1", displayName: "Nguyen A" },
      "avatar-token",
    );

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "user-1" }),
      {
        entityType: "user",
        entityId: "user-1",
        entityLabel: "Nguyen A",
        sourceRecordId: "user-1",
        uploads: [{ uploadToken: "avatar-token", sourceField: "photoURL" }],
      },
    );
  });
});

it("indexes a cover under the member profile with the correct upload source", async () => {
  const finalize = vi.fn(async () => []);
  const service = createProfileResourceService({ finalize });
  await service.finalizeCover({ companyCode: "BNI", actorId: "member-1" }, { _id: "member-1", displayName: "Member" }, "cover-token");
  expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ actorId: "member-1" }), expect.objectContaining({ entityType: "user", entityId: "member-1", expectedSourceType: "profile.cover", uploads: [{ uploadToken: "cover-token", sourceField: "coverImage" }] }));
});

it("indexes multiple product or activity images by gallery position", async () => {
  const finalize = vi.fn(async () => []);
  const service = createProfileResourceService({ finalize });
  await service.finalizeGallery(
    { companyCode: "BNI", actorId: "admin-1" },
    { _id: "member-1", displayName: "Member" },
    [{ index: 0, uploadToken: "image-token-1" }, { index: 2, uploadToken: "image-token-2" }],
  );
  expect(finalize).toHaveBeenCalledWith(
    expect.objectContaining({ actorId: "admin-1" }),
    expect.objectContaining({
      entityType: "user",
      entityId: "member-1",
      expectedSourceType: "profile.gallery",
      uploads: [
        { uploadToken: "image-token-1", sourceField: "galleryImages.0" },
        { uploadToken: "image-token-2", sourceField: "galleryImages.2" },
      ],
    }),
  );
});
