import React from "react";
import type { MemberFee } from "../../services/memberFeeService";

const money = (amount: number) => amount.toLocaleString("vi-VN") + " ₫";
const statusLabels = { unpaid: "Chưa đóng", partial: "Đóng một phần", overdue: "Quá hạn", paid: "Đã đóng đủ" };

interface Props {
  items: MemberFee[];
  year: number;
  loading: boolean;
  error: string;
  onYearChange: (year: number) => void;
  onRetry: () => void;
  onDetail: (fee: MemberFee) => void;
}

export default function PersonalMemberFees({ items, year, loading, error, onYearChange, onRetry, onDetail }: Props) {
  const paid = items.reduce((sum, fee) => sum + fee.paid, 0);
  const remaining = items.reduce((sum, fee) => sum + fee.remaining, 0);
  const currentYear = new Date().getFullYear();
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Phí thường niên</h2>
          <p className="mt-1 text-sm text-slate-500">Theo dõi các khoản phí và lịch sử thanh toán của bạn.</p>
        </div>
        <label className="text-sm font-medium text-slate-600">
          Năm
          <select aria-label="Năm thu phí" value={year} onChange={(event) => onYearChange(Number(event.target.value))}
            className="ml-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            {Array.from(new Set([year, ...Array.from({ length: 8 }, (_, index) => currentYear + 1 - index)]))
              .sort((a, b) => b - a).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </header>
      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <button type="button" onClick={onRetry} className="ml-3 rounded-lg border border-rose-200 px-3 py-2">Thử lại</button>
        </div>
      ) : loading ? (
        <p role="status" className="py-12 text-center text-sm text-slate-500">Đang tải phí của bạn...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-medium text-emerald-700">Tổng đã đóng · {year}</p>
              <p className="mt-2 text-2xl font-bold text-emerald-800">{money(paid)}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-medium text-amber-700">Tổng cần đóng · {year}</p>
              <p className="mt-2 text-2xl font-bold text-amber-800">{money(remaining)}</p>
            </div>
          </div>
          {[
            { title: "Phí cần đóng", fees: items.filter((fee) => fee.remaining > 0), empty: "Bạn không có khoản phí cần đóng trong năm này." },
            { title: "Phí đã đóng", fees: items.filter((fee) => fee.remaining === 0), empty: "Bạn chưa có khoản phí đã đóng đủ trong năm này." },
          ].map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="mb-3 font-bold text-slate-800">{group.title} ({group.fees.length})</h3>
              {group.fees.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{group.empty}</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {group.fees.map((fee) => (
                    <article key={fee._id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-bold text-slate-900">{fee.title}</h4>
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${fee.remaining === 0 ? "bg-emerald-50 text-emerald-700" : fee.status === "overdue" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                          {statusLabels[fee.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Hạn đóng: {fee.dueDate.split("-").reverse().join("/")}</p>
                      <dl className="my-4 space-y-2 text-sm">
                        {[["Mức phí", fee.amount], ["Đã đóng", fee.paid], ["Cần đóng", fee.remaining]].map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-3">
                            <dt className="text-slate-500">{label}</dt>
                            <dd className="font-semibold text-slate-800">{money(Number(value))}</dd>
                          </div>
                        ))}
                      </dl>
                      <button type="button" onClick={() => onDetail(fee)}
                        className="mt-auto rounded-xl bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-700 hover:bg-cyan-100">
                        Xem chi tiết
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
