import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { memberFeeService, type FeeSePayConfig, type FeeSePayTransaction } from "../../services/memberFeeService";

export default function FeeSePaySettings({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<FeeSePayConfig | null>(null);
  const [transactions, setTransactions] = useState<FeeSePayTransaction[]>([]);
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try {
      const [c, t] = await Promise.all([memberFeeService.sepayConfig(), memberFeeService.transactions()]);
      setConfig(c);
      setTransactions(t);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => { void load(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="sepay-title" className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 id="sepay-title" className="text-lg font-bold text-slate-800">SePay & giao dịch</h3>
          <button aria-label="Đóng cấu hình" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <p role="alert" className="my-3 text-sm text-rose-700">{error}</p>}
        {config && (
          <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold">{config.enabled ? "SePay đang bật" : "SePay chưa sẵn sàng"}</p>
            <p>Cấu hình được quản lý trong .env của server. Liên hệ quản trị hệ thống khi cần thay đổi.</p>
            <p>Ngân hàng: <b>{config.bank || "Chưa cấu hình"}</b></p>
            <p>Tài khoản: <b>{config.accountNumber || "Chưa cấu hình"}</b> · {config.accountName}</p>
            <p>API key: {config.hasApiKey ? "Đã khai báo" : "Chưa khai báo"}</p>
            <p>URL webhook POST:</p>
            <code className="block select-all break-all rounded bg-slate-200/60 p-2 text-xs">{window.location.origin + config.webhookPath}</code>
          </div>
        )}
        <div className="mt-6 flex items-center justify-between">
          <h4 className="font-semibold text-slate-800">100 giao dịch gần nhất</h4>
          <button onClick={() => void load()} className="text-sm text-cyan-700 hover:underline cursor-pointer">Tải lại</button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Giao dịch cần kiểm tra chưa được cộng vào khoản phí. Đối chiếu sổ ngân hàng trước khi ghi nhận thủ công.</p>
        <div className="mt-3 space-y-2">
          {transactions.map(t => (
            <article key={t._id} className="rounded-lg border p-3 text-sm text-slate-700">
              <div className="flex justify-between gap-2">
                <b>#{t.transactionId} · {t.payload.transferAmount.toLocaleString("vi-VN")} ₫</b>
                <span className={t.status === "review" ? "text-amber-700 font-semibold" : "text-slate-600"}>
                  {{ applied: "Đã ghi nhận", review: "Cần kiểm tra", ignored: "Bỏ qua", pending: "Đang xử lý" }[t.status]}
                </span>
              </div>
              <p className="mt-1 break-all text-xs text-slate-500">{t.payload.transactionDate} · {t.payload.gateway} · {t.payload.accountNumber}</p>
              <p className="mt-1 break-all">{t.payload.content}</p>
              {t.reason && <p className="mt-1 text-amber-800">{t.reason}</p>}
            </article>
          ))}
          {!transactions.length && <p className="py-4 text-sm text-slate-500">Chưa nhận giao dịch SePay.</p>}
        </div>
      </section>
    </div>
  );
}
