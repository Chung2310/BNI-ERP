import { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { cloudinaryService } from "../service/cloudinary.service";
import { managedUploadService } from "../service/managed-upload.service";
import { registerOwnedMedia } from "../service/owned-media.service";

interface MediaControllerDependencies {
  cloudinary: Pick<typeof cloudinaryService, "uploadMedia">;
  ownedUpload?: (userId: string, file: string, folder: string) => Promise<string>;
  registerPending?: (userId: string, pending: { storagePublicId?: string; storageResourceType?: string; fileUrl: string; size?: number }) => Promise<void>;
  managedUpload: Pick<typeof managedUploadService, "createPendingUpload">;
}

export function createMediaController(dependencies: MediaControllerDependencies) {
  return {
    /** POST /api/v1/media/upload */
    async upload(req: AuthenticatedRequest, res: Response) {
      try {
        const { file, folder, sourceType, name, fileName, mimeType, size } = req.body;
        if (sourceType) {
          if (!req.user?.id || !req.user.companyCode) {
            return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
          }
          const pending = await dependencies.managedUpload.createPendingUpload(
            {
              companyCode: req.user.companyCode,
              branchId: req.user.branchId,
              actorId: req.user.id,
              actorName: req.user.email,
            },
            {
              sourceType,
              file,
              fileName: fileName || name,
              mimeType,
              size,
            },
          );
          await dependencies.registerPending?.(req.user.id, pending);
          return res.status(200).json({
            status: "success",
            url: pending.fileUrl,
            storagePublicId: pending.storagePublicId,
            uploadToken: pending.token,
          });
        }

        const secureUrl = dependencies.ownedUpload && req.user?.id
          ? await dependencies.ownedUpload(req.user.id, file, folder)
          : await dependencies.cloudinary.uploadMedia(file, folder);
        return res.status(200).json({ status: "success", url: secureUrl });
      } catch (error) {
        console.error("[mediaController.upload] Error:", error);
        return res.status(500).json({
          status: "error",
          message: "Lỗi kết nối hoặc xử lý tải lên đa phương tiện tới Cloudinary",
          details: error.message,
        });
      }
    },
  };
}

export const mediaController = createMediaController({
  cloudinary: cloudinaryService,
  managedUpload: managedUploadService,
  async ownedUpload(userId, file, folder) {
    if (folder?.startsWith("bni/profiles/") && !folder.startsWith(`bni/profiles/${userId}/`) && folder !== `bni/profiles/${userId}`) throw new Error("Không thể tải lên thư mục hồ sơ của tài khoản khác.");
    const asset = await cloudinaryService.uploadMediaAsset(file, folder);
    await registerOwnedMedia(userId, asset);
    return asset.secureUrl;
  },
  async registerPending(userId, pending) {
    if (!pending.storagePublicId) throw new Error("Upload ownership metadata is missing");
    await registerOwnedMedia(userId, { publicId: pending.storagePublicId, resourceType: pending.storageResourceType || "image", secureUrl: pending.fileUrl, bytes: pending.size || 0 });
  },
});
