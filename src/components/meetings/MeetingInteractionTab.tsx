import React, { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Clock3, Copy, Eye, EyeOff, MessageSquareText, MonitorUp, Play, Plus, Save, SlidersHorizontal, Square, Trash2, X } from "lucide-react";
import type { Meeting } from "../../services/meetingService";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { MeetingLiveError, meetingLiveApi, meetingRoomUrl } from "../../services/meetingLiveService";
import { meetingInteractionService, type MeetingInteractionQuestion, type MeetingInteractionResponseStatus, type MeetingInteractionState } from "../../services/meetingInteractionService";
import { socketService } from "../../services/socketService";

const emptyState: MeetingInteractionState = { session: null, responses: [] };
type InteractionSettings = { durationSeconds: number; requireName: boolean; showNames: boolean; moderationEnabled: boolean; allowMultipleResponses: boolean };

const statusLabel: Record<MeetingInteractionResponseStatus, string> = { pending: "Chờ duyệt", approved: "Đang hiển thị", hidden: "Đã ẩn", rejected: "Đã từ chối" };

export function MeetingInteractionTab({ meeting, canManage, onRefreshMeeting }: { meeting: Meeting; canManage: boolean; onRefreshMeeting: () => Promise<unknown> | void }) {
  const [state, setState] = useState<MeetingInteractionState>(emptyState);
  const [question, setQuestion] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [requireName, setRequireName] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [moderationEnabled, setModerationEnabled] = useState(true);
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<InteractionSettings>({ durationSeconds: 60, requireName: true, showNames: true, moderationEnabled: true, allowMultipleResponses: false });
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [questionToDelete, setQuestionToDelete] = useState<MeetingInteractionQuestion | null>(null);

  const [now, setNow] = useState(Date.now);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const apply = useCallback((next: MeetingInteractionState) => {
    setState(next);
    if (next.session) {
      setQuestion(next.session.question);
      setDurationSeconds(next.session.durationSeconds);
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
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (state.session?.status !== "open" || !state.session.closesAt) return; const timer = window.setTimeout(() => void load(true), Math.max(0, Date.parse(state.session.closesAt) - Date.now()) + 100); return () => window.clearTimeout(timer); }, [load, state.session?.closesAt, state.session?.status]);
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
    void run("save", () => meetingInteractionService.save(meeting._id, { question: question.trim(), durationSeconds, requireName, showNames, moderationEnabled, allowMultipleResponses }));
  };
  const openSettings = () => {
    setSettingsDraft({ durationSeconds, requireName, showNames, moderationEnabled, allowMultipleResponses });
    setSettingsError("");
    setSettingsOpen(true);
  };
  const applySettings = async () => {
    setDurationSeconds(settingsDraft.durationSeconds);
    setRequireName(settingsDraft.requireName);
    setShowNames(settingsDraft.showNames);
    setModerationEnabled(settingsDraft.moderationEnabled);
    setAllowMultipleResponses(settingsDraft.allowMultipleResponses);
    if (!state.session) { setSettingsOpen(false); return; }
    const changesQuestion = state.session.question !== question.trim() && state.responses.length > 0;
    if (changesQuestion && !window.confirm("Đổi câu hỏi sẽ xóa các câu trả lời hiện tại. Bạn có muốn tiếp tục?")) return;
    setBusy("settings"); setSettingsError("");
    try {
      apply(await meetingInteractionService.save(meeting._id, { question: question.trim(), ...settingsDraft }));
      setSettingsOpen(false);
    } catch (err) { setSettingsError(err instanceof Error ? err.message : "Không thể lưu cấu hình."); }
    finally { setBusy(""); }
  };
  const selectQuestion = (id: string) => { if (!busy && id !== state.session?.activeQuestionId) void run("select", () => meetingInteractionService.selectQuestion(meeting._id, id)); };
  const removeQuestion = async () => {
    if (!questionToDelete) return;
    await run("delete-question", () => meetingInteractionService.deleteQuestion(meeting._id, questionToDelete.id));
    setQuestionToDelete(null);
  };
  const addQuestion = async () => {
    if (!newQuestion.trim()) return;
    setBusy("add-question"); setSettingsError("");
    try { apply(await meetingInteractionService.addQuestion(meeting._id, { question: newQuestion.trim() })); setAddQuestionOpen(false); setNewQuestion(""); }
    catch (err) { setSettingsError(err instanceof Error ? err.message : "Không thể thêm câu hỏi."); }
    finally { setBusy(""); }
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
  const remainingSeconds = state.session?.status === "open" && state.session.closesAt ? Math.max(0, Math.ceil((Date.parse(state.session.closesAt) - now) / 1000)) : 0;
  const locked = !canManage || ["ended", "cancelled"].includes(meeting.status);
  const editingLocked = locked || state.session?.status === "open";

  if (loading) return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải phần tương tác…</div>;
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-cyan-600" /><h3 className="font-bold text-slate-900">Câu hỏi tương tác</h3></div>{state.session && canManage && <button type="button" disabled={Boolean(busy) || state.session.status === "open" || state.session.questions.length >= 20} onClick={() => { setSettingsError(""); setAddQuestionOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-50"><Plus className="h-4 w-4" />Thêm câu hỏi</button>}</div>
        {state.session && <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Danh sách câu hỏi · Chọn câu để xem và trình chiếu kết quả</p><span className="text-xs text-slate-500">{state.session.questions.length}/20</span></div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">{state.session.questions.map(item => <div key={item.id} className={`group flex min-w-0 overflow-hidden rounded-xl border transition ${item.id === state.session?.activeQuestionId ? "border-cyan-500 bg-white shadow-sm ring-1 ring-cyan-200" : "border-slate-200 bg-white/70 hover:border-cyan-300"}`}>
            <button type="button" onClick={() => selectQuestion(item.id)} title={item.text} className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black ${item.id === state.session?.activeQuestionId ? "bg-cyan-600 text-white" : "bg-cyan-50 text-cyan-700"}`}>{item.order}</span>
              <span className="min-w-0">
                <span className="block overflow-hidden text-sm font-semibold leading-5 text-slate-800 [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{item.text}</span>
                <span className="mt-1 block text-[11px] text-slate-500">{item.responseCount} phản hồi</span>
              </span>
              {item.id === state.session?.activeQuestionId && <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700">Đang chọn</span>}
            </button>
            {canManage && state.session!.status !== "open" && state.session!.questions.length > 1 && <button type="button" aria-label={`Xóa câu hỏi ${item.order}`} onClick={() => setQuestionToDelete(item)} className="grid w-11 shrink-0 place-items-center border-l border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
          </div>)}</div>
        </div>}
        <label className="block text-sm font-medium text-slate-700">{state.session ? `Câu hỏi ${state.session.questionNumber}/${state.session.totalQuestions}` : "Câu hỏi"}<textarea value={question} maxLength={300} rows={3} disabled={editingLocked} onChange={e => setQuestion(e.target.value)} placeholder="Ví dụ: Điều giá trị nhất bạn nhận được hôm nay là gì?" className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 disabled:bg-slate-50" /><span className="mt-1 block text-right text-xs text-slate-400">{question.length}/300</span></label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-white px-2.5 py-1 shadow-xs">{requireName ? "Yêu cầu tên" : "Tên không bắt buộc"}</span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-xs">{moderationEnabled ? "Có kiểm duyệt" : "Tự động hiển thị"}</span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-xs">{allowMultipleResponses ? "Được gửi nhiều lần" : "Mỗi người một lần"}</span>
          </div>
          <button type="button" onClick={openSettings} disabled={editingLocked} className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"><SlidersHorizontal className="h-4 w-4" />Cấu hình</button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
{state.session?.status === "open" && <div role="timer" className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${remainingSeconds <= 10 ? "bg-rose-50 text-rose-700" : "bg-cyan-50 text-cyan-700"}`}><Clock3 className="h-4 w-4" />Bài gồm {state.session.totalQuestions} câu tự đóng sau {remainingSeconds} giây</div>}
        {canManage && !locked && <div className="mt-5 flex flex-wrap gap-2">
          {!state.session && <button type="button" disabled={!question.trim() || Boolean(busy)} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy === "save" ? "Đang tạo…" : "Tạo phiên tương tác"}</button>}
          {state.session && state.session.status !== "open" && <button type="button" disabled={Boolean(busy)} onClick={() => setStatus("open")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Play className="h-4 w-4" />Mở nhận toàn bài ({durationSeconds} giây)</button>}
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

    {addQuestionOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setAddQuestionOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="add-interaction-question-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4"><div><h4 id="add-interaction-question-title" className="text-lg font-bold text-slate-900">Thêm câu hỏi</h4><p className="mt-1 text-sm text-slate-500">Câu hỏi mới dùng chung thời gian và cấu hình của bài.</p></div><button type="button" aria-label="Đóng thêm câu hỏi" onClick={() => setAddQuestionOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        <label className="mt-5 block text-sm font-semibold text-slate-800">Nội dung câu hỏi<textarea autoFocus rows={4} maxLength={300} value={newQuestion} onChange={event => setNewQuestion(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-cyan-500" /></label>

        {settingsError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{settingsError}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setAddQuestionOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Hủy</button><button type="button" disabled={!newQuestion.trim() || Boolean(busy)} onClick={() => void addQuestion()} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "add-question" ? "Đang thêm…" : "Thêm câu hỏi"}</button></div>
      </section>
    </div>}
    {settingsOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="interaction-settings-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div><h4 id="interaction-settings-title" className="text-lg font-bold text-slate-900">Cấu hình bài tương tác</h4><p className="mt-1 text-sm text-slate-500">Cấu hình này áp dụng chung cho tất cả câu hỏi trong bài.</p></div>
          <button type="button" aria-label="Đóng cấu hình" onClick={() => setSettingsOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 p-3"><label htmlFor="interaction-duration" className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-800"><span><span className="block">Thời gian trả lời</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Áp dụng chung cho toàn bộ câu hỏi, tính từ lúc mở nhận.</span></span><span className="flex items-center gap-2"><input id="interaction-duration" type="number" min={10} max={3600} value={settingsDraft.durationSeconds} onChange={event => setSettingsDraft(current => ({ ...current, durationSeconds: Math.max(10, Math.min(3600, Number(event.target.value) || 10)) }))} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-right" /><span className="text-xs text-slate-500">giây</span></span></label></div>
        <div className="mt-3 space-y-3">
          <Option checked={settingsDraft.requireName} disabled={editingLocked} onChange={value => setSettingsDraft(current => ({ ...current, requireName: value }))} label="Yêu cầu người tham dự nhập tên" description="Tên được lưu cùng câu trả lời để người điều hành nhận biết." />
          <Option checked={settingsDraft.showNames} disabled={editingLocked} onChange={value => setSettingsDraft(current => ({ ...current, showNames: value }))} label="Cho phép hiển thị tên" description="Dùng khi chuyển sang kiểu trình chiếu có kèm tên người gửi." />
          <Option checked={settingsDraft.moderationEnabled} disabled={editingLocked} onChange={value => setSettingsDraft(current => ({ ...current, moderationEnabled: value }))} label="Duyệt trước khi trình chiếu" description="Câu trả lời chỉ xuất hiện sau khi người điều hành duyệt." />
          <Option checked={settingsDraft.allowMultipleResponses} disabled={editingLocked} onChange={value => setSettingsDraft(current => ({ ...current, allowMultipleResponses: value }))} label="Cho phép gửi nhiều lần" description="Một thiết bị có thể gửi lại toàn bộ bài trả lời nhiều lần." />
        </div>
        {settingsError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{settingsError}</p>}
        <p className="mt-4 text-xs text-slate-500">{state.session ? "Thay đổi sẽ được lưu ngay khi bạn bấm Lưu cấu hình." : "Lựa chọn sẽ được dùng khi bạn tạo phiên tương tác."}</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSettingsOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Hủy</button><button type="button" disabled={Boolean(busy) || !question.trim()} onClick={() => void applySettings()} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">{busy === "settings" ? "Đang lưu…" : state.session ? "Lưu cấu hình" : "Áp dụng cấu hình"}</button></div>
      </section>
    </div>}
    <ConfirmDialog
      isOpen={Boolean(questionToDelete)}
      title="Xóa câu hỏi?"
      description={`Xóa câu ${questionToDelete?.order || ""}: “${questionToDelete?.text || ""}”? Toàn bộ câu trả lời của câu hỏi này cũng sẽ bị xóa.`}
      confirmLabel="Xóa câu hỏi"
      cancelLabel="Giữ lại"
      isSubmitting={busy === "delete-question"}
      onClose={() => { if (busy !== "delete-question") setQuestionToDelete(null); }}
      onConfirm={removeQuestion}
    />
  </div>;
}

function Option({ checked, disabled, onChange, label, description }: { checked: boolean; disabled: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/40"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-600" /><span><span className="block text-sm font-semibold text-slate-800">{label}</span>{description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}</span></label>;
}
function SmallButton({ onClick, disabled, icon: Icon, label, danger = false }: { onClick: () => void; disabled: boolean; icon: React.ComponentType<{ className?: string }>; label: string; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${danger ? "border-rose-200 text-rose-700" : "border-slate-200 text-slate-700"}`}><Icon className="h-3.5 w-3.5" />{label}</button>;
}
