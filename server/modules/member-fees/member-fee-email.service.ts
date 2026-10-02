import { randomUUID } from "node:crypto";
import Joi from "joi";
import { UserModel } from "../../model/user.model";
import { companyEmailService } from "../../service/company-email.service";
import { MemberFeeModel } from "./member-fee.model";
import { getFee, MemberFeeError, serializeFee } from "./member-fee.service";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g,
  character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));

// Called after the in-app notification; failures remain retryable independently.
export async function sendFeeEmail(companyCode: string, id: string, day: string) {
  const fee = await getFee(companyCode, id);
  if (fee.emailNotifiedDay === day) return;
  const remaining = serializeFee(fee).remaining;
  if (remaining <= 0) return;
  const member = await UserModel.findOne({ _id: fee.memberId, companyCode, isActive: { $ne: false } }).select("email displayName").lean();
  const to = member?.email?.trim() || "";
  if (Joi.string().email({ tlds: { allow: false } }).required().validate(to).error) {
    throw new MemberFeeError(400, "Đã tạo thông báo trong ứng dụng nhưng chưa gửi email: thành viên chưa có email hợp lệ hoặc đã ngừng hoạt động.");
  }
  const smtp = await companyEmailService.getSmtp(companyCode);
  if (!smtp?.hasPassword) {
    throw new MemberFeeError(400, "Đã tạo thông báo trong ứng dụng nhưng chưa gửi email: vui lòng cấu hình SMTP của công ty.");
  }
  const account = fee.bankAccount;
  if (!account?.accountNumber || !fee.paymentCode) throw new MemberFeeError(400, "Khoản phí chưa có thông tin chuyển khoản.");
  const qrUrl = "https://vietqr.app/img?" + new URLSearchParams({ bank: account.bank || "", acc: account.accountNumber,
    amount: String(remaining), des: fee.paymentCode }).toString();
  const lines = [
    "Kính gửi " + (member?.displayName || fee.memberName) + ",",
    "Khoản phí: " + fee.title + " (năm " + fee.year + ")",
    "Số tiền còn phải đóng: " + remaining.toLocaleString("vi-VN") + " VND",
    "Hạn đóng: " + fee.dueDate.split("-").reverse().join("/"),
    "Ngân hàng: " + account.bank,
    "Số tài khoản: " + account.accountNumber,
    "Chủ tài khoản: " + account.accountName,
    "Nội dung chuyển khoản: " + fee.paymentCode,
    "Vui lòng giữ nguyên nội dung chuyển khoản để hệ thống ghi nhận đúng khoản phí.",
    "Số tiền được tính tại thời điểm gửi email. Nếu vừa thanh toán, vui lòng kiểm tra trạng thái trong ứng dụng trước khi chuyển tiếp.",
    ...(fee.note ? ["Ghi chú: " + fee.note] : []),
  ];
  const claimToken = randomUUID();
  const now = new Date();
  const claim = await MemberFeeModel.updateOne({ _id: fee._id, companyCode, emailNotifiedDay: { $ne: day },
    $or: [{ emailClaimUntil: { $exists: false } }, { emailClaimUntil: { $lte: now } }] },
    { $set: { emailClaimToken: claimToken, emailClaimUntil: new Date(now.getTime() + 30 * 60_000) }, $inc: { __v: 1 } });
  if (!claim.modifiedCount) {
    if ((await getFee(companyCode, id)).emailNotifiedDay === day) return;
    throw new MemberFeeError(409, "Email đóng phí đang được gửi. Vui lòng đợi rồi tải lại.");
  }
  let accepted = false;
  try {
    await companyEmailService.send(companyCode, { to,
      subject: ("Thông báo đóng phí: " + fee.title + " - " + fee.year).replace(/[\r\n]/g, " "),
      text: lines.join("\n\n") + "\n\nMã QR: " + qrUrl,
      html: '<h2>Thông báo đóng phí</h2>' + lines.map(line => '<p>' + escapeHtml(line) + '</p>').join("") +
        '<p><img src="' + escapeHtml(qrUrl) + '" width="240" height="240" alt="QR chuyển khoản khoản phí" /></p>' +
        '<p><a href="' + escapeHtml(qrUrl) + '">Mở mã QR chuyển khoản</a></p>',
    });
    accepted = true;
    await MemberFeeModel.updateOne({ _id: fee._id, companyCode, emailClaimToken: claimToken },
      { $set: { emailNotifiedDay: day, emailNotifiedAt: new Date() },
        $unset: { emailClaimToken: 1, emailClaimUntil: 1 }, $inc: { __v: 1 } });
  } catch (error) {
    // Retain the lease after SMTP acceptance if persisting the result fails.
    if (!accepted) await MemberFeeModel.updateOne({ _id: fee._id, companyCode, emailClaimToken: claimToken },
      { $unset: { emailClaimToken: 1, emailClaimUntil: 1 }, $inc: { __v: 1 } });
    console.error("[member-fee-email] Delivery failed", { companyCode, feeId: id, accepted });
    throw new MemberFeeError(502, accepted
      ? "SMTP đã nhận email nhưng chưa lưu được trạng thái. Vui lòng kiểm tra trước khi gửi lại."
      : "Đã tạo thông báo trong ứng dụng nhưng gửi email thất bại. Vui lòng kiểm tra SMTP và thử lại.");
  }
}
