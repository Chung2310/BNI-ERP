import React from "react";
import { recurringMeetingDates, vietnamDateTime, type MeetingRecurrence } from "../../utils/meetingRecurrence";
export function MeetingRecurrenceFields({ value, onChange }: { value: MeetingRecurrence; onChange: (value: MeetingRecurrence) => void }) {
  let dates: Date[] = [];
  try { dates = recurringMeetingDates(value); } catch { /* Incomplete form */ }
  const field = "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5";
  return <fieldset className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
    <legend className="px-1 font-bold">Lịch lặp hằng tuần</legend>
    <div className="grid grid-cols-2 gap-3">
      <label>Từ ngày<input aria-label="Ngày bắt đầu chu kỳ" required type="date" className={field} value={value.startDate} onChange={e => onChange({ ...value, startDate: e.target.value })} /></label>
      <label>Trong thời gian<select aria-label="Số tháng lặp lại" className={field} value={value.months} onChange={e => onChange({ ...value, months: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} tháng</option>)}</select></label>
      <label>Thứ diễn ra<select aria-label="Thứ diễn ra" className={field} value={value.weekday} onChange={e => onChange({ ...value, weekday: Number(e.target.value) })}>{[1,2,3,4,5,6,0].map(day => <option key={day} value={day}>{day === 0 ? "Chủ nhật" : "Thứ " + ["", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy"][day]}</option>)}</select></label>
      <label>Giờ bắt đầu (Việt Nam)<input aria-label="Giờ bắt đầu chu kỳ" required type="time" className={field} value={value.time} onChange={e => onChange({ ...value, time: e.target.value })} /></label>
    </div>
    <label className="mt-3 block">Thời lượng mỗi buổi (phút)<input aria-label="Thời lượng mỗi buổi" type="number" min={1} max={1440} required className={field} value={value.durationMinutes ?? 120} onChange={e => onChange({ ...value, durationMinutes: Number(e.target.value) })} /></label>
    <p className="mt-3 text-slate-600">Lặp mỗi tuần trong số tháng đã chọn, tính từ ngày bắt đầu. Mỗi buổi có thể sửa, hủy hoặc dời riêng.</p>
    {dates.length > 0 && <details className="mt-3"><summary className="cursor-pointer font-bold">Sẽ tạo {dates.length} buổi · {vietnamDateTime(dates[0]).slice(0,10)} → {vietnamDateTime(dates[dates.length - 1]).slice(0,10)}</summary><ul className="mt-2 grid max-h-36 grid-cols-2 gap-1 overflow-auto">{dates.map(date => <li key={date.toISOString()}>{vietnamDateTime(date).replace("T", " · ")}</li>)}</ul></details>}
  </fieldset>;
}
