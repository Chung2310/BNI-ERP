import React, { useCallback, useEffect, useState } from "react";
import { MessageSquareText, QrCode, Play, Square } from "lucide-react";
import { meetingInteractionService, type MeetingInteractionState } from "../../services/meetingInteractionService";
import { socketService } from "../../services/socketService";
import type { AudienceResponsePanel } from "../../utils/meetingPresentation";

type Props = {
  meetingId: string;
  panel: AudienceResponsePanel;
  now: number;
  disabled: boolean;
  onPanelChange: (panel: AudienceResponsePanel) => Promise<boolean>;
};

export function AudienceResponseRemote({ meetingId, panel, now, disabled, onPanelChange }: Props) {
  const [interaction, setInteraction] = useState<MeetingInteractionState | null>(null);
  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => meetingInteractionService.get(meetingId)
    .then(value => { setInteraction(value); setError(""); })
    .catch(cause => setError(cause instanceof Error ? cause.message : "Không tải được câu hỏi.")), [meetingId]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    const unsubscribe = socketService.on<{ meetingId: string }>("meeting_interaction_updated", event => {
      if (event.meetingId === meetingId) void load();
    });
    return () => { window.clearInterval(interval); unsubscribe(); };
  }, [load, meetingId]);

  const session = interaction?.session;
  const closesAt = session?.closesAt ? Date.parse(session.closesAt) : NaN;
  const accepting = session?.status === "open" && Number.isFinite(closesAt) && now < closesAt;
  const expired = Boolean(session?.openedAt && Number.isFinite(closesAt) && now >= closesAt);
  const remaining = accepting ? Math.max(0, Math.ceil((closesAt - now) / 1000)) : 0;
  const selected = panel === "questions" ? "questions" : panel === "results" ? "results" : "qr";
  const duration = durationDraft ?? String(session?.durationSeconds ?? 60);

  const toggleResponses = async () => {
    if (!session || disabled || busy) return;
    const seconds = Number(duration);
    if (!accepting && (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)) {
      setError("Thời gian phải từ 1 đến 3600 giây.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!accepting) {
        if (!await onPanelChange("prepare")) return;
        if (seconds !== session.durationSeconds) {
          const question = session.questions.find(item => item.id === session.activeQuestionId) || session.questions[0];
          if (!question) throw new Error("Chưa có câu hỏi để nhận câu trả lời.");
          const saved = await meetingInteractionService.save(meetingId, {
            question: question.text,
            type: question.type || "text",
            ...(question.type === "single_choice" ? { options: question.options || [] } : {}),
            durationSeconds: seconds,
            requireName: false,
            showNames: false,
            moderationEnabled: false,
            allowMultipleResponses: true,
          });
          setInteraction(saved);
        }
      }
      const updated = await meetingInteractionService.setStatus(meetingId, accepting ? "closed" : "open");
      setInteraction(updated);
      if (!accepting) await onPanelChange("qr");
      setDurationDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái nhận câu trả lời.");
      void load();
    } finally {
      setBusy(false);
    }
  };

  return <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
      <MessageSquareText className="h-4 w-4 text-cyan-600" />
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Điều khiển câu trả lời</h2>
    </div>
    <fieldset disabled={disabled || busy} className="grid grid-cols-3 gap-2">
      {([
        { value: "questions", label: "Câu hỏi", icon: MessageSquareText },
        { value: "qr", label: "QR trả lời", icon: QrCode },
        { value: "results", label: "Xem kết quả", icon: MessageSquareText },
      ] as const).map(item => <button key={item.value} type="button"
        aria-pressed={selected === item.value}
        onClick={() => void onPanelChange(item.value === "qr" ? accepting ? "qr" : "prepare" : item.value)}
        className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-bold transition disabled:opacity-40 ${selected === item.value ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
        <item.icon className="h-4 w-4" />{item.label}
      </button>)}
    </fieldset>
    {selected === "questions" ? <div className="space-y-2">
      {session?.questions.length ? session.questions.map(question => <div key={question.id} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-800"><span className="font-bold text-cyan-700">Câu {question.order}.</span> {question.text}</div>) : <p className="text-xs text-slate-500">Chưa có câu hỏi. Hãy thiết lập trong mục Thu ý kiến của cuộc họp.</p>}
    </div> : null}
    {selected === "qr" ? <div className="space-y-3">
      {!accepting && session ? <label className="block text-xs font-semibold text-slate-700">Thời gian nhận câu trả lời (giây)
        <input type="number" min={1} max={3600} step={1} value={duration} onChange={event => setDurationDraft(event.target.value)} disabled={disabled || busy}
          className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500 disabled:opacity-40" />
      </label> : null}
      {session ? <button type="button" disabled={disabled || busy} onClick={() => void toggleResponses()}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-3 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-40">
        {accepting ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {accepting ? "Đóng nhận câu trả lời" : "Nhận câu trả lời"}
      </button> : <p className="text-xs text-slate-500">Chưa có câu hỏi để nhận câu trả lời.</p>}
      <p className="text-center text-xs font-semibold text-slate-600">{panel === "prepare" ? "Đang chuẩn bị câu hỏi" : accepting ? `Đang chiếu QR · Còn ${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}` : expired ? "Hết thời gian nhận câu trả lời" : session?.openedAt ? "Đã dừng nhận câu trả lời" : "Đang chuẩn bị câu hỏi"}</p>
    </div> : null}
    {selected === "results" ? <p className="text-xs text-slate-500">Đang chiếu kết quả câu trả lời lên màn hình lớn.</p> : null}
    {error ? <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p> : null}
  </section>;
}
