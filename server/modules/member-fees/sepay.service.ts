import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import Joi from "joi";
import { SePayTransactionModel } from "./sepay.model";
import { MemberFeeModel } from "./member-fee.model";
import { getFee, MemberFeeError, serializeFee } from "./member-fee.service";
import { notificationService } from "../../service/notification.service";
import { NotificationModel } from "../../model/notification.model";

import { sendFeeEmail } from "./member-fee-email.service";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const bankKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
// Resolve on the server at call time so environment loading does not depend on import order.
// A global receiving account is explicitly bound to one organization.
function readSePayEnvironment(companyCode: string) {
  if (!companyCode || (process.env.SEPAY_COMPANY_CODE || "").trim().toUpperCase() !== companyCode.toUpperCase()) return null;
  const bank = (process.env.SEPAY_BANK || "").trim();
  const accountNumber = (process.env.SEPAY_ACCOUNT_NUMBER || "").trim();
  const accountName = (process.env.SEPAY_ACCOUNT_NAME || "").trim();
  const apiKey = process.env.SEPAY_API_KEY || "";
  const ready = /^[A-Za-z0-9]{2,50}$/.test(bank) && /^[A-Za-z0-9]{3,40}$/.test(accountNumber) &&
    accountName.length >= 2 && accountName.length <= 150 && /^[A-Za-z0-9_-]{32,200}$/.test(apiKey);
  return { bank, accountNumber, accountName, apiKey, enabled: process.env.SEPAY_ENABLED === "true" && ready };
}
export async function getSePayConfig(companyCode: string) {
  const config = readSePayEnvironment(companyCode);
  return { enabled: config?.enabled || false, bank: config?.bank || "", accountNumber: config?.accountNumber || "",
    accountName: config?.accountName || "", hasApiKey: !!config?.apiKey,
    webhookPath: "/api/v1/webhook/sepay/" + encodeURIComponent(companyCode) };
}
export async function authenticateSePay(companyCode: string, authorization: string) {
  const config = readSePayEnvironment(companyCode);
  const match = /^Apikey ([A-Za-z0-9_-]{32,200})$/i.exec(authorization);
  if (!config?.enabled || !match ||
      !timingSafeEqual(Buffer.from(hash(match[1]), "hex"), Buffer.from(hash(config.apiKey), "hex"))) {
    throw new MemberFeeError(401, "Webhook không được xác thực.");
  }
}
export async function feeCheckout(companyCode: string, fee: any) {
  const balance = serializeFee(fee);
  const config = readSePayEnvironment(companyCode);
  if (balance.remaining <= 0 || !fee.paymentCode || !fee.bankAccount || !config?.enabled) return null;
  const params = new URLSearchParams({ bank: fee.bankAccount.bank, acc: fee.bankAccount.accountNumber,
    amount: String(balance.remaining), des: fee.paymentCode });
  return { ...(fee.bankAccount.toObject?.() || fee.bankAccount), paymentCode: fee.paymentCode,
    amount: balance.remaining, qrUrl: "https://vietqr.app/img?" + params.toString() };
}
export async function notifyFee(companyCode: string, id: string) {
  let fee = await getFee(companyCode, id);
  if (serializeFee(fee).remaining <= 0) throw new MemberFeeError(400, "Khoản phí đã đóng đủ.");
  const config = readSePayEnvironment(companyCode);
  if (!config?.enabled) throw new MemberFeeError(400, "SePay chưa sẵn sàng. Cần cấu hình đầy đủ trong .env của server.");
  // Freeze the receiving account for this invoice, including after settings change.
  if (!fee.paymentCode) {
    await MemberFeeModel.updateOne({ _id: fee._id, companyCode, paymentCode: { $exists: false } },
      { $set: { paymentCode: "BNI" + randomBytes(10).toString("hex").toUpperCase(),
        bankAccount: { bank: config.bank, accountNumber: config.accountNumber, accountName: config.accountName } }, $inc: { __v: 1 } });
    fee = await getFee(companyCode, id);
  }
  // Daily reminder key makes double clicks/retries safe, while allowing a later reminder.
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const key = "member-fee:" + id + ":" + day;
  try {
    await notificationService.createNotification({ companyCode, recipientUid: fee.memberId, idempotencyKey: key,
      title: "Thông báo đóng phí: " + fee.title,
      body: fee.title + " năm " + fee.year + ": còn " + serializeFee(fee).remaining.toLocaleString("vi-VN") +
        " VND, hạn " + fee.dueDate + ". Mở thông báo để xem mã QR chuyển khoản và trạng thái thanh toán.",
      type: "he-thong", read: false, action: { tab: "NHÂN SỰ", subTab: "PHÍ THƯỜNG NIÊN", feeId: id } });
  } catch (error: any) {
    if (error.code !== 11000) throw error;
  }
  const notification = await NotificationModel.findOne({ companyCode, recipientUid: fee.memberId, idempotencyKey: key });
  await MemberFeeModel.updateOne({ _id: fee._id, companyCode },
    { $max: { notifiedAt: notification!.createdAt }, $inc: { __v: 1 } });
  await sendFeeEmail(companyCode, id, day);
  return serializeFee(await getFee(companyCode, id));
}
const webhookInput = Joi.object({
  id: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required(),
  gateway: Joi.string().min(1).max(100).required(),
  transactionDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).required(),
  accountNumber: Joi.string().min(1).max(100).required(),
  subAccount: Joi.string().allow("", null).max(100).default(""),
  code: Joi.string().allow("", null).max(500).default(""),
  content: Joi.string().allow("").max(10000).required(),
  transferType: Joi.string().valid("in", "out").required(),
  transferAmount: Joi.number().integer().positive().max(1000000000000).required(),
  referenceCode: Joi.string().allow("", null).max(500).default(""),
}).unknown(true);
export async function processSePay(companyCode: string, raw: unknown) {
  const { value: input, error } = webhookInput.validate(raw, { convert: false });
  if (error || !Number.isFinite(Date.parse(input.transactionDate.replace(" ", "T") + "+07:00"))) {
    throw new MemberFeeError(400, "Dữ liệu giao dịch không hợp lệ.");
  }
  const localDate = new Date(Date.parse(input.transactionDate.replace(" ", "T") + "+07:00") + 7 * 60 * 60 * 1000);
  if (localDate.toISOString().slice(0, 19).replace("T", " ") !== input.transactionDate) throw new MemberFeeError(400, "Ngày giao dịch không hợp lệ.");
  if (input.id === 0) return { success: true, status: "test" };
  const { id, gateway, transactionDate, accountNumber, subAccount, content, transferType, transferAmount, referenceCode } = input;
  // Only stable bank fields participate: SePay can enrich code/description during replay.
  const payload = { id, gateway, transactionDate, accountNumber, subAccount, content, transferType, transferAmount, referenceCode };
  const fingerprint = hash(JSON.stringify(payload));
  const filter = { companyCode, transactionId: id };
  try { await SePayTransactionModel.updateOne(filter, { $setOnInsert: { ...filter, fingerprint, payload, status: "pending" } }, { upsert: true }); }
  catch (e: any) { if (e.code !== 11000) throw e; }
  const entry = (await SePayTransactionModel.findOne(filter))!;
  if (entry.fingerprint !== fingerprint) throw new MemberFeeError(409, "Mã giao dịch đã tồn tại với dữ liệu khác.");
  if (entry.status !== "pending") return { success: true, status: entry.status };
  const finish = async (status: string, reason: string, feeId?: string) => {
    await SePayTransactionModel.updateOne({ ...filter, status: "pending" }, { $set: { status, reason, ...(feeId ? { feeId } : {}) } });
    return { success: true, status };
  };
  if (transferType !== "in") return finish("ignored", "Giao dịch tiền ra");
  const codes = [...new Set((content.toUpperCase().match(/\bBNI[A-F0-9]{20}\b/g) || []) as string[])];
  if (codes.length !== 1) return finish("review", "Nội dung không chứa đúng một mã khoản phí");
  const fee = await MemberFeeModel.findOne({ companyCode, paymentCode: codes[0] });
  if (!fee) return finish("review", "Không tìm thấy khoản phí trong đơn vị");
  if (!fee.bankAccount || accountNumber !== fee.bankAccount.accountNumber || bankKey(gateway) !== bankKey(fee.bankAccount.bank)) {
    return finish("review", "Ngân hàng hoặc tài khoản nhận không khớp", String(fee._id));
  }
  const paymentId = "sepay:" + id;
  // One atomic write handles concurrent delivery and recovery after a crash. Increment __v
  // so manual receipts loaded before this update cannot overwrite bank payments.
  const credited = await MemberFeeModel.updateOne({ _id: fee._id, companyCode, "payments.id": { $ne: paymentId } },
    { $push: { payments: { id: paymentId, amount: transferAmount, method: "transfer",
      paidOn: transactionDate.slice(0, 10), reference: referenceCode || String(id), note: "Tự động từ SePay",
      recordedBy: "sepay", recordedAt: new Date() } }, $inc: { __v: 1 } });
  if (!credited.matchedCount && !await MemberFeeModel.exists({ _id: fee._id, companyCode, "payments.id": paymentId })) {
    return finish("review", "Khoản phí đã bị xóa trước khi ghi nhận giao dịch", String(fee._id));
  }
  // Preserve the full actual bank amount, including overpayments. The UI exposes the surplus.
  return finish("applied", "", String(fee._id));
}
