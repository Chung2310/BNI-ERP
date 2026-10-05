import React, { useEffect, useState } from "react";
import { vietnamDateTime } from "../../utils/meetingRecurrence";
import { ConfirmDialog } from "../common/ConfirmDialog";
type CalendarMeeting = { _id: string; title: string; startsAt: string; originalStartsAt?: string; seriesId?: string; status: string; __v: number };
const labels: Record<string, string> = { scheduled: "Sắp diễn ra", live: "Đang diễn ra", paused: "Tạm dừng", ended: "Đã kết thúc", cancelled: "Đã hủy" };
export function MeetingCalendar<T extends CalendarMeeting>({ month, onMonthChange, revision, load, canManage, onOpen, onEdit, onCancel, filter }: {
  month: string; onMonthChange: (value: string) => void; revision: number;
  load: (path: string) => Promise<T[]>; canManage: boolean; onOpen: (item: T) => void; onEdit: (item: T) => void; onCancel: (item: T) => Promise<void>; filter: (item: T) => boolean;
}) {
  const [items, setItems] = useState<T[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [retry, setRetry] = useState(0); const [cancelling, setCancelling] = useState<T | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    load("?month=" + month).then(data => { if (active) setItems(data); }).catch(error => { if (active) setError(error.message || "Không thể tải lịch."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, revision, retry, load]);
  const first = new Date(month + "-01T00:00:00Z");
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const today = vietnamDateTime(new Date()).slice(0,10);
  const move = (amount: number) => { const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + amount); onMonthChange(next.toISOString().slice(0,7)); };
  const visible = items.filter(filter);
  return <section aria-label="Lịch cuộc họp" className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 sm:p-5 shadow-xs backdrop-blur-md">
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <button type="button" aria-label="Tháng trước" onClick={() => move(-1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200 shadow-2xs transition cursor-pointer">‹</button>
      <input aria-label="Tháng xem lịch" type="month" value={month} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) onMonthChange(e.target.value); }} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:border-cyan-500 focus:outline-none" />
      <button type="button" aria-label="Tháng sau" onClick={() => move(1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200 shadow-2xs transition cursor-pointer">›</button>
      <button type="button" onClick={() => onMonthChange(today.slice(0,7))} className="rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-xs font-bold text-cyan-700 px-3 py-2 transition cursor-pointer shadow-2xs">Tháng này</button>
      <span className="text-xs text-slate-500 font-medium">Giờ Việt Nam · {!loading && !error ? visible.length + " buổi" : ""}</span>
    </div>
    {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải lịch...</p> : error ? <p role="alert" className="p-4 rounded-xl bg-rose-50 text-rose-700 text-sm">{error} <button type="button" className="ml-2 font-bold underline cursor-pointer" onClick={() => setRetry(value => value + 1)}>Thử lại</button></p> : <div className="overflow-x-auto rounded-xl border border-slate-200/80"><div className="grid min-w-[720px] grid-cols-7 gap-px bg-slate-200/80">
      {["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"].map(day => <div key={day} className="bg-slate-50/90 p-2 text-center text-xs font-bold text-slate-700">{day}</div>)}
      {Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
        const day = index - offset + 1; const key = month + "-" + String(day).padStart(2,"0");
        if (day < 1 || day > days) return <div key={index} className="min-h-28 bg-slate-50/50" />;
        return <div key={index} className={"min-h-28 p-2 " + (key === today ? "bg-cyan-50/50 ring-1 ring-inset ring-cyan-300" : "bg-white")}><span className={"inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold " + (key === today ? "bg-cyan-600 text-white" : "text-slate-700")}>{day}</span>
          {visible.filter(item => vietnamDateTime(item.startsAt).slice(0,10) === key).map(item => <article key={item._id} className={"mt-2 rounded-xl border p-2 text-xs transition " + (item.status === "cancelled" ? "border-rose-200 bg-rose-50/80" : "border-cyan-200/80 bg-cyan-50/70 hover:border-cyan-400 hover:bg-cyan-50")}>
            <button type="button" onClick={() => onOpen(item)} className="w-full text-left cursor-pointer"><strong className="block font-bold text-slate-900 leading-snug">{vietnamDateTime(item.startsAt).slice(11)} · {item.title}</strong><span className="text-[11px] text-cyan-800 font-medium">{labels[item.status] || item.status}{item.seriesId ? " · Định kỳ" : ""}</span></button>
            {item.originalStartsAt && new Date(item.originalStartsAt).getTime() !== new Date(item.startsAt).getTime() && <p className="mt-1 text-slate-500 text-[11px]">Dời từ {vietnamDateTime(item.originalStartsAt).replace("T", " ")}</p>}
            {canManage && item.status === "scheduled" && <div className="mt-2 flex flex-wrap gap-2 pt-1 border-t border-cyan-100"><button type="button" className="font-bold text-cyan-700 hover:text-cyan-800 cursor-pointer" onClick={() => onEdit(item)}>Sửa / Dời lịch</button><button type="button" className="text-rose-600 hover:text-rose-700 font-medium cursor-pointer" onClick={() => setCancelling(item)}>Hủy buổi</button></div>}
          </article>)}
        </div>;
      })}
    </div></div>}
    <ConfirmDialog isOpen={Boolean(cancelling)} title="Hủy buổi họp này?" description={cancelling ? cancelling.title + " · " + vietnamDateTime(cancelling.startsAt).replace("T", " ") + ". Các buổi khác không thay đổi." : ""} confirmLabel="Hủy buổi họp" cancelLabel="Giữ lịch" isSubmitting={saving} onClose={() => setCancelling(null)} onConfirm={async () => { if (!cancelling) return; setSaving(true); try { await onCancel(cancelling); setCancelling(null); setRetry(value => value + 1); } catch { /* Parent displays the failure; keep confirmation available for retry. */ } finally { setSaving(false); } }} />
  </section>;
}
