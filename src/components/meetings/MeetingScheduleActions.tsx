import React from "react";
import { CalendarDays, Trash2, XCircle } from "lucide-react";

export function MeetingScheduleActions({ status, onCancel, onReschedule, onDelete }: {
  status: string;
  onCancel: () => void;
  onReschedule: () => void;
  onDelete: () => void;
}) {
  if (status === "ended" || status === "cancelled") {
    const statusLabel = status === "ended" ? "đã kết thúc" : "đã hủy";
    return <div className="flex items-center justify-end text-xs font-normal">
      <button type="button" aria-label="Xóa cuộc họp" title={`Xóa cuộc họp ${statusLabel}`} onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Xóa cuộc họp</button>
    </div>;
  }
  const canChangeSchedule = status === "scheduled";
  const unavailable = "Chỉ áp dụng với cuộc họp chưa bắt đầu";
  return <div className="flex items-center gap-2 text-xs font-normal">
    <button type="button" disabled={!canChangeSchedule} title={canChangeSchedule ? "Hủy buổi họp" : unavailable} onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/70 bg-white px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><XCircle className="h-3.5 w-3.5" />Hủy</button>
    <button type="button" disabled={!canChangeSchedule} title={canChangeSchedule ? "Chọn ngày mới cho cuộc họp" : unavailable} onClick={onReschedule} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200/70 bg-white px-2.5 py-1.5 text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><CalendarDays className="h-3.5 w-3.5" />Dời lịch</button>
    <button type="button" aria-label="Xóa cuộc họp" title="Xóa cuộc họp" onClick={onDelete} className="ml-auto rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
  </div>;
}
