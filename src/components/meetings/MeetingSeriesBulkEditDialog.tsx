import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { vietnamDateTime } from "../../utils/meetingRecurrence";
import type { SpeakingTier } from "../../utils/meetingSpeakingTime";

export type MeetingSeriesChanges = {
  location?: string;
  startsTime?: string;
  durationMinutes?: number;
  coverImage?: string;
  tiers?: SpeakingTier[];
  fallbackSeconds?: number;
};

type MeetingForBulkEdit = { _id: string; title: string; startsAt: string };

type MeetingSeriesBulkEditDialogProps = {
  meeting: MeetingForBulkEdit;
  meetings: MeetingForBulkEdit[];
  changes: MeetingSeriesChanges;
  loading: boolean;
  saving: boolean;
  onClose: () => void;
  onApply: (meetingIds: string[]) => Promise<void>;
};

const changeLabels: Record<keyof MeetingSeriesChanges, string> = {
  location: "\u0110\u1ecba \u0111i\u1ec3m",
  startsTime: "Gi\u1edd b\u1eaft \u0111\u1ea7u",
  durationMinutes: "Th\u1eddi l\u01b0\u1ee3ng",
  coverImage: "\u1ea2nh b\u00eca",
  tiers: "Th\u1eddi l\u01b0\u1ee3ng ph\u00e1t bi\u1ec3u",
  fallbackSeconds: "Th\u1eddi l\u01b0\u1ee3ng ph\u00e1t bi\u1ec3u",
};

export function MeetingSeriesBulkEditDialog({ meeting, meetings, changes, loading, saving, onClose, onApply }: MeetingSeriesBulkEditDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const allSelected = meetings.length > 0 && selectedIds.length === meetings.length;
  const changedLabels = [...new Set(Object.keys(changes).map(key => changeLabels[key as keyof MeetingSeriesChanges]))];

  const toggleMeeting = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const confirmSelection = async () => {
    if (!pendingIds || saving) return;
    try {
      await onApply(pendingIds);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt c\u00e1c bu\u1ed5i h\u1ecdp.");
      setPendingIds(null);
    }
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-xs sm:p-5" onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="series-bulk-select-title" className="my-auto max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 id="series-bulk-select-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><Check className="h-4 w-4 text-cyan-600" />Ch&#7885;n bu&#7893;i h&#7885;p &#225;p d&#7909;ng</h2>
          <p className="mt-1 text-xs text-slate-500">Ch&#7885;n c&#225;c bu&#7893;i trong chu k&#7923; c&#7911;a {meeting.title}.</p>
        </div>
        <button type="button" aria-label="&#272;&#243;ng" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </header>

      <p className="mb-3 rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
        S&#7869; c&#7853;p nh&#7853;t: {changedLabels.join("\u00b7")}. C&#225;c th&#244;ng tin kh&#225;c gi&#7919; nguy&#234;n.
      </p>

      <label className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
        <input type="checkbox" checked={allSelected} disabled={loading || meetings.length === 0} onChange={() => setSelectedIds(allSelected ? [] : meetings.map(item => item._id))} />
        Ch&#7885;n t&#7845;t c&#7843; ({meetings.length})
      </label>

      <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
        {loading ? <p className="py-8 text-center text-sm text-slate-500">&#272;ang t&#7843;i c&#225;c bu&#7893;i h&#7885;p...</p> : meetings.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Kh&#244;ng c&#242;n bu&#7893;i h&#7885;p &#273;&#7883;nh k&#7923; n&#224;o s&#7855;p di&#7877;n ra.</p> : meetings.map(item => {
          const local = vietnamDateTime(item.startsAt);
          const date = local.slice(8, 10) + "/" + local.slice(5, 7) + "/" + local.slice(0, 4);
          return <label key={item._id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:border-cyan-300 hover:bg-cyan-50/40">
            <input type="checkbox" checked={selectedIds.includes(item._id)} onChange={() => toggleMeeting(item._id)} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
                <span>{date} &#183; {local.slice(11, 16)}</span>
                {item._id === meeting._id && <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] text-cyan-800">Bu&#7893;i &#273;ang s&#7917;a</span>}
              </span>
              <span className="mt-1 block truncate text-xs text-slate-600">{item.title}</span>
            </span>
          </label>;
        })}
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
      <footer className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">&#272;&#243;ng</button>
        <button type="button" disabled={loading || saving || selectedIds.length === 0} onClick={() => { setError(""); setPendingIds([...selectedIds]); }} className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">&#193;p d&#7909;ng ({selectedIds.length})</button>
      </footer>
    </section>
    <ConfirmDialog isOpen={pendingIds !== null} title="X&#225;c nh&#7853;n &#225;p d&#7909;ng h&#224;ng lo&#7841;t?" description={"\u00c1p d\u1ee5ng th\u00f4ng tin v\u1eeba ch\u1ec9nh s\u1eeda cho " + (pendingIds?.length || 0) + " bu\u1ed5i h\u1ecdp \u0111\u00e3 ch\u1ecdn? C\u00e1c th\u00f4ng tin kh\u00e1c s\u1ebd gi\u1eef nguy\u00ean."} confirmLabel="&#193;p d&#7909;ng" cancelLabel="Quay l&#7841;i" tone="warning" isSubmitting={saving} onClose={() => setPendingIds(null)} onConfirm={confirmSelection} />
  </div>;
}
