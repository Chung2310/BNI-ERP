import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, MessageSquareText, Send } from "lucide-react";
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let active = true;
    let questionSignature = "";
    const load = () => publicMeetingInteractionService.get(token).then(data => {
      if (!active) return;
      const nextSignature = data.questions.map(question => question.id).join("|");
      if (questionSignature && questionSignature !== nextSignature) {
        setAnswers({});
        setSent(false);
      }
      questionSignature = nextSignature;
      setSession(data);
      setError("");
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : "Không tải được bài tương tác.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    void load();
    const timer = window.setInterval(load, 2000);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [token]);

  const remaining = session?.status === "open" && session.closesAt
    ? Math.max(0, Math.ceil((Date.parse(session.closesAt) - now) / 1000))
    : 0;
  const accepting = session?.status === "open" && remaining > 0;
  const complete = Boolean(session?.questions.every(question => answers[question.id]?.trim()));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || sending || !accepting || !complete) return;
    setSending(true);
    setError("");
    try {
      await publicMeetingInteractionService.submit(token, {
        participantId: participantId(),
        name: name.trim(),
        answers: session.questions.map(question => ({ questionId: question.id, answer: answers[question.id].trim() })),
      });
      if (name.trim()) localStorage.setItem("meeting_interaction_name", name.trim());
      setAnswers({});
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được câu trả lời.");
    } finally {
      setSending(false);
    }
  };

  return <main className="min-h-dvh bg-gradient-to-br from-cyan-950 via-slate-950 to-indigo-950 px-4 py-8 text-white">
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center gap-3 text-cyan-200"><MessageSquareText className="h-7 w-7" /><span className="text-sm font-semibold uppercase tracking-[0.2em]">Tương tác cuộc họp</span></div>
      <section className="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
        {loading ? <p role="status" className="text-center text-slate-500">Đang tải bài tương tác…</p> : !session ? <p role="alert" className="text-center text-rose-600">{error || "Bài tương tác không tồn tại."}</p> : <>
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-medium text-cyan-700">{session.meetingTitle}</p><span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{session.totalQuestions} câu hỏi</span></div>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Bài câu hỏi tương tác</h1>
          {accepting && <div role="timer" className={`mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${remaining <= 10 ? "bg-rose-50 text-rose-700" : "bg-cyan-50 text-cyan-700"}`}><Clock3 className="h-4 w-4" />Còn {remaining} giây để hoàn thành</div>}
          {!accepting ? <div className="mt-8 rounded-2xl bg-amber-50 p-5 text-center text-amber-800">{session.status === "closed" || remaining === 0 && session.status === "open" ? "Thời gian trả lời bài tương tác đã kết thúc." : "Người điều hành chưa mở nhận câu trả lời."}</div> : sent && !session.allowMultipleResponses ? <div className="mt-8 rounded-2xl bg-emerald-50 p-6 text-center text-emerald-800"><CheckCircle2 className="mx-auto mb-3 h-10 w-10" /><p className="font-semibold">Đã gửi bài trả lời</p><p className="mt-1 text-sm">Cảm ơn bạn đã tham gia.</p></div> : <form onSubmit={submit} className="mt-7 space-y-5">
            {session.requireName && <label className="block text-sm font-medium">Tên của bạn<input autoComplete="name" maxLength={150} value={name} onChange={event => setName(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label>}
            <div className="space-y-4">{session.questions.map(question => <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <label htmlFor={`meeting-answer-${question.id}`} className="block font-semibold text-slate-900"><span className="mr-2 text-cyan-700">Câu {question.order}.</span>{question.text}</label>
              <textarea id={`meeting-answer-${question.id}`} aria-label={`Câu trả lời câu ${question.order}`} maxLength={200} rows={3} value={answers[question.id] || ""} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} required className="mt-3 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
              <span className="mt-1 block text-right text-xs text-slate-400">{(answers[question.id] || "").length}/200</span>
            </div>)}</div>
            {sent && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Đã gửi bài. Bạn có thể trả lời thêm một lượt.</p>}
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            <button disabled={sending || !complete || (session.requireName && !name.trim())} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3.5 font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sending ? "Đang gửi…" : `Gửi ${session.totalQuestions} câu trả lời`}</button>
          </form>}
          {error && !accepting && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
        </>}
      </section>
    </div>
  </main>;
}
