import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { Meeting } from "../../services/meetingService";
import { meetingService } from "../../services/meetingService";
import { meetingLiveApi, type MeetingLiveSnapshot } from "../../services/meetingLiveService";
import { presentationState } from "../../utils/meetingPresentation";
import { renderProfileSlide, loadSlideImage, SLIDE_WIDTH, SLIDE_HEIGHT } from "./profileSlideRenderer";
import { SpeakerPresentationFrame } from "./SpeakerPresentationFrame";
import type { ProfileSlide } from "./slideTypes";
import { ActiveMembersPanel } from "./ActiveMembersPanel";

export function SpeakerStage({ meeting, slide, now }: { meeting: Meeting; slide?: ProfileSlide; now: number }) {
  if (!slide) return <StageMessage text={meeting.speechesCompletedAt ? "Đã hoàn tất phần phát biểu" : "Chờ người phát biểu"} />;
  return <SpeakerCanvas key={JSON.stringify(slide)} meeting={meeting} slide={slide} now={now} />;
}

function SpeakerCanvas({ meeting, slide, now }: { meeting: Meeting; slide: ProfileSlide; now: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const slideKey = slide ? JSON.stringify(slide) : "";
  const [rendered, setRendered] = useState<{ source: string; canvas: HTMLCanvasElement } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void renderProfileSlide(slide).then(result => {
      if (active) { setError(""); setRendered({ source: slideKey, canvas: result.canvas }); }
    }).catch(() => { if (active) setError("Không tải được hồ sơ trình chiếu."); });
    return () => { active = false; };
  }, [slide, slideKey]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !rendered || rendered.source !== slideKey) return;
    ctx.drawImage(rendered.canvas, 0, 0);
  }, [rendered, meeting, slide, slideKey, now]);
  if (!slide) return <StageMessage text={meeting.speechesCompletedAt ? "Đã hoàn tất phần phát biểu" : "Chờ người phát biểu"} />;
  return <div className="relative w-full bg-white">
    <canvas ref={canvas} width={SLIDE_WIDTH} height={SLIDE_HEIGHT} role="img" aria-label={"Hồ sơ " + slide.name}
      className="block aspect-video w-full" style={{ visibility: rendered?.source === slideKey ? "visible" : "hidden" }} />
    {(!rendered || error) && <div role="status" className="absolute inset-0 grid place-items-center text-slate-700">{error || "Đang tải hồ sơ…"}</div>}
  </div>;
}

function StageMessage({ text, title }: { text: string; title?: string }) {
  return <div className="flex aspect-video w-full flex-col items-center justify-center gap-5 bg-slate-950 px-6 text-center text-white">
    {title && <p className="text-lg text-slate-300">{title}</p>}
    <p className="text-2xl font-bold md:text-5xl">{text}</p>
  </div>;
}

function CheckInStage({ meeting }: { meeting: Meeting }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void meetingLiveApi<{ checkInUrl: string }>("/checkin-qr")
      .then(data => QRCode.toDataURL(new URL(data.checkInUrl, window.location.origin).href, { width: 720, margin: 2 }))
      .then(value => { if (active) { setImage(value); setError(""); } })
      .catch(() => { if (active) setError("Không tải được QR check-in."); });
    return () => { active = false; };
  }, [meeting.companyCode, retry]);
  return <div className="flex aspect-video w-full items-center justify-center gap-6 bg-white p-5 text-slate-900 md:gap-12">
    <div className="w-1/2 max-w-md">
      {image ? <img src={image} alt="QR check-in cuộc họp" className="w-full" /> : <p role="status">{error || "Đang tải QR…"}</p>}
      {error && <button type="button" onClick={() => { setError(""); setRetry(v => v + 1); }} className="rounded-lg border p-2">Tải lại QR</button>}
    </div>
    <div className="max-w-md space-y-4"><p className="font-semibold text-cyan-700">CHÀO MỪNG BẠN</p>
      <h2 className="text-xl font-bold md:text-4xl">{meeting.title}</h2>
      <p className="text-base md:text-2xl">Quét mã để check-in</p>
      <p className="text-sm text-slate-500 md:text-lg">{meeting.speakers.length} người đã check-in</p>
    </div>
  </div>;
}

function RankingStage({ meeting }: { meeting: Meeting }) {
  const [history, setHistory] = useState<Meeting[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void meetingService.listMeetings({ all: true }).then(items => { if (active) setHistory(items); })
      .catch(() => { if (active) setError("Không tải được lịch sử xếp hạng."); });
    return () => { active = false; };
  }, [meeting._id]);
  if (error) return <StageMessage text={error} />;
  return <div className="aspect-video overflow-y-auto bg-white p-3 md:p-8">
    <ActiveMembersPanel meeting={meeting} meetings={[...history.filter(item => item._id !== meeting._id), meeting]} />
  </div>;
}

function DrawStage({ meeting }: { meeting: Meeting }) {
  const params = new URLSearchParams({
    meetingId: meeting._id,
    game: "wheel",
    presentation: "1",
  });
  return <div className="aspect-video w-full overflow-hidden bg-slate-950">
    <iframe
      src={`/quay-thuong?${params.toString()}`}
      title="Màn hình quay thưởng"
      className="h-full w-full border-0 pointer-events-none"
      allow="fullscreen"
    />
  </div>;
}

export function MeetingStage({ snapshot, now, fill = false }: { snapshot: MeetingLiveSnapshot; now: number; fill?: boolean }) {
  const { meeting, slides } = snapshot;
  useEffect(() => {
    const start = Math.max(0, meeting.currentIndex);
    const nextIds = new Set(meeting.speakers.slice(start, start + 3).map(person => person.id));
    for (const slide of slides) {
      if (!nextIds.has(slide.id)) continue;
      void loadSlideImage(slide.photoURL);
      void loadSlideImage(slide.coverImage);
    }
  }, [meeting.currentIndex, meeting.speakers, slides]);
  if (meeting.status === "ended" || meeting.status === "cancelled") return <StageMessage title={meeting.title} text={meeting.status === "ended" ? "Cuộc họp đã kết thúc" : "Cuộc họp đã hủy"} />;

  const view = presentationState(meeting.presentation).view;
  const speaker = meeting.speakers[meeting.currentIndex];
  let activeStage: React.ReactNode;

  if (view === "checkin") activeStage = <CheckInStage meeting={meeting} />;
  else if (view === "activeMembers") activeStage = <RankingStage meeting={meeting} />;
  else if (view === "waiting") activeStage = <StageMessage title={meeting.title} text="Vui lòng chờ" />;
  else activeStage = <SpeakerPresentationFrame meeting={meeting} slides={slides} speakerId={speaker?.id} now={now} fill={fill}>
    <SpeakerStage meeting={meeting} slide={slides.find(item => item.id === speaker?.id)} now={now} />
  </SpeakerPresentationFrame>;

  return <div className={`relative w-full overflow-hidden bg-slate-950 ${fill && view === "speaker" ? "h-full" : "aspect-video"}`}>
    <div
      className={`absolute inset-0 ${view === "luckyDraw" ? "visible" : "invisible pointer-events-none"}`}
      aria-hidden={view !== "luckyDraw"}
    >
      <DrawStage meeting={meeting} />
    </div>
    {view !== "luckyDraw" && <div className="absolute inset-0">{activeStage}</div>}
  </div>;
}
