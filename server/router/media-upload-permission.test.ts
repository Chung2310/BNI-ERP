import { describe, expect, it } from "vitest";
import { permissionForMediaUpload } from "./media-upload-permission";

describe("permissionForMediaUpload", () => {
  it("allows conversation attachments with chat access without resource management", () => {
    expect(permissionForMediaUpload("chat.attachment")).toBe("chat:read");
    expect(permissionForMediaUpload(" CHAT.ATTACHMENT ")).toBe("chat:read");
    expect(permissionForMediaUpload("resource.direct")).toBe("resource:manage");
    expect(permissionForMediaUpload("chat.unknown")).toBe("resource:manage");
  });

  it("allows Kanban task and project audio/video uploads through the work permission", () => {
    expect(permissionForMediaUpload("hr.kanban")).toBe("work:manage");
  });

  it("allows profile avatar, cover, gallery, and settings uploads through access:read", () => {
    expect(permissionForMediaUpload("profile.avatar")).toBe("access:read");
    expect(permissionForMediaUpload("profile.cover")).toBe("access:read");
    expect(permissionForMediaUpload("profile.gallery")).toBe("access:read");
    expect(permissionForMediaUpload("settings.profile")).toBe("access:read");
  });

  it("keeps generic and unknown uploads behind resource management", () => {
    expect(permissionForMediaUpload(undefined)).toBe("resource:manage");
    expect(permissionForMediaUpload("unknown.source")).toBe("resource:manage");
  });
});
