import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageSquareText, Send } from "lucide-react";
import { publicMeetingInteractionService, type PublicMeetingInteraction } from "../services/meetingInteractionService";

function participantId() {
  const key = "meeting_interaction_participant_id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

export default function MeetingInteractionPage() {
  const token = useMemo(() => decodeURIComponent(window.location.pathname.split("/meeting-interaction/")[1]?.split("/")[0] || ""), []);
  const [session, setSession] = useState<PublicMeetingInteraction | null>(null);
  const [name, setName] = useState(() => localStorage.getItem("meeting_interaction_name") || "");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () => publicMeetingInteractionService.get(token).then(data => {
      if (active) { setSession(data); setError(""); }
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Không tải được câu hỏi."); })
      .finally(() => { if (active) setLoading(false); });
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || sending) return;
    setSending(true); setError("");
    try {
      await publicMeetingInteractionService.submit(token, { participantId: participantId(), name: name.trim(), answer: answer.trim() });
      if (name.trim()) localStorage.setItem("meeting_interaction_name", name.trim());
      setAnswer(""); setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Không gửi được câu trả lời."); }
    finally { setSending(false); }
  };

  return <main className="min-h-dvh bg-gradient-to-br from-cyan-950 via-slate-950 to-indigo-950 px-4 py-8 text-white">
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6 flex items-center gap-3 text-cyan-200"><MessageSquareText className="h-7 w-7" /><span className="text-sm font-semibold uppercase tracking-[0.2em]">Tương tác cuộc họp</span></div>
      <section className="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
        {loading ? <p role="status" className="text-center text-slate-500">Đang tải câu hỏi…</p> : !session ? <p role="alert" className="text-center text-rose-600">{error || "Phiên tương tác không tồn tại."}</p> : <>
          <p className="mb-2 text-sm font-medium text-cyan-700">{session.meetingTitle}</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{session.question}</h1>
          {session.status !== "open" ? <div className="mt-8 rounded-2xl bg-amber-50 p-5 text-center text-amber-800">{session.status === "closed" ? "Phiên nhận câu trả lời đã kết thúc." : "Người điều hành chưa mở nhận câu trả lời."}</div> : sent && !session.allowMultipleResponses ? <div className="mt-8 rounded-2xl bg-emerald-50 p-6 text-center text-emerald-800"><CheckCircle2 className="mx-auto mb-3 h-10 w-10" /><p className="font-semibold">Đã gửi câu trả lời</p><p className="mt-1 text-sm">Cảm ơn bạn đã tham gia.</p></div> : <form onSubmit={submit} className="mt-7 space-y-4">
            {session.requireName && <label className="block text-sm font-medium">Tên của bạn<input autoComplete="name" maxLength={150} value={name} onChange={e => setName(e.target.value)} required className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label>}
            <div><label htmlFor="meeting-answer" className="block text-sm font-medium">Câu trả lời</label><textarea id="meeting-answer" maxLength={200} rows={5} value={answer} onChange={e => setAnswer(e.target.value)} required className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /><span className="mt-1 block text-right text-xs text-slate-400">{answer.length}/200</span></div>
            {sent && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Đã gửi. Bạn có thể gửi thêm câu trả lời.</p>}
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            <button disabled={sending || !answer.trim() || (session.requireName && !name.trim())} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3.5 font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sending ? "Đang gửi…" : "Gửi câu trả lời"}</button>
          </form>}
          {error && session.status !== "open" && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
        </>}
      </section>
    </div>
  </main>;
}