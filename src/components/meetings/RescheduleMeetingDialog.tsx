import React, { useState } from "react";
import { X } from "lucide-react";
import { VietnameseDatePicker } from "../common/VietnameseDatePicker";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { vietnamDateTime } from "../../utils/meetingRecurrence";

export function RescheduleMeetingDialog({ meeting, onClose, onConfirm }: {
  meeting: { title: string; startsAt: string };
  onClose: () => void;
  onConfirm: (startsAt: string) => Promise<void>;
}) {
  const original = vietnamDateTime(meeting.startsAt);
  const [date, setDate] = useState(original.slice(0, 10));
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const time = original.slice(11);
  const dateLabel = (value: string) => value.split("-").reverse().join("/");
  const newStart = () => new Date(`${date}T${time}:00+07:00`);
  const validate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(newStart().getTime())) return "Vui lòng chọn ngày mới.";
    if (date === original.slice(0, 10)) return "Vui lòng chọn ngày khác ngày hiện tại của cuộc họp.";
    if (newStart().getTime() <= Date.now()) return "Vui lòng chọn thời gian trong tương lai.";
    return "";
  };

  if (confirming) return <ConfirmDialog isOpen title="Xác nhận dời lịch" description={`Dời cuộc họp “${meeting.title}” từ ${time} ngày ${dateLabel(original.slice(0, 10))} sang ${time} ngày ${dateLabel(date)}? Giữ nguyên thời lượng và các buổi khác trong lịch định kỳ.`} tone="warning" confirmLabel="Xác nhận dời lịch" cancelLabel="Quay lại" isSubmitting={saving} onClose={() => setConfirming(false)} onConfirm={async () => {
    if (saving) return;
    const validation = validate();
    if (validation) { setError(validation); setConfirming(false); return; }
    setSaving(true);
    try { await onConfirm(newStart().toISOString()); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể dời lịch. Vui lòng thử lại."); setConfirming(false); }
    finally { setSaving(false); }
  }} />;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="reschedule-meeting-title" className="w-full max-w-md rounded-2xl border border-cyan-100 bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="reschedule-meeting-title" className="text-base font-medium text-slate-800">Dời lịch cuộc họp</h2>
        <button type="button" aria-label="Đóng dời lịch" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <p className="break-words text-sm text-slate-800">{meeting.title}</p>
      <p className="mb-4 mt-1 text-xs text-slate-500">Lịch hiện tại: {time} · {dateLabel(original.slice(0, 10))}</p>
      <div className="space-y-2">
        <span className="block text-xs text-slate-600">Ngày mới</span>
        <VietnameseDatePicker value={date} onChange={value => { setDate(value); setError(""); }} ariaLabel="Ngày dời cuộc họp" align="left" buttonClassName="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm" />
        <p className="text-xs text-slate-500">Giữ giờ bắt đầu {time} và thời lượng cuộc họp.</p>
        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">Đóng</button>
        <button type="button" onClick={() => { const validation = validate(); setError(validation); if (!validation) setConfirming(true); }} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs text-white hover:bg-cyan-700">Tiếp tục</button>
      </div>
    </section>
  </div>;
}
