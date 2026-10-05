import React, { useState } from "react";
import { Pencil, X } from "lucide-react";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { MeetingCoverImageField } from "./MeetingCoverImageField";
import { MeetingSpeakingTimeFields } from "./MeetingSpeakingTimeFields";
import { vietnamDateTime } from "../../utils/meetingRecurrence";
import { speakingTimeSlotsForEdit, type SpeakingTier, type SpeakingTimeSlot } from "../../utils/meetingSpeakingTime";

export type MeetingSeriesChanges = {
  title?: string;
  description?: string;
  location?: string;
  startsTime?: string;
  latitude?: number | null;
  longitude?: number | null;
  gpsRadiusMeters?: number;
  coverImage?: string;
  reminderDays?: number;
  tiers?: SpeakingTier[];
  fallbackSeconds?: number;
};

type MeetingForBulkEdit = {
  _id: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  latitude?: number;
  longitude?: number;
  gpsRadiusMeters?: number;
  coverImage?: string;
  reminderDays?: number;
  tiers?: SpeakingTier[];
  fallbackSeconds?: number;
};

const anchorRange = (startsAt: string) => {
  const date = vietnamDateTime(startsAt).slice(0, 10);
  const end = new Date(date + "T00:00:00Z");
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { date, end: end.toISOString().slice(0, 10) };
};

