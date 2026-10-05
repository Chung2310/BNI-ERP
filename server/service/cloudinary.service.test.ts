import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  uploadStream: vi.fn(),
  destroy: vi.fn(),
  url: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: mocks.config,
    uploader: { upload_stream: mocks.uploadStream, destroy: mocks.destroy },
    url: mocks.url,
  },
}));

import { cloudinaryService, normalizeCloudinaryUploadSource } from "./cloudinary.service";

describe("normalizeCloudinaryUploadSource", () => {
  it("removes MediaRecorder codec parameters from audio data URIs", () => {
    expect(normalizeCloudinaryUploadSource("data:audio/webm;codecs=opus;base64,GkXfo59C"))
      .toBe("data:audio/webm;base64,GkXfo59C");
  });

  it("removes quoted codec parameters from video data URIs", () => {
    expect(normalizeCloudinaryUploadSource('data:video/webm;codecs="vp8,opus";base64,GkXfo59C'))
      .toBe("data:video/webm;base64,GkXfo59C");
  });

  it("does not alter ordinary URLs or codec-free data URIs", () => {
    expect(normalizeCloudinaryUploadSource("https://example.com/audio.webm"))
      .toBe("https://example.com/audio.webm");
    expect(normalizeCloudinaryUploadSource("data:audio/webm;base64,GkXfo59C"))
      .toBe("data:audio/webm;base64,GkXfo59C");
  });
});

describe("cloudinaryService private evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = "cloud";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
  });

  it("creates a signed authenticated image URL with an explicit expiry", () => {
    const expiresAt = new Date("2026-07-20T12:00:00.000Z");
    mocks.url.mockReturnValue("https://signed.example/evidence");
    const result = cloudinaryService.createSignedImageUrl(
      "attendance/evidence/asset-1",
      expiresAt,
    );
    expect(result).toBe("https://signed.example/evidence");
    expect(mocks.url).toHaveBeenCalledWith("attendance/evidence/asset-1", {
      resource_type: "image",
      type: "authenticated",
      secure: true,
      sign_url: true,
      expires_at: 1784548800,
    });
  });

  it("deletes the authenticated image and invalidates cached delivery", async () => {
    mocks.destroy.mockResolvedValue({ result: "ok" });
    await cloudinaryService.deleteAsset("attendance/evidence/asset-1");
    expect(mocks.destroy).toHaveBeenCalledWith(
      "attendance/evidence/asset-1",
      { resource_type: "image", type: "authenticated", invalidate: true },
    );
  });
});
