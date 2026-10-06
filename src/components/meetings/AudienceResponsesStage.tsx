import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import type { Meeting } from "../../services/meetingService";
import { meetingInteractionService, type MeetingInteractionState } from "../../services/meetingInteractionService";
import { socketService } from "../../services/socketService";
import { buildResponseCloud, layoutResponseCloud } from "./audienceResponseCloud";

const CLOUD_COLORS = ["#0797ad", "#ef476f", "#20a464", "#ee9b00", "#7656a8", "#12a4c4", "#d45d79", "#62a744"];

export function AudienceResponsesStage({ meeting }: { meeting: Meeting }) {
  const [state, setState] = useState<MeetingInteractionState>({ session: null, responses: [] });
  const [error, setError] = useState("");
  const cloudRoot = useRef<HTMLDivElement>(null);
  const [cloudSize, setCloudSize] = useState({ width: 1000, height: 430 });
  const load = useCallback(() => meetingInteractionService.get(meeting._id).then(data => { setState(data); setError(""); }).catch(err => setError(err instanceof Error ? err.message : "Không tải được câu trả lời.")), [meeting._id]);

  useEffect(() => { void load(); const timer = window.setInterval(load, 5000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => socketService.on<{ meetingId: string }>("meeting_interaction_updated", event => { if (event.meetingId === meeting._id) void load(); }), [load, meeting._id]);
  useEffect(() => {
    const element = cloudRoot.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = (width: number, height: number) => {
      const nextWidth = Math.round(width); const nextHeight = Math.round(height);
      if (nextWidth > 0 && nextHeight > 0) setCloudSize(previous => previous.width === nextWidth && previous.height === nextHeight ? previous : { width: nextWidth, height: nextHeight });
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
    return () => { window.cancelAnimationFrame(firstMeasure); observer.disconnect(); };
  }, [state.session?.id]);

  const terms = useMemo(() => buildResponseCloud(state), [state]);
  const placements = useMemo(() => layoutResponseCloud(terms, cloudSize.width, cloudSize.height), [cloudSize, terms]);
  const approvedCount = state.responses.filter(response => response.status === "approved").length;

  if (error && !state.session) return <div className="flex aspect-video items-center justify-center bg-white p-8 text-center text-2xl font-semibold text-slate-900">{error}</div>;
  if (!state.session) return <div className="flex aspect-video items-center justify-center bg-white p-8 text-center text-3xl font-bold text-slate-900">Chưa tạo câu hỏi tương tác</div>;

  return <div className="relative aspect-video w-full overflow-hidden bg-white text-slate-950">
    <header className="absolute inset-x-[3.2%] top-[3%] z-10 flex items-start justify-between gap-8">
      <h2 className="max-w-[78%] text-[clamp(1.15rem,2.35vw,2.8rem)] font-black leading-[1.12] tracking-tight">{state.session.question}</h2>
      <div className="shrink-0 text-[clamp(.85rem,1.25vw,1.4rem)] font-black tracking-tight text-cyan-500"><span className="text-cyan-700">i</span>Gen</div>
    </header>

    <div ref={cloudRoot} className="absolute inset-x-[4%] inset-y-[13%] overflow-hidden">
      {!terms.length ? <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-[clamp(1.5rem,3.2vw,4rem)] font-black text-slate-800">Chờ câu trả lời…</p><p className="mt-3 text-[clamp(.85rem,1.35vw,1.4rem)] text-slate-500">Các phản hồi được duyệt sẽ xuất hiện tại đây</p></div></div> : placements.map(term => <span key={term.key} title={`${term.text}: ${term.count} câu trả lời`} className="absolute flex origin-center items-center justify-center whitespace-nowrap font-medium leading-none tracking-[-0.035em] transition-[left,top,font-size] duration-500 ease-out" style={{ left: term.x, top: term.y, width: term.width, height: term.height, color: CLOUD_COLORS[term.colorIndex], fontSize: term.fontSize, fontWeight: term.count === terms[0]?.count ? 650 : 500, writingMode: term.vertical ? "vertical-rl" : undefined, transform: term.vertical ? "rotate(180deg)" : undefined }}>{term.displayText}</span>)}
    </div>

    <footer className="absolute bottom-[3%] right-[3.2%] flex items-center justify-end gap-2 text-[clamp(.85rem,1.3vw,1.4rem)] font-bold text-slate-900"><Users className="h-[1.15em] w-[1.15em] fill-current" /><span>{approvedCount}</span></footer>
  </div>;
}