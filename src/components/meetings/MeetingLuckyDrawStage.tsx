import { useEffect, useMemo, useRef, useState } from "react";
import type { Meeting, Speaker } from "../../services/meetingService";
import { presentationState } from "../../utils/meetingPresentation";
import { meetingLiveApi } from "../../services/meetingLiveService";
import type { ProfileSlide } from "./slideTypes";

type WheelEntry = { id: string; label: string };
type Props = { meeting: Meeting; slides: ProfileSlide[]; now: number };

const COLORS = ["#cf142b", "#f59e0b", "#059669", "#2563eb", "#9333ea", "#db2777", "#0284c7", "#65a30d"];
const CENTER = 300;
const RADIUS = 278;

function pointAt(angle: number, radius: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: CENTER + Math.cos(radians) * radius, y: CENTER + Math.sin(radians) * radius };
}

function shortLabel(value: string) {
  return value.length > 16 ? value.slice(0, 14) + "…" : value;
}

export function MeetingLuckyDrawStage({ meeting, slides, now }: Props) {
  const wheel = useRef<SVGGElement>(null);
  const slideRequestSignature = useRef("");
  const clock = useRef({ server: now, local: performance.now() });
  clock.current = { server: now, local: performance.now() };

  const state = presentationState(meeting.presentation);
  const [additionalSlides, setAdditionalSlides] = useState<ProfileSlide[]>([]);
  const prizes = meeting.luckyDraw?.prizes ?? [];
  const winner = prizes.flatMap(prize => prize.winners ?? []).find(item => item.id === state.drawWinnerId);
  const startAt = state.drawStartedAt ? Date.parse(state.drawStartedAt) : Number.NaN;
  const revealAt = state.drawRevealsAt ? Date.parse(state.drawRevealsAt) : Number.NaN;
  const spinning = Boolean(winner && Number.isFinite(startAt) && Number.isFinite(revealAt) && now < revealAt);
  const duration = Number.isFinite(startAt) && Number.isFinite(revealAt) && revealAt > startAt ? revealAt - startAt : 5000;
  const numericMode = meeting.luckyDraw?.drawMode === "numbers";
  const minNumber = meeting.luckyDraw?.numberMin || 1;
  const maxNumber = Math.max(minNumber, meeting.luckyDraw?.numberMax || 100);
  const numberRange = maxNumber - minNumber + 1;

  const entries = useMemo<WheelEntry[]>(() => {
    if (numericMode) {
      const count = Math.min(numberRange, 180);
      return Array.from({ length: count }, (_, index) => {
        const from = minNumber + Math.floor(index * numberRange / count);
        const to = minNumber + Math.floor((index + 1) * numberRange / count) - 1;
        return { id: "ticket-" + from, label: from === to ? "#" + from : "#" + from + "–" + to };
      });
    }
    return meeting.speakers.map((speaker, index) => ({
      id: speaker.id,
      label: shortLabel(speaker.name || "Người tham gia " + (index + 1)),
    }));
  }, [numericMode, numberRange, minNumber, meeting.speakers]);

  const targetIndex = useMemo(() => {
    if (!winner || !entries.length) return 0;
    if (numericMode) {
      const ticket = winner.ticketNumber ?? minNumber;
      return Math.max(0, Math.min(entries.length - 1, Math.floor((ticket - minNumber) * entries.length / numberRange)));
    }
    const index = meeting.speakers.findIndex(speaker => speaker.id === winner.winnerId || (!!winner.userId && speaker.userId === winner.userId));
    return Math.max(0, index);
  }, [winner, entries.length, numericMode, minNumber, numberRange, meeting.speakers]);

  const sliceAngle = entries.length ? 360 / entries.length : 360;
  const baseRotation = -sliceAngle / 2;
  const targetRotation = -((targetIndex + 0.5) * sliceAngle);
  const extraRotation = 7 * 360 + ((targetRotation - baseRotation) % 360 + 360) % 360;
  const finalRotation = entries.length ? baseRotation + extraRotation : 0;

  useEffect(() => {
    const group = wheel.current;
    if (!group) return;
    if (!winner || !Number.isFinite(startAt) || !Number.isFinite(revealAt) || !entries.length) {
      group.setAttribute("transform", "rotate(" + (winner ? finalRotation : baseRotation) + " " + CENTER + " " + CENTER + ")");
      return;
    }
    let frame = 0;
    const drawFrame = () => {
      const liveNow = clock.current.server + performance.now() - clock.current.local;
      const progress = Math.max(0, Math.min(1, (liveNow - startAt) / duration));
      const eased = 1 - Math.pow(1 - progress, 4);
      const angle = baseRotation + extraRotation * eased;
      group.setAttribute("transform", "rotate(" + angle + " " + CENTER + " " + CENTER + ")");
      if (progress < 1) frame = requestAnimationFrame(drawFrame);
    };
    frame = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(frame);
  }, [meeting._id, winner?.id, startAt, revealAt, entries.length, targetIndex, duration, baseRotation, extraRotation, finalRotation]);

  useEffect(() => {
    const known = new Set([...slides, ...additionalSlides].map(slide => slide.id));
    const missingIds = meeting.speakers.filter(speaker => !known.has(speaker.id)).map(speaker => speaker.id);
    if (!missingIds.length) { slideRequestSignature.current = ""; return; }
    const signature = missingIds.join("|");
    if (slideRequestSignature.current === signature) return;
    slideRequestSignature.current = signature;
    let active = true;
    void meetingLiveApi<{ version: number; slides: ProfileSlide[] }>("/" + meeting._id + "/slides")
      .then(deck => { if (active) setAdditionalSlides(deck.slides); })
      .catch(() => { if (active) slideRequestSignature.current = ""; });
    return () => { active = false; };
  }, [meeting._id, meeting.speakers, slides, additionalSlides]);

  const slideById = useMemo(() => new Map([...slides, ...additionalSlides].map(slide => [slide.id, slide])), [slides, additionalSlides]);
  const winnerSpeaker = winner && meeting.speakers.find(speaker => speaker.id === winner.winnerId || (!!winner.userId && speaker.userId === winner.userId));
  const winnerSlide = winnerSpeaker ? slideById.get(winnerSpeaker.id) : undefined;
  const labelsEvery = Math.max(1, Math.ceil(entries.length / 42));
  const labelSize = Math.max(7, Math.min(13, 230 / Math.max(1, entries.length)));
  const initialRotation = winner && !spinning ? finalRotation : baseRotation;

  return (
    <div className="grid aspect-video min-h-[520px] w-full grid-cols-1 overflow-hidden bg-slate-950 text-white md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]" data-testid="meeting-lucky-draw-stage">
      <section className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_#263449_0%,_#101827_70%)] p-4 md:min-h-0 md:p-7">
        <div className="absolute left-5 top-5 z-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">{meeting.title}</p>
          <h2 className="mt-1 text-xl font-black sm:text-3xl">{winner?.prizeName || "Vòng quay may mắn"}</h2>
          <p className="mt-1 text-sm text-slate-300">{meeting.speakers.length} người tham gia</p>
        </div>
        <svg
          viewBox="0 0 600 600"
          role="img"
          aria-label={"Vòng quay gồm " + entries.length + " ô"}
          className="relative z-0 aspect-square w-full max-w-[min(72vh,46vw)] drop-shadow-[0_24px_45px_rgba(0,0,0,0.55)]"
        >
          <circle cx={CENTER} cy={CENTER} r="294" fill="#fbbf24" />
          <circle cx={CENTER} cy={CENTER} r="284" fill="#111827" />
          <g ref={wheel} transform={"rotate(" + initialRotation + " " + CENTER + " " + CENTER + ")"}>
            {entries.map((entry, index) => {
              const start = pointAt(index * sliceAngle, RADIUS);
              const end = pointAt((index + 1) * sliceAngle, RADIUS);
              const largeArc = sliceAngle > 180 ? 1 : 0;
              const path = entries.length === 1
                ? "M " + CENTER + " " + CENTER + " L " + CENTER + " " + (CENTER - RADIUS) + " A " + RADIUS + " " + RADIUS + " 0 1 1 " + CENTER + " " + (CENTER + RADIUS) + " A " + RADIUS + " " + RADIUS + " 0 1 1 " + CENTER + " " + (CENTER - RADIUS) + " Z"
                : "M " + CENTER + " " + CENTER + " L " + start.x + " " + start.y +
                " A " + RADIUS + " " + RADIUS + " 0 " + largeArc + " 1 " + end.x + " " + end.y + " Z";
              const middle = (index + 0.5) * sliceAngle;
              const labelPoint = pointAt(middle, RADIUS * 0.64);
              const upright = middle > 90 && middle < 270 ? middle + 180 : middle;
              const showLabel = entries.length <= 42 || index % labelsEvery === 0;
              return (
                <g key={entry.id}>
                  <path d={path} fill={COLORS[index % COLORS.length]} stroke="#fff7ed" strokeOpacity="0.8" strokeWidth="1.5" />
                  {winner && index === targetIndex && !spinning && <path d={path} fill="none" stroke="#fff7cc" strokeWidth="5" />}
                  {showLabel && (
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      fill="white"
                      fontSize={labelSize}
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={"rotate(" + upright + " " + labelPoint.x + " " + labelPoint.y + ")"}
                    >
                      {entry.label}
                    </text>
                  )}
                </g>
              );
            })}
            {entries.length === 0 && <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="#334155" />}
            <circle cx={CENTER} cy={CENTER} r="55" fill="#f8fafc" stroke="#fbbf24" strokeWidth="10" />
            <text x={CENTER} y={CENTER - 2} fill="#0f172a" fontSize="15" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
              {spinning ? "ĐANG QUAY" : entries.length ? "BNI" : "CHƯA CÓ NGƯỜI"}
            </text>
          </g>
          <path d="M 300 5 L 278 47 L 322 47 Z" fill="#fff7cc" stroke="#92400e" strokeWidth="5" />
          <circle cx={CENTER} cy={CENTER} r="18" fill="#cf142b" stroke="#fff" strokeWidth="5" />
        </svg>
        {!entries.length && <p className="mt-3 text-center text-sm text-amber-200">Chưa có người check-in để tham gia vòng quay.</p>}
        {winner && (
          <div className="absolute inset-x-4 bottom-3 text-center text-sm font-semibold text-amber-200" aria-live="polite">
            {spinning ? "Đang quay thưởng…" : "Kết quả đã được công bố"}
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col border-t border-white/10 bg-slate-900/95 md:border-l md:border-t-0">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h3 className="font-bold">Danh sách người tham gia</h3>
            <p className="text-xs text-slate-400">Thông tin thành viên và khách đã check-in</p>
          </div>
          <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-200">{meeting.speakers.length}</span>
        </div>
        {winner && !spinning && (
          <div className="flex items-center gap-3 border-b border-amber-300/30 bg-amber-300/10 p-4">
            {winner.photoURL || winnerSlide?.photoURL ? (
              <img src={winner.photoURL || winnerSlide?.photoURL} alt="" className="h-14 w-14 rounded-full border-2 border-amber-300 object-cover" />
            ) : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-amber-300 text-lg font-black text-slate-950">{winner.name.slice(0, 1)}</div>}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">Người trúng thưởng</p>
              <p className="truncate text-lg font-black text-white">{winner.name}</p>
              <p className="truncate text-xs text-amber-100">{winnerSlide?.company || winnerSpeaker?.company || winner.prizeName}</p>
              {winner.ticketNumber && <p className="text-xs text-slate-300">Số may mắn: {winner.ticketNumber}</p>}
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-white/5">
          {meeting.speakers.map((speaker: Speaker, index) => {
            const slide = slideById.get(speaker.id);
            const name = slide?.name || speaker.name;
            const company = slide?.company || speaker.company || "Chưa cập nhật đơn vị";
            const industry = slide?.industry || speaker.industry;
            const photo = slide?.photoURL || speaker.photoURL || slide?.coverImage || speaker.coverImage;
            const isWinner = !spinning && !!winner && winnerSpeaker?.id === speaker.id;
            return (
              <div key={speaker.id} className={"flex gap-3 px-4 py-3 " + (isWinner ? "bg-amber-300/10" : "")}>
                {photo ? <img src={photo} alt="" className="h-11 w-11 shrink-0 rounded-full bg-slate-800 object-cover" /> :
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-700 font-bold">{name.slice(0, 1)}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">{index + 1}. {name}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-slate-400">{speaker.userId ? "Thành viên" : "Khách mời"}</span>
                  </div>
                  <p className="truncate text-xs text-cyan-200">{company}{industry ? " · " + industry : ""}</p>
                  {(slide?.phone || speaker.phone || slide?.email || speaker.email) && (
                    <p className="break-all text-[10px] text-slate-300">
                      {[slide?.phone || speaker.phone, slide?.email || speaker.email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {slide?.bio && <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-400" title={slide.bio}>{slide.bio}</p>}
                </div>
              </div>
            );
          })}
          {!meeting.speakers.length && <p className="p-5 text-center text-sm text-slate-400">Chưa có người check-in.</p>}
        </div>
      </aside>
    </div>
  );
}