export function MeetingSeriesBulkEditDialog({ meeting, saving, onClose, onApply }: {
  meeting: MeetingForBulkEdit;
  saving: boolean;
  onClose: () => void;
  onApply: (dateFrom: string, dateTo: string, changes: MeetingSeriesChanges) => Promise<void>;
}) {
  const range = anchorRange(meeting.startsAt);
  const [dateFrom, setDateFrom] = useState(range.date);
  const [dateTo, setDateTo] = useState(range.end);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState(meeting.title);
  const [description, setDescription] = useState(meeting.description || "");
  const [location, setLocation] = useState(meeting.location || "");
  const [startsTime, setStartsTime] = useState(vietnamDateTime(meeting.startsAt).slice(11, 16));
  const [latitude, setLatitude] = useState(meeting.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(meeting.longitude?.toString() || "");
  const [gpsRadiusMeters, setGpsRadiusMeters] = useState(meeting.gpsRadiusMeters || 200);
  const [coverImage, setCoverImage] = useState(meeting.coverImage || "");
  const [reminderDays, setReminderDays] = useState(meeting.reminderDays ?? 1);
  const [tiers, setTiers] = useState(() => speakingTimeSlotsForEdit(meeting.tiers));
  const [fallbackSeconds, setFallbackSeconds] = useState(meeting.fallbackSeconds || 20);
  const [pending, setPending] = useState<{ from: string; to: string; changes: MeetingSeriesChanges } | null>(null);
  const [error, setError] = useState("");

  const toggle = (key: string) => setEnabled(current => ({ ...current, [key]: !current[key] }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!dateFrom || !dateTo || dateFrom > dateTo) { setError("Vui lòng chọn khoảng ngày hợp lệ."); return; }
    const changes: MeetingSeriesChanges = {};
    if (enabled.title) changes.title = title;
    if (enabled.description) changes.description = description;
    if (enabled.location) changes.location = location;
    if (enabled.startsTime) changes.startsTime = startsTime;
    if (enabled.gps) {
      if (Boolean(latitude) !== Boolean(longitude)) { setError("Vui lòng nhập cả vĩ độ và kinh độ, hoặc xóa cả hai."); return; }
      changes.latitude = latitude ? Number(latitude) : null;
      changes.longitude = longitude ? Number(longitude) : null;
      changes.gpsRadiusMeters = gpsRadiusMeters;
    }
    if (enabled.coverImage) changes.coverImage = coverImage;
    if (enabled.reminderDays) changes.reminderDays = reminderDays;
    if (enabled.speakingTimes) { changes.tiers = tiers; changes.fallbackSeconds = fallbackSeconds; }
    if (!Object.keys(changes).length) { setError("Hãy chọn ít nhất một mục muốn cập nhật."); return; }
    setPending({ from: dateFrom, to: dateTo, changes });
  };

  const confirmApply = async () => {
    if (!pending || saving) return;
    try { await onApply(pending.from, pending.to, pending.changes); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật các buổi họp."); setPending(null); }
  };

  const option = (key: string, label: string, children: React.ReactNode) => <fieldset className="rounded-xl border border-slate-200 p-3">
    <label className="flex items-center gap-2 font-semibold text-slate-700"><input type="checkbox" checked={Boolean(enabled[key])} onChange={() => toggle(key)} />{label}</label>
    {enabled[key] && <div className="mt-3">{children}</div>}
  </fieldset>;

  return <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-xs sm:p-5">
    <section role="dialog" aria-modal="true" aria-labelledby="series-bulk-edit-title" className="my-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div><h2 id="series-bulk-edit-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><Pencil className="h-4 w-4 text-cyan-600" />Chỉnh sửa nhiều buổi định kỳ</h2>
          <p className="mt-1 text-xs text-slate-500">Chọn khoảng ngày và đánh dấu những thông tin cần đổi. Mục không chọn sẽ được giữ nguyên.</p></div>
        <button type="button" aria-label="Đóng chỉnh sửa hàng loạt" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </header>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-cyan-50/70 p-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Từ ngày<input aria-label="Từ ngày áp dụng" type="date" required value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label>
          <label className="text-xs font-semibold text-slate-700">Đến ngày<input aria-label="Đến ngày áp dụng" type="date" required value={dateTo} min={dateFrom} onChange={event => setDateTo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label>
        </div>
        <p className="text-xs text-slate-500">Chỉ cập nhật các buổi chưa diễn ra trong chu kỳ này. Đổi giờ sẽ giữ nguyên ngày và thời lượng từng buổi.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {option("title", "Tên cuộc họp", <input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} className="w-full rounded-lg border border-slate-200 p-2" />)}
          {option("description", "Mô tả", <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={4000} rows={3} className="w-full rounded-lg border border-slate-200 p-2" />)}
          {option("location", "Địa điểm / Link họp", <input value={location} onChange={event => setLocation(event.target.value)} maxLength={500} className="w-full rounded-lg border border-slate-200 p-2" />)}
          {option("startsTime", "Giờ bắt đầu", <input aria-label="Giờ bắt đầu mới" type="time" required value={startsTime} onChange={event => setStartsTime(event.target.value)} className="w-full rounded-lg border border-slate-200 p-2" />)}
          {option("gps", "Vị trí GPS check-in", <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Vĩ độ<input aria-label="Vĩ độ mới" type="number" step="any" min={-90} max={90} value={latitude} onChange={event => setLatitude(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="text-xs">Kinh độ<input aria-label="Kinh độ mới" type="number" step="any" min={-180} max={180} value={longitude} onChange={event => setLongitude(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="col-span-2 text-xs">Bán kính (m)<input aria-label="Bán kính check-in mới" type="number" min={50} max={5000} value={gpsRadiusMeters} onChange={event => setGpsRadiusMeters(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2" /></label>
          </div>)}
          {option("coverImage", "Ảnh bìa", <MeetingCoverImageField value={coverImage} onChange={setCoverImage} />)}
          {option("reminderDays", "Nhắc hẹn trước (ngày)", <input aria-label="Số ngày nhắc hẹn mới" type="number" min={0} max={365} value={reminderDays} onChange={event => setReminderDays(Number(event.target.value))} className="w-full rounded-lg border border-slate-200 p-2" />)}
        </div>
        <div>{option("speakingTimes", "Thời lượng phát biểu", <MeetingSpeakingTimeFields value={tiers} onChange={setTiers} fallbackSeconds={fallbackSeconds} onFallbackChange={setFallbackSeconds} />)}</div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
        <footer className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Đóng</button>
          <button type="submit" className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800">Tiếp tục</button>
        </footer>
      </form>
    </section>
    <ConfirmDialog isOpen={Boolean(pending)} title="Xác nhận cập nhật nhiều buổi?" description={`Các thông tin đã chọn sẽ được áp dụng cho những buổi chưa diễn ra từ ${pending?.from || ""} đến ${pending?.to || ""}. Các thông tin khác sẽ giữ nguyên.`} confirmLabel="Áp dụng thay đổi" cancelLabel="Quay lại" tone="warning" isSubmitting={saving} onClose={() => setPending(null)} onConfirm={confirmApply} />
  </div>;
}
