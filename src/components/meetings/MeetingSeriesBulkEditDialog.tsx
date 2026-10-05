import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { MeetingCoverImageField } from "./MeetingCoverImageField";
import { MeetingSpeakingTimeFields } from "./MeetingSpeakingTimeFields";
import { vietnamDateTime } from "../../utils/meetingRecurrence";
import { speakingTimeSlotsForEdit, validateSpeakingTimeSlots, type SpeakingTimeSlot, type SpeakingTier } from "../../utils/meetingSpeakingTime";

export type MeetingSeriesChanges = {
  location?: string;
  startsTime?: string;
  durationMinutes?: number;
  coverImage?: string;
  tiers?: SpeakingTier[];
  fallbackSeconds?: number;
};

export type MeetingSeriesBulkEditField = "location" | "coverImage" | "startsTime" | "durationMinutes" | "speakingTime";

type MeetingForBulkEdit = {
  _id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  coverImage?: string;
  tiers?: SpeakingTier[];
  fallbackSeconds?: number;
};

export type MeetingSeriesBulkEditSeed = {
  location: string;
  startsTime: string;
  durationMinutes: number;
  coverImage: string;
  tiers: SpeakingTimeSlot[];
  fallbackSeconds: number;
};

type MeetingSeriesBulkEditDialogProps = {
  meeting: MeetingForBulkEdit;
  meetings: MeetingForBulkEdit[];
  seed: MeetingSeriesBulkEditSeed;
  initiallySelected?: MeetingSeriesBulkEditField[];
  loading: boolean;
  saving: boolean;
  onClose: () => void;
  onApply: (meetingIds: string[], changes: MeetingSeriesChanges) => Promise<void>;
};

const changeLabels: Record<keyof MeetingSeriesChanges, string> = {
  location: "\u0110\u1ecba \u0111i\u1ec3m",
  startsTime: "Gi\u1edd b\u1eaft \u0111\u1ea7u",
  durationMinutes: "Th\u1eddi l\u01b0\u1ee3ng bu\u1ed5i h\u1ecdp",
  coverImage: "\u1ea2nh b\u00eca",
  tiers: "Th\u1eddi l\u01b0\u1ee3ng ph\u00e1t bi\u1ec3u theo gi\u1edd check-in",
  fallbackSeconds: "Th\u1eddi l\u01b0\u1ee3ng ph\u00e1t bi\u1ec3u theo gi\u1edd check-in",
};

const monthOf = (startsAt: string) => vietnamDateTime(startsAt).slice(0, 7);
const monthLabel = (month: string) => `Th\u00e1ng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`;

