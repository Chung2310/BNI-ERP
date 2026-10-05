import { entityId } from "../../src/utils/entityId";
import type { ManagedUploadActor } from "./managed-upload.service";
import {
  sourceUploadFinalizer,
  type FinalizeSourceUploadsInput,
} from "./source-upload-finalizer.service";

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

function memberId(member: { userId?: unknown }): string {
  return entityId(member?.userId);
}

export function createChatResourceIndexingService(finalizer: SourceFinalizer) {
  return {
    async finalizeMessage(actor: ManagedUploadActor, message: { _id: unknown; attachments?: Array<{ uploadToken?: string }> }, room: { _id: unknown; name?: string; members?: Array<{ userId?: unknown }> }) {
      return finalizer.finalize(actor, {
        entityType: "chat-room",
        entityId: String(room._id),
        entityLabel: room.name || "Cuộc trò chuyện",
        sourceRecordId: String(message._id),
        sourceAudienceIds: (room.members || []).map(memberId).filter(Boolean),
        uploads: (message.attachments || []).map((attachment, index: number) => ({
          uploadToken: attachment.uploadToken,
          sourceField: `attachments.${index}`,
        })),
      });
    },
  };
}

export const chatResourceIndexingService = createChatResourceIndexingService(sourceUploadFinalizer);
