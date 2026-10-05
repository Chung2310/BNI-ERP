import React from "react";
import { VietnameseDatePicker } from "../common/VietnameseDatePicker";
import { TimeInput24 } from "../common/TimeInput24";
import { recurringMeetingDates, vietnamDateTime, type MeetingRecurrence } from "../../utils/meetingRecurrence";
export function MeetingRecurrenceFields({ value, onChange }: { value: MeetingRecurrence; onChange: (value: MeetingRecurrence) => void }) {
  let dates: Date[] = [];
  try { dates = recurringMeetingDates(value); } catch { /* Incomplete form */ }
  const field = "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5";
  return <fieldset className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
    <legend className="px-1 font-bold">Tạo lịch</legend>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div><span>Từ ngày</span><VietnameseDatePicker ariaLabel="Ngày bắt đầu chu kỳ" placeholder="Chọn ngày bắt đầu" align="left" className="mt-1" buttonClassName="flex w-full rounded-lg border border-slate-200 bg-white p-2.5" value={value.startDate} onChange={startDate => onChange({ ...value, startDate })} /></div>
      <label>Trong thời gian<select aria-label="Số tháng lặp lại" className={field} value={value.months} onChange={e => onChange({ ...value, months: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} tháng</option>)}</select></label>
      <label>Thứ diễn ra<select aria-label="Thứ diễn ra" className={field} value={value.weekday} onChange={e => onChange({ ...value, weekday: Number(e.target.value) })}>{[1,2,3,4,5,6,0].map(day => <option key={day} value={day}>{day === 0 ? "Chủ nhật" : "Thứ " + ["", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy"][day]}</option>)}</select></label>
      <div><span>Giờ bắt đầu</span><TimeInput24 ariaLabel="Giờ bắt đầu chu kỳ" minuteStep={1} className="mt-1 w-full" value={value.time} onChange={time => onChange({ ...value, time })} /></div>
    </div>
    <label className="mt-3 block">Thời lượng mỗi buổi (phút)<input aria-label="Thời lượng mỗi buổi" type="number" min={1} max={1440} required className={field} value={value.durationMinutes ?? 120} onChange={e => onChange({ ...value, durationMinutes: Number(e.target.value) })} /></label>
    {dates.length > 0 && <details className="mt-3"><summary className="cursor-pointer font-bold">Sẽ tạo {dates.length} buổi · {vietnamDateTime(dates[0]).slice(0,10)} → {vietnamDateTime(dates[dates.length - 1]).slice(0,10)}</summary><ul className="mt-2 grid max-h-36 grid-cols-2 gap-1 overflow-auto">{dates.map(date => <li key={date.toISOString()}>{vietnamDateTime(date).replace("T", " · ")}</li>)}</ul></details>}
  </fieldset>;
}