export function MeetingSeriesBulkEditDialog({ meeting, meetings, seed, loading, saving, onClose, onApply }: MeetingSeriesBulkEditDialogProps) {
  const [step, setStep] = useState<"edit" | "select">("edit");
  const [values, setValues] = useState(seed);
  const [changes, setChanges] = useState<MeetingSeriesChanges | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const months = [...new Set(meetings.map(item => monthOf(item.startsAt)))].sort();
  const allSelected = meetings.length > 0 && selectedIds.length === meetings.length;
  const changedLabels = changes ? [...new Set(Object.keys(changes).map(key => changeLabels[key as keyof MeetingSeriesChanges]))] : [];

  const updateValue = <K extends keyof MeetingSeriesBulkEditSeed>(key: K, value: MeetingSeriesBulkEditSeed[K]) => setValues(current => ({ ...current, [key]: value }));
  const toggleMeeting = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleMonth = (month: string) => {
    const idsInMonth = meetings.filter(item => monthOf(item.startsAt) === month).map(item => item._id);
    const monthSelected = idsInMonth.length > 0 && idsInMonth.every(id => selectedIds.includes(id));
    setSelectedIds(current => monthSelected ? current.filter(id => !idsInMonth.includes(id)) : [...new Set([...current, ...idsInMonth])]);
  };

  const continueToSelection = () => {
    setError("");
    const next: MeetingSeriesChanges = {};
    const originalStart = vietnamDateTime(meeting.startsAt);
    const originalDuration = meeting.endsAt
      ? Math.max(1, Math.round((new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime()) / 60000))
      : 120;
    const originalTiers = speakingTimeSlotsForEdit(meeting.tiers);

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.startsTime)) { setError("Vui l\u00f2ng nh\u1eadp gi\u1edd b\u1eaft \u0111\u1ea7u h\u1ee3p l\u1ec7."); return; }
    if (!Number.isInteger(values.durationMinutes) || values.durationMinutes < 1 || values.durationMinutes > 1440) { setError("Th\u1eddi l\u01b0\u1ee3ng ph\u1ea3i t\u1eeb 1 ph\u00fat \u0111\u1ebfn 1440 ph\u00fat."); return; }
    const slotError = validateSpeakingTimeSlots(values.tiers);
    if (slotError) { setError(slotError); return; }
    if (!Number.isInteger(values.fallbackSeconds) || values.fallbackSeconds < 1 || values.fallbackSeconds > 3600) { setError("Th\u1eddi l\u01b0\u1ee3ng ph\u00e1t bi\u1ec3u ngo\u00e0i khung ph\u1ea3i t\u1eeb 1 \u0111\u1ebfn 3600 gi\u00e2y."); return; }

    if (values.location !== (meeting.location || "")) next.location = values.location;
    if (values.coverImage !== (meeting.coverImage || "")) next.coverImage = values.coverImage;
    if (values.startsTime !== originalStart.slice(11, 16)) next.startsTime = values.startsTime;
    if (values.durationMinutes !== originalDuration) next.durationMinutes = values.durationMinutes;
    if (JSON.stringify(values.tiers) !== JSON.stringify(originalTiers)) next.tiers = values.tiers;
    if (values.fallbackSeconds !== (meeting.fallbackSeconds || 20)) next.fallbackSeconds = values.fallbackSeconds;
    if (!Object.keys(next).length) { setError("H\u00e3y thay \u0111\u1ed5i \u00edt nh\u1ea5t m\u1ed9t th\u00f4ng tin c\u1ea7n c\u1eadp nh\u1eadt."); return; }
    setChanges(next);
    setStep("select");
  };

  const confirmSelection = async () => {
    if (!pendingIds || !changes || saving) return;
    try {
      await onApply(pendingIds, changes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt c\u00e1c bu\u1ed5i h\u1ecdp.");
      setPendingIds(null);
    }
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-xs sm:p-5" onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="series-bulk-title" className="my-auto max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 id="series-bulk-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><Check className="h-4 w-4 text-cyan-600" />S&#7917;a h&#224;ng lo&#7841;t</h2>
          <p className="mt-1 text-xs text-slate-500">{meeting.title}</p>
        </div>
        <button type="button" aria-label="&#272;&#243;ng" onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="h-4 w-4" /></button>
      </header>

      {step === "edit" ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-800">
            &#272;&#7883;a &#273;i&#7875;m / Link h&#7885;p
            <input value={values.location} disabled={saving} onChange={event => updateValue("location", event.target.value)} maxLength={500} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 font-normal disabled:bg-slate-50 disabled:text-slate-400" />
          </label>
          <div className="rounded-xl border border-slate-200 p-3"><MeetingCoverImageField value={values.coverImage} disabled={saving} onChange={value => updateValue("coverImage", value)} /></div>
          <label className="rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-800">
            Gi&#7901; b&#7855;t &#273;&#7847;u
            <input type="time" value={values.startsTime} disabled={saving} onChange={event => updateValue("startsTime", event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 font-normal disabled:bg-slate-50 disabled:text-slate-400" />
          </label>
          <label className="rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-800">
            Th&#7901;i l&#432;&#7907;ng bu&#7893;i h&#7885;p (ph&#250;t)
            <input type="number" min={1} max={1440} value={values.durationMinutes} disabled={saving} onChange={event => updateValue("durationMinutes", Number(event.target.value))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 font-normal disabled:bg-slate-50 disabled:text-slate-400" />
          </label>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-sm font-bold text-slate-800">Th&#7901;i l&#432;&#7907;ng ph&#225;t bi&#7875;u theo gi&#7901; check-in</h3>
            <MeetingSpeakingTimeFields value={values.tiers} onChange={value => updateValue("tiers", value)} fallbackSeconds={values.fallbackSeconds} onFallbackChange={value => updateValue("fallbackSeconds", value)} hideTitle />
          </div>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
        <footer className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">&#272;&#243;ng</button>
          <button type="button" onClick={continueToSelection} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50">{loading ? <>Đang tải danh sách...</> : <>Ch&#7885;n bu&#7893;i &#225;p d&#7909;ng</>} <ArrowRight className="h-4 w-4" /></button>
        </footer>
      </> : <>
        <p className="mb-3 rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-900">S&#7869; c&#7853;p nh&#7853;t: {changedLabels.join("\u00b7")}. C&#225;c th&#244;ng tin kh&#225;c gi&#7919; nguy&#234;n.</p>
        <div className="mb-3 rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-bold text-slate-800">Ch&#7885;n nhanh theo th&#225;ng</p>
          <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={allSelected} disabled={loading || meetings.length === 0 || saving} onChange={() => setSelectedIds(allSelected ? [] : meetings.map(item => item._id))} />
            Ch&#7885;n t&#7845;t c&#7843; ({meetings.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {months.map(month => {
              const idsInMonth = meetings.filter(item => monthOf(item.startsAt) === month).map(item => item._id);
              const monthSelected = idsInMonth.length > 0 && idsInMonth.every(id => selectedIds.includes(id));
              return <label key={month} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
                <input type="checkbox" checked={monthSelected} disabled={loading || saving} onChange={() => toggleMonth(month)} />
                {monthLabel(month)}
              </label>;
            })}
          </div>
        </div>
        <div className="max-h-[42dvh] space-y-2 overflow-y-auto pr-1">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">&#272;ang t&#7843;i c&#225;c bu&#7893;i h&#7885;p...</p> : meetings.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Kh&#244;ng c&#242;n bu&#7893;i h&#7885;p &#273;&#7883;nh k&#7923; n&#224;o s&#7855;p di&#7877;n ra.</p> : meetings.map(item => {
            const local = vietnamDateTime(item.startsAt);
            const date = local.slice(8, 10) + "/" + local.slice(5, 7) + "/" + local.slice(0, 4);
            return <label key={item._id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:border-cyan-300 hover:bg-cyan-50/40">
              <input type="checkbox" checked={selectedIds.includes(item._id)} disabled={saving} onChange={() => toggleMeeting(item._id)} />
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
        <footer className="mt-4 flex justify-between gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={() => { setError(""); setStep("edit"); }} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />Quay l&#7841;i</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">&#272;&#243;ng</button>
            <button type="button" disabled={loading || saving || selectedIds.length === 0} onClick={() => { setError(""); setPendingIds([...selectedIds]); }} className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">&#193;p d&#7909;ng ({selectedIds.length})</button>
          </div>
        </footer>
      </>}
    </section>
    <ConfirmDialog isOpen={pendingIds !== null} title={"\u0058\u00e1c nh\u1eadn c\u1eadp nh\u1eadt h\u00e0ng lo\u1ea1t?"} description={"C\u1eadp nh\u1eadt c\u00e1c th\u00f4ng tin \u0111\u00e3 ch\u1ecdn cho " + (pendingIds?.length || 0) + " bu\u1ed5i h\u1ecdp?"} confirmLabel={"\u0058\u00e1c nh\u1eadn"} cancelLabel={"Quay l\u1ea1i"} tone="warning" isSubmitting={saving} onClose={() => setPendingIds(null)} onConfirm={confirmSelection} />
  </div>;
}
