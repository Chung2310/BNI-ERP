import React, { useEffect, useRef, useState } from "react";
import { memberFeeService, type MemberFee } from "../../services/memberFeeService";

export default function FeePaymentPanel({ id, canManage, onUpdate }: { id: string; canManage: boolean; onUpdate: (fee: MemberFee) => void }) {
  const [fee, setFee] = useState<MemberFee | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const update = useRef(onUpdate); update.current = onUpdate;
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setFee(null); setError("");
    const poll = async () => {
      try {
        const result = await memberFeeService.get(id);
        if (!cancelled) { setFee(result); update.current(result); setError(""); }
      } catch (e: any) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) timer = setTimeout(poll, 8000); }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [id]);
  const send = async () => {
    setSending(true); setError(""); setMessage("");
    try {
      await memberFeeService.notify(id);
      const result = await memberFeeService.get(id);
      setFee(result); update.current(result);
      setMessage("Đã gửi thông báo kèm liên kết mã QR. Mỗi khoản chỉ gửi một thông báo mỗi ngày.");
    } catch (e: any) { setError(e.message); } finally { setSending(false); }
  };
  return (
    <section className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 text-sm">
      <h4 className="font-semibold text-slate-800">Thanh toán chuyển khoản</h4>
      {error && <p role="alert" className="my-2 text-rose-700">{error}</p>}
      {message && <p role="status" className="my-2 text-emerald-700">{message}</p>}
      {!fee && !error && <p className="mt-2 text-slate-500">Đang tải thông tin thanh toán...</p>}
      {fee && fee.remaining <= 0 && <p className="mt-2 font-semibold text-emerald-700">Đã đóng đủ khoản phí.</p>}
      {!!fee?.overpaid && <p className="mt-2 text-amber-800">Đã chuyển thừa {fee.overpaid.toLocaleString("vi-VN")} ₫. Vui lòng liên hệ admin để đối soát.</p>}
      {fee && fee.remaining > 0 && (fee.checkout ? (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row">
          <img key={fee.checkout.qrUrl} src={fee.checkout.qrUrl} alt="QR chuyển khoản khoản phí" width={220} height={220} className="h-[220px] w-[220px] rounded-xl bg-white object-contain border border-slate-200" />
          <div className="space-y-2 break-all text-slate-700">
            <p>Ngân hàng: <b>{fee.checkout.bank}</b></p>
            <p>Tài khoản: <b>{fee.checkout.accountNumber}</b></p>
            <p>Chủ tài khoản: <b>{fee.checkout.accountName}</b></p>
            <p>Số tiền: <b>{fee.checkout.amount.toLocaleString("vi-VN")} ₫</b></p>
            <p>Nội dung: <b className="select-all text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded">{fee.checkout.paymentCode}</b></p>
            <p className="text-xs text-slate-600">Giữ nguyên nội dung chuyển khoản. Trạng thái tự cập nhật khi nhận được xác nhận SePay.</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-slate-600">Chưa có QR hoạt động. Cần cấu hình SePay trên server và gửi yêu cầu đóng phí.</p>
      ))}
      {canManage && fee && fee.remaining > 0 && (
        <button type="button" onClick={() => void send()} disabled={sending} className="mt-3 rounded-lg bg-cyan-700 hover:bg-cyan-800 px-3 py-2 font-semibold text-white disabled:opacity-50 transition cursor-pointer">
          {sending ? "Đang gửi..." : "Gửi thông báo & QR"}
        </button>
      )}
      {fee?.notifiedAt && <p className="mt-3 text-xs text-slate-500">Đã gửi: {new Date(fee.notifiedAt).toLocaleString("vi-VN")}</p>}
    </section>
  );
}
