import { createMemberFees } from "./member-fee.service";
import { notifyFee } from "./sepay.service";

export async function createAndNotifyMemberFees(companyCode: string, actorId: string, input: any) {
  const { created, skipped, createdIds = [] } = await createMemberFees(companyCode, actorId, input, true);
  let notified = 0;
  const notificationFailures: { feeId: string; message: string }[] = [];
  for (let offset = 0; offset < createdIds.length; offset += 5) {
    await Promise.all(createdIds.slice(offset, offset + 5).map(async feeId => {
      try { await notifyFee(companyCode, feeId); notified++; }
      catch (error: any) {
        notificationFailures.push({ feeId, message: error?.message || "Không thể gửi thông báo đóng phí." });
      }
    }));
  }
  return { created, skipped, notified, notificationFailures };
}
