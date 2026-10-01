import React, { useEffect, useState } from "react";
import { memberFeeService, type MemberFee } from "../../services/memberFeeService";

// Load the current balance, rather than embedding a stale QR amount in a notification.
export default function FeeNotificationQr({ feeId }: { feeId: string }) {
  const [fee, setFee] = useState<MemberFee | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try { const item = await memberFeeService.get(feeId); if (!cancelled) setFee(item); }
      catch { if (!cancelled) setFee(null); }
      finally { if (!cancelled) timer = setTimeout(load, 15000); }
    };
    void load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [feeId]);
  if (!fee?.checkout) return <span className="mt-2 block text-xs text-cyan-700">{fee?.remaining === 0 ? "Đã đóng đủ" : "Mở thông tin thanh toán"}</span>;
  return (
    <div className="mt-2 rounded-lg border bg-white p-2 text-xs text-slate-700">
      <img src={fee.checkout.qrUrl} width={160} height={160} alt="QR đóng phí thành viên" className="mx-auto h-40 w-40 object-contain" />
      <p className="mt-1 text-center font-semibold">{fee.checkout.amount.toLocaleString("vi-VN")} ₫ · {fee.checkout.bank}</p>
      <span className="mt-1 block text-center text-cyan-700">Mở chi tiết thanh toán</span>
    </div>
  );
}
