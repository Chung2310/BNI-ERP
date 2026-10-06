import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import type { Meeting } from "../../services/meetingService";
import {
  meetingInteractionService,
  type MeetingInteractionQuestion,
  type MeetingInteractionResponse,
  type MeetingInteractionState,
} from "../../services/meetingInteractionService";
import { socketService } from "../../services/socketService";
import { buildResponseCloud, layoutResponseCloud } from "./audienceResponseCloud";
import { resultGridLayout } from "./audienceResponseGrid";

const CLOUD_COLORS = ["#0797ad", "#ef476f", "#20a464", "#ee9b00", "#7656a8", "#12a4c4", "#d45d79", "#62a744"];

function QuestionResultPanel({
  question,
  responses,
  compact,
}: {
  question: MeetingInteractionQuestion;
  responses: MeetingInteractionResponse[];
  compact: boolean;
}) {
  const cloudRoot = useRef<HTMLDivElement>(null);
  const [cloudSize, setCloudSize] = useState({ width: 600, height: 300 });
  const terms = useMemo(() => buildResponseCloud({ session: null, responses }), [responses]);
  const placements = useMemo(
    () => layoutResponseCloud(terms, cloudSize.width, cloudSize.height),
    [cloudSize, terms],
  );
  const approvedCount = responses.filter(response => response.status === "approved").length;

  useEffect(() => {
    const element = cloudRoot.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = (width: number, height: number) => {
      const nextWidth = Math.round(width);
      const nextHeight = Math.round(height);
      if (nextWidth > 0 && nextHeight > 0) {
        setCloudSize(previous => previous.width === nextWidth && previous.height === nextHeight
          ? previous
          : { width: nextWidth, height: nextHeight });
      }
    };
    const firstMeasure = window.requestAnimationFrame(() => {
      const bounds = element.getBoundingClientRect();
      update(bounds.width, bounds.height);
    });
    const observer = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (box) update(box.width, box.height);
    });
    observer.observe(element);
    return () => {
      window.cancelAnimationFrame(firstMeasure);
      observer.disconnect();
    };
  }, []);

  return <section className="relative h-full min-h-0 w-full overflow-hidden rounded-[1.4vw] border border-slate-200 bg-white shadow-[0_0.4vw_1.5vw_rgba(15,23,42,.08)]">
    <header className="absolute inset-x-[4%] top-[4%] z-10 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[clamp(.55rem,.75vw,.9rem)] font-black uppercase tracking-[.1em] text-cyan-700">Câu {question.order}</p>
        <h2 className={`mt-[.2vw] font-black leading-[1.12] tracking-tight text-slate-950 ${compact ? "text-[clamp(.8rem,1.3vw,1.55rem)]" : "text-[clamp(1rem,1.75vw,2.15rem)]"}`}>{question.text}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-[clamp(.6rem,.9vw,1rem)] font-bold text-slate-500"><Users className="h-[1.05em] w-[1.05em]" />{approvedCount}</div>
    </header>

    <div ref={cloudRoot} className="absolute inset-x-[3%] bottom-[3%] top-[25%] overflow-hidden">
      {!terms.length ? <div className="absolute inset-0 grid place-items-center text-center"><p className={`font-bold text-slate-400 ${compact ? "text-[clamp(.7rem,1vw,1.1rem)]" : "text-[clamp(1rem,1.6vw,1.8rem)]"}`}>Chờ câu trả lời…</p></div> : placements.map(term => <span
        key={term.key}
        title={`${term.text}: ${term.count} câu trả lời`}
        className="absolute flex origin-center items-center justify-center whitespace-nowrap font-medium leading-none tracking-[-0.035em] transition-[left,top,font-size] duration-500 ease-out"
        style={{
          left: term.x,
          top: term.y,
          width: term.width,
          height: term.height,
          color: CLOUD_COLORS[term.colorIndex],
          fontSize: term.fontSize,
          fontWeight: term.count === terms[0]?.count ? 650 : 500,
          writingMode: term.vertical ? "vertical-rl" : undefined,
          transform: term.vertical ? "rotate(180deg)" : undefined,
        }}
      >{term.displayText}</span>)}
    </div>
  </section>;
}

export function AudienceResponsesStage({ meeting }: { meeting: Meeting }) {
  const [state, setState] = useState<MeetingInteractionState>({ session: null, responses: [] });
  const [error, setError] = useState("");
  const load = useCallback(
    () => meetingInteractionService.get(meeting._id)
      .then(data => { setState(data); setError(""); })
      .catch(err => setError(err instanceof Error ? err.message : "Không tải được câu trả lời.")),
    [meeting._id],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(
    () => socketService.on<{ meetingId: string }>("meeting_interaction_updated", event => {
      if (event.meetingId === meeting._id) void load();
    }),
    [load, meeting._id],
  );

  if (error && !state.session) return <div className="flex aspect-video items-center justify-center bg-white p-8 text-center text-2xl font-semibold text-slate-900">{error}</div>;
  if (!state.session) return <div className="flex aspect-video items-center justify-center bg-white p-8 text-center text-3xl font-bold text-slate-900">Chưa tạo câu hỏi tương tác</div>;

  const questions = state.session.questions;
  const allResponses = state.allResponses || state.responses;
  const grid = resultGridLayout(questions.length);
  const compact = questions.length > 4;

  return <div className="relative aspect-video w-full overflow-hidden bg-slate-50 text-slate-950">
    <header className="absolute inset-x-[2.5%] top-[1.8%] z-10 flex items-center justify-between">
      <p className="text-[clamp(.65rem,.9vw,1rem)] font-black uppercase tracking-[.14em] text-cyan-700">Kết quả bài tương tác · {questions.length} câu hỏi</p>
      <div className="text-[clamp(.85rem,1.25vw,1.4rem)] font-black tracking-tight text-cyan-500"><span className="text-cyan-700">i</span>Gen</div>
    </header>
    <div
      className="absolute inset-x-[2.5%] bottom-[2.5%] top-[7.5%] grid min-h-0"
      style={{
        gridTemplateColumns: `repeat(${grid.trackColumns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
        gap: questions.length <= 2 ? "1.5vw" : "1vw",
      }}
    >
      {questions.map((question, index) => <div
        key={question.id}
        className="min-h-0"
        style={{
          gridColumn: index === grid.lastRowStartIndex
            ? `${grid.lastRowStartColumn} / span ${grid.itemSpan}`
            : `span ${grid.itemSpan}`,
        }}
      ><QuestionResultPanel
          question={question}
          responses={allResponses.filter(response => response.questionId === question.id)}
          compact={compact}
        /></div>)}
    </div>
  </div>;
}
