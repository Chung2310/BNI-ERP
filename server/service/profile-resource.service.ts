import type { ManagedUploadActor } from "./managed-upload.service";
import {
  sourceUploadFinalizer,
  type FinalizeSourceUploadsInput,
} from "./source-upload-finalizer.service";

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

export function createProfileResourceService(finalizer: SourceFinalizer) {
  return {
    async finalizeCover(actor: ManagedUploadActor, user: { _id?: unknown; id?: string; uid?: string; displayName?: string; email?: string }, uploadToken: string) {
      const userId = String(user._id || user.id || user.uid);
      return finalizer.finalize(actor, {
        entityType: "user",
        entityId: userId,
        entityLabel: user.displayName || user.email || userId,
        sourceRecordId: userId,
        expectedSourceType: "profile.cover",
        uploads: [{ uploadToken, sourceField: "coverImage" }],
      });
    },
    async finalizeGallery(actor: ManagedUploadActor, user: { _id?: unknown; id?: string; uid?: string; displayName?: string; email?: string }, uploads: Array<{ index: number; uploadToken: string }>) {
      const userId = String(user._id || user.id || user.uid);
      return finalizer.finalize(actor, {
        entityType: "user",
        entityId: userId,
        entityLabel: user.displayName || user.email || userId,
        sourceRecordId: userId,
        expectedSourceType: "profile.gallery",
        uploads: uploads.map(({ index, uploadToken }) => ({ uploadToken, sourceField: `galleryImages.${index}` })),
      });
    },
    async finalizeAvatar(actor: ManagedUploadActor, user: { _id?: unknown; id?: string; uid?: string; displayName?: string; email?: string }, uploadToken?: string) {
      const userId = String(user._id || user.id || user.uid);
      return finalizer.finalize(actor, {
        entityType: "user",
        entityId: userId,
        entityLabel: user.displayName || user.email || userId,
        sourceRecordId: userId,
        uploads: [{ uploadToken, sourceField: "photoURL" }],
      });
    },
  };
}

export const profileResourceService = createProfileResourceService(sourceUploadFinalizer);
