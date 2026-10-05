import React from "react";
import { DateInputScroll } from "../common/DateInputScroll";
import { TimeInput24 } from "../common/TimeInput24";
import { PickerSelect } from "../common/PickerSelect";
import { recurringMeetingDates, vietnamDateTime, type MeetingRecurrence } from "../../utils/meetingRecurrence";
export function MeetingRecurrenceFields({ value, onChange }: { value: MeetingRecurrence; onChange: (value: MeetingRecurrence) => void }) {
  let dates: Date[] = [];
  try { dates = recurringMeetingDates(value); } catch { /* Incomplete form */ }
  const previewDates = dates.map(date => {
    const [day, time] = vietnamDateTime(date).split("T");
    return { key: date.toISOString(), day: day.split("-").reverse().join("/"), time };
  });
  const duration = value.durationMinutes ?? 120;
  return <fieldset className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
    <legend className="px-1 font-bold">Tạo lịch</legend>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div><span>Từ ngày</span><DateInputScroll ariaLabel="Ngày bắt đầu chu kỳ" placeholder="Chọn ngày bắt đầu" className="mt-1 w-full" value={value.startDate} onChange={startDate => onChange({ ...value, startDate })} /></div>
      <div><span>Trong thời gian</span><PickerSelect ariaLabel="Số tháng lặp lại" className="mt-1 w-full" value={value.months} onChange={months => onChange({ ...value, months })} options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1} tháng` }))} /></div>
      <div><span>Thứ diễn ra</span><PickerSelect ariaLabel="Thứ diễn ra" className="mt-1 w-full" value={value.weekday} onChange={weekday => onChange({ ...value, weekday })} options={[1,2,3,4,5,6,0].map(day => ({ value: day, label: day === 0 ? "Chủ nhật" : "Thứ " + ["", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy"][day] }))} /></div>
      <div><span>Giờ bắt đầu</span><TimeInput24 ariaLabel="Giờ bắt đầu chu kỳ" minuteStep={1} selectionTone="brandSoft" className="mt-1 w-full" value={value.time} onChange={time => onChange({ ...value, time })} /></div>
    </div>
    <div className="mt-3">
      <label className="block">Thời lượng mỗi buổi (phút)
        <input aria-label="Thời lượng mỗi buổi" type="number" inputMode="numeric" min={1} max={1440} step={1} required
          className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-normal focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={duration || ""} onChange={e => onChange({ ...value, durationMinutes: Number(e.target.value) })} />
      </label>
      <div role="group" aria-label="Chọn nhanh thời lượng" className="mt-2 flex flex-wrap gap-2">
        {[60, 90, 120].map(minutes => <button key={minutes} type="button" aria-pressed={duration === minutes}
          onClick={() => onChange({ ...value, durationMinutes: minutes })}
          className={`rounded-lg border px-3 py-1.5 text-xs font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${duration === minutes ? "border-cyan-300 bg-cyan-100 text-cyan-700" : "border-cyan-200 bg-white text-slate-600 hover:bg-cyan-50"}`}>
          {minutes} phút
        </button>)}
      </div>
    </div>
    {previewDates.length > 0 && <details className="mt-3"><summary className="cursor-pointer font-bold">Sẽ tạo {previewDates.length} buổi · {previewDates[0].day} → {previewDates[previewDates.length - 1].day}</summary><ul className="mt-2 grid max-h-36 grid-cols-2 gap-1 overflow-auto">{previewDates.map(date => <li key={date.key}>{date.day} · {date.time}</li>)}</ul></details>}
  </fieldset>;
}
