import React from "react";
import { Plus, X } from "lucide-react";
import { TimeInput24 } from "../common/TimeInput24";
import { validateSpeakingTimeSlots, type SpeakingTimeSlot } from "../../utils/meetingSpeakingTime";

export function MeetingSpeakingTimeFields({ value, onChange, fallbackSeconds, onFallbackChange, hideTitle = false }: {
  value: SpeakingTimeSlot[];
  onChange: (slots: SpeakingTimeSlot[]) => void;
  fallbackSeconds: number;
  onFallbackChange: (seconds: number) => void;
  hideTitle?: boolean;
}) {
  const error = validateSpeakingTimeSlots(value);
  const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100";
  const update = (index: number, change: Partial<SpeakingTimeSlot>) => onChange(value.map((slot, i) => i === index ? { ...slot, ...change } : slot));
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
      {!hideTitle && <legend className="px-1 font-bold text-slate-700">Thời lượng phát biểu theo giờ check-in</legend>}
      <p className="text-xs text-slate-500">Áp dụng cho thành viên và khách mời, theo giờ Việt Nam. Tính từ giờ bắt đầu đến trước giờ kết thúc của mỗi khung. Check-in trước khung đầu tiên được hưởng số giây của khung đó.</p>
      {value.map((slot, index) => (
        <div key={index} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
          <div className="min-w-0 text-xs text-slate-600"><span>Từ giờ</span>
            <TimeInput24 ariaLabel={`Từ giờ — khung ${index + 1}`} minuteStep={1} selectionTone="brandSoft" className="mt-1 w-full" value={slot.startTime} onChange={startTime => update(index, { startTime })} />
          </div>
          <div className="min-w-0 text-xs text-slate-600"><span>Đến giờ</span>
            <TimeInput24 ariaLabel={`Đến giờ — khung ${index + 1}`} minuteStep={1} selectionTone="brandSoft" className="mt-1 w-full" value={slot.endTime} onChange={endTime => update(index, { endTime })} />
          </div>
          <label className="text-xs text-slate-600">Số giây phát biểu
            <input aria-label={`Số giây phát biểu — khung ${index + 1}`} required type="number" min={1} max={3600} value={slot.seconds} onChange={event => update(index, { seconds: Number(event.target.value) })} className={field} />
          </label>
          <button type="button" aria-label={`Xóa khung giờ ${index + 1}`} disabled={value.length <= 1}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="justify-self-end rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      ))}
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <button type="button" disabled={value.length >= 20}
        onClick={() => onChange([...value, { startTime: value.at(-1)?.endTime || "", endTime: "", seconds: fallbackSeconds }])}
        className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 disabled:opacity-40 cursor-pointer">
        <Plus size={14} /> Thêm khung giờ
      </button>
      <label className="block border-t border-slate-200 pt-3 text-xs font-semibold text-slate-700">Ngoài khung giờ (giây)
        <input required type="number" min={1} max={3600} value={fallbackSeconds} onChange={event => onFallbackChange(Number(event.target.value))} className={field} />
        <span className="mt-1 block font-normal text-slate-500">Dùng sau khung cuối hoặc giữa các khung không liền nhau.</span>
      </label>
    </fieldset>
  );
}
