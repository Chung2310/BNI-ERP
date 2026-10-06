import React, { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Eye, EyeOff, MessageSquareText, MonitorUp, Play, Save, Square, X } from "lucide-react";
import type { Meeting } from "../../services/meetingService";
import { MeetingLiveError, meetingLiveApi, meetingRoomUrl } from "../../services/meetingLiveService";
import { meetingInteractionService, type MeetingInteractionResponseStatus, type MeetingInteractionState } from "../../services/meetingInteractionService";
import { socketService } from "../../services/socketService";

const emptyState: MeetingInteractionState = { session: null, responses: [] };
const statusLabel: Record<MeetingInteractionResponseStatus, string> = { pending: "Chờ duyệt", approved: "Đang hiển thị", hidden: "Đã ẩn", rejected: "Đã từ chối" };

export function MeetingInteractionTab({ meeting, canManage, onRefreshMeeting }: { meeting: Meeting; canManage: boolean; onRefreshMeeting: () => Promise<unknown> | void }) {
  const [state, setState] = useState<MeetingInteractionState>(emptyState);
  const [question, setQuestion] = useState("");
  const [requireName, setRequireName] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [moderationEnabled, setModerationEnabled] = useState(true);
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const apply = useCallback((next: MeetingInteractionState) => {
    setState(next);
    if (next.session) {
      setQuestion(next.session.question);
      setRequireName(next.session.requireName);
      setShowNames(next.session.showNames);
      setModerationEnabled(next.session.moderationEnabled);
      setAllowMultipleResponses(next.session.allowMultipleResponses);
    }
  }, []);
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { apply(await meetingInteractionService.get(meeting._id)); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Không tải được phiên tương tác."); }
    finally { if (!silent) setLoading(false); }
  }, [apply, meeting._id]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => socketService.on<{ meetingId: string }>("meeting_interaction_updated", event => {
    if (event.meetingId === meeting._id) void load(true);
  }), [load, meeting._id]);
  useEffect(() => {
    if (!state.session?.participationUrl) return;
    void QRCode.toDataURL(new URL(state.session.participationUrl, window.location.origin).href, { width: 500, margin: 2 }).then(setQr);
  }, [state.session?.participationUrl]);

  const run = async (key: string, task: () => Promise<MeetingInteractionState>) => {
    setBusy(key); setError("");
    try { apply(await task()); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể cập nhật phiên tương tác."); }
    finally { setBusy(""); }
  };
  const save = () => {
    const changesQuestion = state.session && state.session.question !== question.trim() && state.responses.length > 0;
    if (changesQuestion && !window.confirm("Đổi câu hỏi sẽ xóa các câu trả lời hiện tại. Bạn có muốn tiếp tục?")) return;
    void run("save", () => meetingInteractionService.save(meeting._id, { question: question.trim(), requireName, showNames, moderationEnabled, allowMultipleResponses }));
  };
  const setStatus = (status: "open" | "closed") => run(status, () => meetingInteractionService.setStatus(meeting._id, status));
  const moderate = (id: string, status: "approved" | "hidden" | "rejected") => run(id + status, () => meetingInteractionService.moderate(meeting._id, id, status));
  const present = async () => {
    const displayUrl = meetingRoomUrl(meeting._id, "display");
    const presentationWindow = window.open(displayUrl, "_blank");
    if (presentationWindow) presentationWindow.opener = null;
    setBusy("present"); setError("");
    const switchToResponses = (version: number) => meetingLiveApi(`/${meeting._id}/presentation-state`, "PATCH", { version, view: "audienceResponses" });
    try {
      try {
        await switchToResponses(meeting.__v);
      } catch (err) {
        if (!(err instanceof MeetingLiveError) || err.status !== 409) throw err;
        const latest = await meetingLiveApi<Meeting>(`/${meeting._id}`);
        await switchToResponses(latest.__v);
      }
      await onRefreshMeeting();
      if (!presentationWindow) window.location.assign(displayUrl);
    } catch (err) {
      presentationWindow?.close();
      setError(err instanceof Error ? err.message : "Không thể mở màn hình trình chiếu.");
    } finally { setBusy(""); }
  };
  const url = state.session ? new URL(state.session.participationUrl, window.location.origin).href : "";
  const locked = !canManage || ["ended", "cancelled"].includes(meeting.status);

  if (loading) return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải phần tương tác…</div>;
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-cyan-600" /><h3 className="font-bold text-slate-900">Câu hỏi tương tác</h3></div>
        <label className="block text-sm font-medium text-slate-700">Câu hỏi<textarea value={question} maxLength={300} rows={3} disabled={locked} onChange={e => setQuestion(e.target.value)} placeholder="Ví dụ: Điều giá trị nhất bạn nhận được hôm nay là gì?" className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 disabled:bg-slate-50" /><span className="mt-1 block text-right text-xs text-slate-400">{question.length}/300</span></label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Option checked={requireName} disabled={locked} onChange={setRequireName} label="Yêu cầu nhập tên" />
          <Option checked={showNames} disabled={locked} onChange={setShowNames} label="Hiển thị tên trên màn hình" />
          <Option checked={moderationEnabled} disabled={locked} onChange={setModerationEnabled} label="Duyệt trước khi hiển thị" />
          <Option checked={allowMultipleResponses} disabled={locked} onChange={setAllowMultipleResponses} label="Cho phép gửi nhiều lần" />
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {canManage && !locked && <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={!question.trim() || Boolean(busy)} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy === "save" ? "Đang lưu…" : state.session ? "Lưu cấu hình" : "Tạo phiên tương tác"}</button>
          {state.session && state.session.status !== "open" && <button type="button" disabled={Boolean(busy)} onClick={() => setStatus("open")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Play className="h-4 w-4" />Mở nhận câu trả lời</button>}
          {state.session?.status === "open" && <button type="button" disabled={Boolean(busy)} onClick={() => setStatus("closed")} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Square className="h-4 w-4" />Đóng nhận câu trả lời</button>}
          {state.session && <button type="button" disabled={Boolean(busy)} onClick={present} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-800 disabled:opacity-50"><MonitorUp className="h-4 w-4" />{busy === "present" ? "Đang mở…" : "Trình chiếu kết quả"}</button>}
        </div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">Câu trả lời</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{state.responses.length} phản hồi</span></div>
        {!state.session ? <p className="py-8 text-center text-sm text-slate-500">Tạo câu hỏi để bắt đầu nhận câu trả lời.</p> : !state.responses.length ? <p className="py-8 text-center text-sm text-slate-500">Chưa có câu trả lời nào.</p> : <div className="space-y-3">{state.responses.map(response => <article key={response.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-900">{response.name || "Ẩn danh"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{response.answer}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${response.status === "approved" ? "bg-emerald-50 text-emerald-700" : response.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel[response.status]}</span></div>
          {canManage && <div className="mt-3 flex flex-wrap gap-2">
            {response.status !== "approved" && <SmallButton onClick={() => moderate(response.id, "approved")} disabled={Boolean(busy)} icon={Check} label="Duyệt" />}
            {response.status === "approved" && <SmallButton onClick={() => moderate(response.id, "hidden")} disabled={Boolean(busy)} icon={EyeOff} label="Ẩn" />}
            {response.status === "hidden" && <SmallButton onClick={() => moderate(response.id, "approved")} disabled={Boolean(busy)} icon={Eye} label="Hiện lại" />}
            {response.status !== "rejected" && <SmallButton onClick={() => moderate(response.id, "rejected")} disabled={Boolean(busy)} icon={X} label="Từ chối" danger />}
          </div>}
        </article>)}</div>}
      </section>
    </div>

    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-xs xl:sticky xl:top-2">
      <h3 className="font-bold text-slate-900">QR tham gia</h3>
      {state.session ? <>{qr ? <img src={qr} alt="QR gửi câu trả lời" className="mx-auto mt-4 w-full max-w-[300px]" /> : <p className="py-12 text-sm text-slate-500">Đang tạo QR…</p>}<p className="mt-2 break-all text-xs text-slate-500">{url}</p><button type="button" onClick={() => void navigator.clipboard?.writeText(url)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"><Copy className="h-3.5 w-3.5" />Sao chép liên kết</button><div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><strong>{state.session.approvedCount}</strong> câu đang hiển thị / <strong>{state.session.responseCount}</strong> câu đã nhận</div></> : <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-sm text-slate-500">QR sẽ xuất hiện sau khi tạo phiên.</p>}
    </aside>
  </div>;
}

function Option({ checked, disabled, onChange, label }: { checked: boolean; disabled: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-cyan-600" />{label}</label>;
}
function SmallButton({ onClick, disabled, icon: Icon, label, danger = false }: { onClick: () => void; disabled: boolean; icon: React.ComponentType<{ className?: string }>; label: string; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${danger ? "border-rose-200 text-rose-700" : "border-slate-200 text-slate-700"}`}><Icon className="h-3.5 w-3.5" />{label}</button>;
}