export interface SlideTimerMeeting {
  status: string;
  currentIndex: number;
  speakerStartedAt?: string;
  speechesCompletedAt?: string;
  elapsedSeconds?: number;
  speakers: { id: string; name?: string; photoURL?: string; seconds?: number; spokenSeconds?: number; checkedInAt?: string; deferred?: boolean }[];
}

export function getSlideTimer(meeting: SlideTimerMeeting, speakerId: string | undefined, now: number) {
  const speaker = meeting.speakers.find(s => s.id === speakerId);
  if (!speaker || !Number.isFinite(speaker.seconds)) return null;
  const arrivalOrder = meeting.speakers
    .map((person, index) => ({ id: person.id, index, at: Date.parse(person.checkedInAt || "") }))
    .sort((a, b) => {
      const aTime = Number.isFinite(a.at) ? a.at : Infinity;
      const bTime = Number.isFinite(b.at) ? b.at : Infinity;
      return (aTime === bTime ? 0 : aTime - bTime) || a.index - b.index;
    })
    .findIndex(person => person.id === speakerId) + 1;
  const current = ["live", "paused"].includes(meeting.status) && meeting.speakers[meeting.currentIndex]?.id === speakerId;
  const start = meeting.speakerStartedAt ? Date.parse(meeting.speakerStartedAt) : NaN;
  const running = current && meeting.status === "live" && Number.isFinite(start);
  const elapsed = current
    ? Math.max(0, meeting.elapsedSeconds || 0) + (running ? Math.max(0, (now - start) / 1000) : 0)
    : Math.max(0, speaker.spokenSeconds || 0);
  const remaining = speaker.seconds! - elapsed;
  const expired = remaining <= 0;
  const whole = Math.floor(Math.max(0, remaining));
  const time = expired ? "Hết giờ" : `${Math.floor(whole / 60).toString().padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
  const label = current
    ? expired ? "Hết giờ" : meeting.status === "paused" ? "Tạm dừng" : running ? "Đang phát biểu" : "Chờ bắt đầu"
    : speaker.spokenSeconds != null ? "Đã phát biểu" : "";
  return { time, label, arrivalOrder, seconds: speaker.seconds!, urgent: remaining < 10 && (running || elapsed > 0), overtime: expired };
}

export function drawSlideTimer(ctx: CanvasRenderingContext2D, timer: ReturnType<typeof getSlideTimer>) {
  if (!timer) return;
  ctx.save();
  ctx.fillStyle = timer.overtime ? "#fff1f2" : "#f5f5f5";
  ctx.beginPath(); ctx.roundRect(65, 780, 350, 185, 18); ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillStyle = "#666"; ctx.font = '700 21px "Noto Sans", sans-serif';
  ctx.fillText(`#${timer.arrivalOrder}`, 240, 798);
  ctx.fillStyle = timer.urgent || timer.overtime ? "#d70b2d" : "#252525";
  ctx.font = timer.overtime ? '800 54px "Noto Sans", sans-serif' : '800 65px "Noto Sans", sans-serif';
  ctx.fillText(timer.time, 240, 830);
  ctx.fillStyle = "#777"; ctx.font = '400 21px "Noto Sans", sans-serif';
  if (timer.label && timer.label !== timer.time) ctx.fillText(timer.label, 240, 921);
  ctx.restore();
}
