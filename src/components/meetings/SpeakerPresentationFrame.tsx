import React from "react";
import { getSlideTimer, type SlideTimerMeeting } from "./slideTimer";
import type { ProfileSlide } from "./slideTypes";
import { DEFAULT_PROFILE_PHOTO } from "./profileSlideRenderer";

export function SpeakerPresentationFrame({ meeting, slides, speakerId, now, children, fill = false }: {
  meeting: SlideTimerMeeting;
  slides: ProfileSlide[];
  speakerId?: string;
  now: number;
  children: React.ReactNode;
  fill?: boolean;
}) {
  const completed = !!meeting.speechesCompletedAt || meeting.status === "ended";
  const index = meeting.speakers.findIndex(person => person.id === speakerId);
  const upcoming = completed || index < 0 ? [] : meeting.speakers.slice(index + 1, index + 4);
  const timer = completed ? null : getSlideTimer(meeting, speakerId, now);
  const timerValue = timer?.overtime
    ? "00"
    : timer
      ? String(timer.time.split(":").reduce((seconds, part) => seconds * 60 + Number(part), 0)).padStart(2, "0")
      : "00";
  return <div className={`relative flex w-full flex-col overflow-hidden bg-slate-100 ${fill ? "h-full" : "aspect-video"}`} style={{ containerType: "inline-size" }}>
    <div className="relative min-h-0 w-full flex-1 overflow-hidden">
      <div className="absolute inset-0 [&>*]:h-full [&>*]:w-full [&_canvas]:h-full [&_canvas]:w-full [&_canvas]:!object-fill">
        {children}
      </div>
      {timer && <div role="timer" aria-label={`Thời gian phát biểu còn lại: ${timerValue} giây${timer.label ? ", " + timer.label : ""}`}
        className={`pointer-events-none absolute flex aspect-square items-center justify-center rounded-full text-center text-white shadow-lg ${timer.urgent || timer.overtime ? "bg-red-700/95" : "bg-slate-950/85"}`}
        style={{ right: "1.1cqw", bottom: "1.1cqw", width: "clamp(52px, 6cqw, 116px)" }}>
        <span className="font-black tabular-nums leading-none" style={{ fontSize: "clamp(22px, 3.2cqw, 62px)" }}>{timerValue}</span>
      </div>}
    </div>
    <div aria-label="Người thuyết trình tiếp theo" className="order-first flex shrink-0 items-center border-b border-[#ff163b] bg-white px-[1.25cqw] text-[#f00024]"
      style={{ height: "clamp(28px, 2.3cqw, 44px)" }}>
      {upcoming.length ? <div className="ml-auto flex min-w-0 items-center justify-end gap-[1.25cqw]">
        <span className="shrink-0 font-normal" style={{ fontSize: "clamp(10px, 1cqw, 20px)" }}>Tiếp theo</span>
        <ol className="flex min-w-0 items-center justify-end gap-[1.25cqw]">
        {upcoming.map((person, offset) => {
          const profile = slides.find(slide => slide.id === person.id);
          const name = profile?.name || person.name || "Người tham gia";
          const photo = profile?.photoURL || person.photoURL || DEFAULT_PROFILE_PHOTO;
          return <li key={person.id} className="flex min-w-0 max-w-[25cqw] items-center gap-[0.5cqw]">
            <span className="shrink-0 font-normal tabular-nums" style={{ fontSize: "clamp(10px, 1.15cqw, 24px)" }}>{offset + 1}.</span>
            <img src={photo} alt="" onError={event => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_PROFILE_PHOTO;
            }} className="shrink-0 rounded-full object-cover" style={{ width: "clamp(20px, 1.8cqw, 34px)", height: "clamp(20px, 1.8cqw, 34px)" }} />
            <p title={name} className="min-w-0 truncate font-normal leading-tight" style={{ fontSize: "clamp(10px, 1.15cqw, 24px)" }}>{name}</p>
          </li>;
        })}
        </ol>
      </div> : index >= 0 && !completed ? null : <p className="w-full text-center font-bold" style={{ fontSize: "clamp(10px, 1.15cqw, 24px)" }}>
        {completed ? "Đã hoàn tất phần thuyết trình" : "Chờ người thuyết trình"}
      </p>}
    </div>
  </div>;
}
