import mongoose from "mongoose";
import { UserModel } from "../../model/user.model";
import { MemberFeeModel } from "./member-fee.model";
import { feeBalance, feeTitleKey } from "./member-fee.rules";

export type MemberFeeDocument = ReturnType<typeof MemberFeeModel.hydrate>;
export type MemberFeeData = mongoose.InferSchemaType<typeof MemberFeeModel.schema> & { _id?: mongoose.Types.ObjectId; __v?: number };
export type CreateFeeInput = { memberIds: string[]; campaignId?: string; title: string; year: number; amount: number; dueDate: string; note?: string };
type PaymentInput = { id: string; amount: number; paidOn: string; method: 'cash' | 'transfer'; reference?: string; note?: string };
export class MemberFeeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function serializeFee(item: MemberFeeData | MemberFeeDocument) {
  const data: MemberFeeData = item instanceof mongoose.Document ? item.toObject<MemberFeeData>() : item;
  const payments = data.payments || [];
  return { ...data, payments, ...feeBalance({ ...data, payments }) };
}
export async function createMemberFees(companyCode: string, actorId: string, input: CreateFeeInput, includeCreatedIds = false) {
  const members = await UserModel.find({ _id: { $in: input.memberIds }, companyCode, isActive: { $ne: false } })
    .select("_id displayName email").lean();
  if (members.length !== input.memberIds.length) throw new MemberFeeError(400, "Danh sách có thành viên không thuộc đơn vị hoặc đã ngừng hoạt động.");
  const normalizedTitle = feeTitleKey(input.title);
  // Keep the legacy unique index valid without a destructive index migration.
  // The UUID distinguishes new collection rounds, even with identical names.
  const titleKey = input.campaignId ? normalizedTitle + ":" + input.campaignId : normalizedTitle;
  if (input.campaignId) {
    const existing = await MemberFeeModel.findOne({ companyCode, campaignId: input.campaignId }).lean();
    if (existing && (existing.year !== input.year || feeTitleKey(existing.title) !== normalizedTitle ||
        existing.amount !== input.amount || existing.dueDate !== input.dueDate || existing.note !== input.note)) {
      throw new MemberFeeError(409, "Thông tin đợt thu không khớp. Vui lòng tải lại trước khi thêm thành viên.");
    }
  }
  const operations = members.map(member => ({
    updateOne: {
      filter: { companyCode, year: input.year, memberId: String(member._id), titleKey },
      update: { $setOnInsert: { companyCode, year: input.year, memberId: String(member._id), titleKey,
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        memberName: member.displayName, memberEmail: member.email, title: input.title.trim(), amount: input.amount,
        dueDate: input.dueDate, note: input.note, createdBy: actorId, __v: 0, createdAt: new Date(), updatedAt: new Date() } },
      upsert: true,
      timestamps: false,
    },
  }));
  // The unique key also protects against two managers assigning the same annual fee at once.
  let created = 0;
  let bulkResult: Awaited<ReturnType<typeof MemberFeeModel.bulkWrite>>;
  try { bulkResult = await MemberFeeModel.bulkWrite(operations, { ordered: false }); created = bulkResult.upsertedCount; }
  catch (error) {
    if (!error.writeErrors?.length || error.writeErrors.some((entry) => entry.code !== 11000)) throw error;
    bulkResult = error.result;
    created = bulkResult?.upsertedCount || 0;
  }
  const createdIds = Object.values(bulkResult?.upsertedIds || {}).map(String);
  return { created, skipped: members.length - created, ...(includeCreatedIds ? { createdIds } : {}) };
}
export async function getFee(companyCode: string, id: string) {
  if (!mongoose.isValidObjectId(id)) throw new MemberFeeError(400, "Mã khoản phí không hợp lệ.");
  const item = await MemberFeeModel.findOne({ _id: id, companyCode });
  if (!item) throw new MemberFeeError(404, "Không tìm thấy khoản phí.");
  return item;
}
async function saveFee(item: MemberFeeDocument) {
  try { await item.save(); }
  catch (error) {
    if (error.name === "VersionError" || error.name === "DocumentNotFoundError") throw new MemberFeeError(409, "Khoản phí vừa được cập nhật. Hãy tải lại trước khi ghi nhận.");
    throw error;
  }
  return serializeFee(item);
}
export async function receiveFee(companyCode: string, id: string, actorId: string, input: PaymentInput) {
  const item = await getFee(companyCode, id);
  const existing = item.payments.find(p => p.id === input.id);
  if (existing) {
    if (existing.amount !== input.amount || existing.paidOn !== input.paidOn || existing.method !== input.method ||
        existing.reference !== input.reference || existing.note !== input.note) {
      throw new MemberFeeError(409, "Mã phiếu thu đã được sử dụng với thông tin khác.");
    }
    return serializeFee(item);
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  if (input.paidOn > today) throw new MemberFeeError(400, "Ngày thu không được ở tương lai.");
  if (input.amount > feeBalance(item).remaining) throw new MemberFeeError(400, "Số tiền thu vượt quá số còn phải đóng.");
  if (item.payments.length >= 500) throw new MemberFeeError(400, "Khoản phí đã đạt giới hạn 500 phiếu thu.");
  item.payments.push({ ...input, recordedBy: actorId, recordedAt: new Date() });
  return saveFee(item);
}
export async function voidFeePayment(companyCode: string, id: string, paymentId: string, actorId: string, reason: string) {
  const item = await getFee(companyCode, id);
  const payment = item.payments.find(p => p.id === paymentId);
  if (!payment) throw new MemberFeeError(404, "Không tìm thấy phiếu thu.");
  if (payment.recordedBy === "sepay") throw new MemberFeeError(400, "Không được hủy giao dịch ngân hàng do SePay xác nhận.");
  if (payment.voidedAt) return serializeFee(item);
  payment.voidedAt = new Date(); payment.voidedBy = actorId; payment.voidReason = reason;
  return saveFee(item);
}


export async function deleteMemberFee(companyCode: string, id: string) {
  const fee = await getFee(companyCode, id);
  // Atomic predicate protects against a simultaneous receipt/webhook or email send.
  const result = await MemberFeeModel.deleteOne({ _id: fee._id, companyCode, payments: { $size: 0 },
    $or: [{ emailClaimUntil: { $exists: false } }, { emailClaimUntil: { $lte: new Date() } }] });
  if (!result.deletedCount) throw new MemberFeeError(409,
    "Không thể xóa khoản phí đã có lịch sử thu tiền hoặc đang gửi email. Vui lòng tải lại để kiểm tra.");
  return { message: "Đã xóa khoản phí." };
}
