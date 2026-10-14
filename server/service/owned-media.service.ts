import { OwnedMediaModel } from "../model/owned-media.model";
import { UserModel } from "../model/user.model";
import { cloudinaryService, type PublicMediaAsset } from "./cloudinary.service";

export async function registerOwnedMedia(userId: string, asset: PublicMediaAsset): Promise<void> {
  try {
    await OwnedMediaModel.create({ userId, publicId: asset.publicId, resourceType: asset.resourceType, url: asset.secureUrl });
    if (!await UserModel.exists({ _id: userId, deletionRequestedAt: null })) throw new Error("Tài khoản đang được xóa.");
  } catch (error) {
    try {
      await cloudinaryService.deleteOwnedMedia(asset.publicId, asset.resourceType);
      await OwnedMediaModel.deleteOne({ publicId: asset.publicId, userId });
    } catch (cleanupError) { console.error("[OwnedMedia] Cleanup will be retried", cleanupError); }
    throw error;
  }
}
