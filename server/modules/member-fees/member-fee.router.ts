import { createAndNotifyMemberFees } from "./member-fee-notification.service";
import { Router } from "express";
import { requireAuth, requirePermission, requireRole } from "../../middleware/auth";
import { requireModule } from "../../middleware/require-module";
import { UserModel } from "../../model/user.model";
import { MemberFeeModel } from "./member-fee.model";
import { createFeeInput, feePaymentInput, voidFeePaymentInput } from "./member-fee.validation";
import { deleteMemberFee, getFee, MemberFeeError, receiveFee, serializeFee, voidFeePayment } from "./member-fee.service";

import { getSePayConfig, notifyFee, feeCheckout } from "./sepay.service";
import { SePayTransactionModel } from "./sepay.model";

export const memberFeeRouter = Router();
memberFeeRouter.use(requireAuth as any, requireModule("hr"));
const read = requirePermission(["hr:read", "hr:manage", "access:manage"]) as any;
const manage = requirePermission(["hr:manage", "access:manage"]) as any;
const company = (req: any) => String(req.user.companyCode || "").toUpperCase();
const fail = (res: any, error: any) => {
  if (!(error instanceof MemberFeeError)) console.error("[member-fees]", error);
  return res.status(error instanceof MemberFeeError ? error.status : 500).json({ message: error instanceof MemberFeeError ? error.message : "Không thể xử lý khoản phí. Vui lòng thử lại." });
};
memberFeeRouter.get("/members", requireRole(["admin"]) as any, read, async (req: any, res) => {
  try {
    const members = await UserModel.find({ companyCode: company(req), isActive: { $ne: false } }).select("_id displayName email").sort({ displayName: 1 }).lean();
    res.json({ data: members.map(m => ({ id: String(m._id), name: m.displayName, email: m.email })) });
  } catch (e) { fail(res, e); }
});
memberFeeRouter.get("/", read, async (req: any, res) => {
  const year = Number(req.query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ message: "Năm không hợp lệ." });
  try {
    const items = await MemberFeeModel.find({ companyCode: company(req), year, ...(req.user.role === "admin" ? {} : { memberId: req.user.id }) }).sort({ dueDate: 1, memberName: 1 }).lean();
    res.json({ data: items.map(serializeFee) });
  } catch (e) { fail(res, e); }
});
memberFeeRouter.post("/", requireRole(["admin"]) as any, manage, async (req: any, res) => {
  const { error, value } = createFeeInput.validate(req.body);
  if (error) return res.status(400).json({ message: "Vui lòng kiểm tra tên phí, số tiền, hạn đóng và danh sách thành viên." });
  try { res.status(201).json({ data: await createAndNotifyMemberFees(company(req), req.user.id, value) }); }
  catch (e) { fail(res, e); }
});
memberFeeRouter.get("/sepay/config", requireRole(["admin"]) as any, read, async (req: any, res) => {
  try { res.json({ data: await getSePayConfig(company(req)) }); } catch (e) { fail(res, e); }
});
memberFeeRouter.put("/sepay/config", requireRole(["admin"]) as any, manage, async (req: any, res) => {
  res.status(405).json({ message: "Cấu hình SePay chỉ được thay đổi trong .env của server." });
});
memberFeeRouter.get("/sepay/transactions", requireRole(["admin"]) as any, read, async (req: any, res) => {
  try { res.json({ data: await SePayTransactionModel.find({ companyCode: company(req) }).sort({ createdAt: -1 }).limit(100).select("-fingerprint").lean() }); } catch (e) { fail(res, e); }
});
memberFeeRouter.post("/:id/notify", requireRole(["admin"]) as any, manage, async (req: any, res) => {
  try { res.json({ data: await notifyFee(company(req), req.params.id) }); } catch (e) { fail(res, e); }
});
memberFeeRouter.delete("/:id", requireRole(["admin"]) as any, manage, async (req: any, res) => {
  try { res.json({ data: await deleteMemberFee(company(req), req.params.id) }); } catch (e) { fail(res, e); }
});
memberFeeRouter.get("/:id", read, async (req: any, res) => {
  try {
    const fee = await getFee(company(req), req.params.id);
    if (req.user.role !== "admin" && fee.memberId !== req.user.id) return res.status(404).json({ message: "Không tìm thấy khoản phí." });
    res.json({ data: { ...serializeFee(fee), checkout: await feeCheckout(company(req), fee) } });
  }
  catch (e) { fail(res, e); }
});
memberFeeRouter.post("/:id/payments", requireRole(["admin"]) as any, manage, async (req: any, res) => {
  const { error, value } = feePaymentInput.validate(req.body);
  if (error) return res.status(400).json({ message: "Phiếu thu không hợp lệ. Kiểm tra số tiền, ngày thu và hình thức." });
  try { res.json({ data: await receiveFee(company(req), req.params.id, req.user.id, value) }); }
  catch (e) { fail(res, e); }
});
memberFeeRouter.post("/:id/payments/:paymentId/void", requireRole(["admin"]) as any, manage, async (req: any, res) => {
  const { error, value } = voidFeePaymentInput.validate(req.body);
  if (error) return res.status(400).json({ message: "Nhập lý do hủy phiếu thu (ít nhất 3 ký tự)." });
  try { res.json({ data: await voidFeePayment(company(req), req.params.id, req.params.paymentId, req.user.id, value.reason) }); }
  catch (e) { fail(res, e); }
});
