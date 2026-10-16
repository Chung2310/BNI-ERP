import { useEffect, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { vietnamDateTime } from "../../utils/meetingRecurrence";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { VietnameseMonthPicker } from "../common/VietnameseMonthPicker";

type MeetingOption = { _id: string; title: string; startsAt: string; status: string };
const statusLabels: Record<string, string> = { scheduled: "Sắp diễn ra", live: "Đang diễn ra", paused: "Tạm dừng", ended: "Đã kết thúc", cancelled: "Đã hủy" };
const searchKey = (value: string) => value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

export function MeetingBulkDeleteDialog({ initialMonth, load, remove, onClose, onDeleted }: {
  initialMonth: string;
  load: () => Promise<MeetingOption[]>;
  remove: (ids: string[]) => Promise<void>;
  onClose: () => void;
  onDeleted: (count: number) => void;
}) {
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState(initialMonth);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    load().then(items => {
      if (!active) return;
      setMeetings(items);
      setLoading(false);
    }).catch(cause => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách cuộc họp.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [load]);

  const monthMeetings = meetings.filter(item => vietnamDateTime(item.startsAt).slice(0, 7) === month);
  const query = searchKey(search.trim());
  const visibleMeetings = monthMeetings.filter(item => searchKey(item.title).includes(query));
  const toggle = (id: string) => setSelected(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const confirmDelete = async () => {
    if (!selected.size || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await remove([...selected]);
      onDeleted(selected.size);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa các cuộc họp đã chọn.");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  return <>
    {!confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" role="presentation" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Xóa hàng loạt cuộc họp" className="flex w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-2xl sm:p-6 max-h-[90dvh]">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-rose-700">Xóa hàng loạt cuộc họp</h2><p className="mt-1 text-xs text-slate-500">Chọn tháng để xem cuộc họp, sau đó tick từng cuộc họp hoặc chọn tất cả.</p></div>
          <button type="button" aria-label="Đóng" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-b border-slate-200 pb-4">
          <div className="text-xs font-medium text-slate-700"><span className="mb-1 block">Lọc theo tháng</span><VietnameseMonthPicker value={month} onChange={next => { setMonth(next); setSelected(new Set()); }} currentMonth={vietnamDateTime(new Date()).slice(0, 7)} ariaLabel="Lọc theo tháng" /></div>
          <label className="min-w-44 flex-1 text-xs font-medium text-slate-700"><span className="mb-1 block">Tìm cuộc họp</span><span className="flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 focus-within:border-cyan-500"><Search className="h-4 w-4 shrink-0 text-slate-400" /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setSelected(new Set()); }} placeholder="Nhập tên cuộc họp..." className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none" /></span></label>
          <button type="button" disabled={loading || !visibleMeetings.length} onClick={() => setSelected(selected.size === visibleMeetings.length ? new Set() : new Set(visibleMeetings.map(item => item._id)))} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{selected.size === visibleMeetings.length && visibleMeetings.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}</button>
          <span className="ml-auto text-xs font-semibold text-slate-600">Đã chọn {selected.size}/{visibleMeetings.length}</span>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200">
          {loading ? <p role="status" className="p-4 text-sm text-slate-500">Đang tải danh sách...</p> : visibleMeetings.length ? visibleMeetings.map(item => <label key={item._id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 hover:bg-slate-50">
            <input type="checkbox" aria-label={`Chọn ${item.title}`} checked={selected.has(item._id)} onChange={() => toggle(item._id)} className="h-4 w-4 shrink-0 accent-rose-600" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{item.title}</span>
            <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{statusLabels[item.status] || item.status}</span>
            <span className="shrink-0 text-xs text-slate-500">{vietnamDateTime(item.startsAt).replace("T", " ")}</span>
          </label>) : <p className="p-4 text-sm text-slate-500">{query ? "Không tìm thấy cuộc họp phù hợp trong tháng này." : "Không có cuộc họp trong tháng này."}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Đóng</button>
          <button type="button" disabled={!selected.size || loading} onClick={() => setConfirming(true)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />Xóa {selected.size} cuộc họp</button>
        </div>
      </div>
    </div>}
    <ConfirmDialog isOpen={confirming} title="Xác nhận xóa hàng loạt" description={`Xóa vĩnh viễn ${selected.size} cuộc họp đã chọn cùng dữ liệu check-in và quay chọn người của từng cuộc họp? Thao tác này không thể hoàn tác.`} tone="danger" confirmLabel={`Xóa ${selected.size} cuộc họp`} cancelLabel="Quay lại" isSubmitting={deleting} onClose={() => setConfirming(false)} onConfirm={confirmDelete} />
  </>;
}
