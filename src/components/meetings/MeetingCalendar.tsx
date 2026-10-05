import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { vietnamDateTime } from "../../utils/meetingRecurrence";
import { VietnameseMonthPicker } from "../common/VietnameseMonthPicker";
import { MeetingScheduleActions } from "./MeetingScheduleActions";

type CalendarMeeting = { _id: string; title: string; startsAt: string; originalStartsAt?: string; seriesId?: string; status: string; __v: number };
const labels: Record<string, string> = { scheduled: "Sắp diễn ra", live: "Đang diễn ra", paused: "Tạm dừng", ended: "Đã kết thúc", cancelled: "Đã hủy" };
const statusDots: Record<string, string> = { scheduled: "bg-sky-400", live: "bg-cyan-500", paused: "bg-amber-400", ended: "bg-slate-400", cancelled: "bg-rose-400" };
const weekDays = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];

export function MeetingCalendar<T extends CalendarMeeting>({ month, onMonthChange, revision, load, canManage, onOpen, onReschedule, onCancel, onDelete, filter }: {
  month: string; onMonthChange: (value: string) => void; revision: number;
  load: (path: string) => Promise<T[]>; canManage: boolean; onOpen: (item: T) => void; onReschedule: (item: T) => void; onCancel: (item: T) => void; onDelete: (item: T) => void; filter: (item: T) => boolean;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const dayDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    load("?month=" + month).then(data => { if (active) setItems(data); })
      .catch(error => { if (active) setError(error.message || "Không thể tải lịch."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, revision, retry, load]);

  useEffect(() => { setSelectedDay(null); }, [month]);

  useEffect(() => {
    if (selectedDay) dayDialog.current?.showModal();
    else if (dayDialog.current?.open) dayDialog.current.close();
  }, [selectedDay]);

  const first = new Date(month + "-01T00:00:00Z");
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const weeks = Math.ceil((offset + days) / 7);
  const today = vietnamDateTime(new Date()).slice(0, 10);
  const move = (amount: number) => { const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + amount); onMonthChange(next.toISOString().slice(0, 7)); };
  const visible = useMemo(() => items.filter(filter).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [items, filter]);
  const byDay = useMemo(() => {
    const result = new Map<string, T[]>();
    visible.forEach(item => {
      const key = vietnamDateTime(item.startsAt).slice(0, 10);
      result.set(key, [...(result.get(key) || []), item]);
    });
    return result;
  }, [visible]);
  const selectedMeetings = selectedDay ? byDay.get(selectedDay) || [] : [];
  const dateLabel = (date: string) => date.split("-").reverse().join("/");
  const closeDay = () => { dayDialog.current?.close(); setSelectedDay(null); };

  return <section aria-label="Lịch cuộc họp" className="flex min-h-[420px] flex-col rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-xs sm:min-h-0 sm:flex-1">
    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1.5">
      <button type="button" aria-label="Tháng trước" onClick={() => move(-1)} className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-200/70 text-cyan-700 hover:bg-cyan-50 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
      <VietnameseMonthPicker value={month} onChange={onMonthChange} currentMonth={today.slice(0, 7)} />
      <button type="button" aria-label="Tháng sau" onClick={() => move(1)} className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-200/70 text-cyan-700 hover:bg-cyan-50 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
      <button type="button" onClick={() => onMonthChange(today.slice(0, 7))} className="h-8 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-xs font-normal text-cyan-700 hover:bg-cyan-100 cursor-pointer">Tháng này</button>
      <span className="ml-auto text-[11px] font-normal text-slate-500">{!loading && !error ? `${visible.length} buổi` : ""}</span>
    </div>

    {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải lịch...</p> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error} <button type="button" className="ml-2 underline cursor-pointer" onClick={() => setRetry(value => value + 1)}>Thử lại</button></p> : (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200">
        <div className="grid shrink-0 grid-cols-7 border-b border-slate-200 bg-slate-50">
          {weekDays.map((day, index) => <div key={day} className="py-1.5 text-center text-[11px] font-medium text-slate-500"><span className="hidden sm:inline">{day}</span><span className="sm:hidden">{index === 6 ? "CN" : `T${index + 2}`}</span></div>)}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-px bg-slate-200" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
          {Array.from({ length: weeks * 7 }, (_, index) => {
            const day = index - offset + 1;
            const key = month + "-" + String(day).padStart(2, "0");
            if (day < 1 || day > days) return <div key={index} aria-hidden="true" className="min-h-0 bg-slate-50" />;
            const meetings = byDay.get(key) || [];
            const isToday = key === today;
            return <div key={key} data-calendar-day={key} className={`flex min-h-0 min-w-0 flex-col overflow-hidden p-1 ${isToday ? "bg-cyan-50 ring-1 ring-inset ring-cyan-300" : index % 7 >= 5 ? "bg-slate-50" : "bg-white"}`}>
              <div className="flex h-4 shrink-0 items-center justify-between gap-0.5">
                <button type="button" aria-label={`Xem lịch ngày ${dateLabel(key)}`} aria-current={isToday ? "date" : undefined} onClick={() => setSelectedDay(key)} className={`grid h-4 min-w-4 place-items-center rounded-full text-[11px] font-normal tabular-nums cursor-pointer ${isToday ? "bg-cyan-500 text-white" : "text-slate-600 hover:bg-cyan-50 hover:text-cyan-700"}`}>{day}</button>
                {meetings.length > 1 ? <button type="button" onClick={() => setSelectedDay(key)} aria-label={`Xem ${meetings.length} buổi họp ngày ${dateLabel(key)}`} className="truncate rounded px-0.5 text-[10px] font-normal leading-4 text-cyan-700 hover:bg-cyan-100 cursor-pointer">+{meetings.length - 1}<span className="hidden sm:inline"> buổi</span></button> : isToday && <span className="hidden lg:inline text-[10px] text-cyan-700">Hôm nay</span>}
              </div>
              {meetings.slice(0, 1).map(item => <button key={item._id} type="button" onClick={() => onOpen(item)} title={`${vietnamDateTime(item.startsAt).slice(11)} · ${item.title} · ${labels[item.status] || item.status}${item.seriesId ? " · Định kỳ" : ""}`} className={`flex h-4 min-w-0 shrink-0 items-center gap-1 rounded border px-1 text-left text-[10px] font-normal leading-none sm:text-[11px] cursor-pointer ${item.status === "cancelled" ? "border-rose-100 bg-rose-50 text-rose-700" : "border-cyan-100 bg-cyan-50/80 text-cyan-800 hover:border-cyan-300 hover:bg-cyan-100"}`}>
                <span aria-hidden="true" className={`hidden sm:block h-1.5 w-1.5 shrink-0 rounded-full ${statusDots[item.status] || "bg-slate-400"}`} />
                <span className="truncate">{item.status === "cancelled" ? "Đã hủy · " : ""}{vietnamDateTime(item.startsAt).slice(11)} · {item.title}</span>
              </button>)}
            </div>;
          })}
        </div>
      </div>
    )}

    {createPortal(<dialog ref={dayDialog} aria-labelledby="calendar-day-title" onCancel={() => setSelectedDay(null)} onClose={() => setSelectedDay(null)} onClick={event => { if (event.target === event.currentTarget) closeDay(); }} className="fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-cyan-100 bg-white p-0 text-slate-700 shadow-xl backdrop:bg-slate-900/40">
      {selectedDay && <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div><h2 id="calendar-day-title" className="text-sm font-medium">Lịch ngày {selectedDay ? dateLabel(selectedDay) : ""}</h2><p className="mt-0.5 text-xs text-slate-500">{selectedMeetings.length} buổi</p></div>
          <button type="button" autoFocus aria-label="Đóng lịch ngày" onClick={closeDay} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        {selectedMeetings.length === 0 ? <p className="py-5 text-center text-xs text-slate-500">Chưa có cuộc họp trong ngày này.</p> : <div className="space-y-2">{selectedMeetings.map(item => <article key={item._id} className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">
          <button type="button" onClick={() => { closeDay(); onOpen(item); }} className="w-full text-left cursor-pointer">
            <span className="block text-sm font-medium text-slate-800">{vietnamDateTime(item.startsAt).slice(11)} · {item.title}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusDots[item.status] || "bg-slate-400"}`} />{labels[item.status] || item.status}{item.seriesId ? " · Định kỳ" : ""}</span>
          </button>
          {item.originalStartsAt && new Date(item.originalStartsAt).getTime() !== new Date(item.startsAt).getTime() && <p className="mt-1 text-[11px] text-slate-500">Dời từ {vietnamDateTime(item.originalStartsAt).replace("T", " ")}</p>}
          {canManage && <div className="mt-2 border-t border-cyan-100 pt-2"><MeetingScheduleActions status={item.status} onCancel={() => { closeDay(); onCancel(item); }} onReschedule={() => { closeDay(); onReschedule(item); }} onDelete={() => { closeDay(); onDelete(item); }} /></div>}
        </article>)}</div>}
      </div>}
    </dialog>, document.body)}
  </section>;
}
