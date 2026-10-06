import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  ExternalLink,
  Maximize2,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Gift,
  Trophy,
  SlidersHorizontal,
  Sparkles,
  Tv,
  Smartphone,
  RefreshCw,
  Square,
  Users,
  ChevronLeft,
  X,
  AlertTriangle,
  QrCode as QrIcon,
  Monitor,
  Megaphone,
  MessageSquareText,
  Plus,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { tabToPath } from "../../seo/seo-config";
import { meetingRoomUrl } from "../../services/meetingLiveService";
import { meetingService } from "../../services/meetingService";
import { presentationState, type MeetingPresentationState, type PresentationView } from "../../utils/meetingPresentation";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { MeetingStage, SpeakerStage } from "./MeetingStage";
import { getSlideTimer } from "./slideTimer";
import { useMeetingLive } from "./useMeetingLive";

const views: { value: PresentationView; label: string; icon: typeof Tv }[] = [
  { value: "checkin", label: "QR check-in", icon: QrIcon },
  { value: "speaker", label: "Người phát biểu", icon: Users },
  { value: "luckyDraw", label: "Quay thưởng", icon: Gift },
  { value: "audienceResponses", label: "Câu trả lời", icon: MessageSquareText },
  { value: "activeMembers", label: "Xếp hạng", icon: Trophy },
  { value: "waiting", label: "Màn hình chờ", icon: Monitor },
];

type Props = { meetingId: string; mode: "control" | "display" };

export default function RemoteMeetingRoom(props: Props) {
  const { hasPermission } = useAuth();
  if (!hasPermission("meetings:manage") && !hasPermission("access:manage")) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-white p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-400 grid place-items-center">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold">Không có quyền truy cập</h2>
          <p role="alert" className="text-sm text-slate-300">
            Bạn cần quyền điều hành cuộc họp để mở màn hình này.
          </p>
          <a
            href={tabToPath("CUỘC HỌP")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 px-5 py-2.5 text-xs font-bold text-white transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Về trang cuộc họp
          </a>
        </div>
      </div>
    );
  }
  return <MeetingRoom key={props.meetingId + props.mode} {...props} />;
}

function AutoAdvanceSettings({ state, disabled, onSave }: {
  state: MeetingPresentationState; disabled: boolean;
  onSave: (value: { autoAdvance: boolean }) => Promise<boolean>;
}) {
  const [enabled, setEnabled] = useState(state.autoAdvance);
  return (
    <form
      className="space-y-3.5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
      onSubmit={event => {
        event.preventDefault();
        void onSave({ autoAdvance: enabled });
      }}
    >
      <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
        <Sparkles className="h-4 w-4 text-cyan-600" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Tự động chuyển lượt</h3>
      </div>
      <fieldset disabled={disabled} className="space-y-3.5">
        <label className="flex items-center gap-3 font-semibold text-xs text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={event => setEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span>Tự chuyển người khi hết giờ</span>
        </label>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Hết thời gian phát biểu, cuộc họp chuyển ngay sang người tiếp theo, kể cả khi điện thoại khóa màn hình.
        </p>
        <button
          type="submit"
          className="w-full min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-40"
        >
          Lưu chế độ chuyển lượt
        </button>
      </fieldset>
    </form>
  );
}

function MeetingRoom({ meetingId, mode }: Props) {
  const readOnly = mode === "display";
  const { snapshot, now, syncError, commandError, connected, busy, refresh, command } = useMeetingLive(meetingId, readOnly);
  const root = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [selectedPrize, setSelectedPrize] = useState("");
  const [quickPrizeOpen, setQuickPrizeOpen] = useState(false);
  const [quickPrizeName, setQuickPrizeName] = useState("Giải thưởng may mắn");
  const [quickPrizeQuantity, setQuickPrizeQuantity] = useState(1);
  const [creatingPrize, setCreatingPrize] = useState(false);
  const [quickPrizeError, setQuickPrizeError] = useState("");
  const [showFinish, setShowFinish] = useState(false);
  const [share, setShare] = useState(false);
  const [shareQr, setShareQr] = useState("");
  const controlUrl = meetingRoomUrl(meetingId, "control");

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    if (!share) return;
    let active = true;
    void QRCode.toDataURL(new URL(controlUrl, window.location.origin).href, { width: 300, margin: 2 })
      .then(data => { if (active) setShareQr(data); }).catch(() => { if (active) setShareQr(""); });
    return () => { active = false; };
  }, [share, controlUrl]);

  const enterFullscreen = async () => {
    try {
      if (!root.current?.requestFullscreen) throw new Error();
      await root.current.requestFullscreen(); setScreenError("");
    } catch { setScreenError("Hãy bật toàn màn hình bằng nút F11 trên máy tính."); }
  };

  const meeting = snapshot?.meeting;
  const state = presentationState(meeting?.presentation);
  const current = meeting?.speakers[meeting.currentIndex];
  const selected = meeting?.speakers.find(person => person.id === selectedSpeaker);
  const closed = meeting?.status === "ended" || meeting?.status === "cancelled";
  const disabled = busy || Boolean(syncError) || !snapshot || closed;
  const control = (action: string) => command("/control", { action });
  const showView = (view: PresentationView) => command("/presentation-state", { view }, "PATCH");
  const timer = meeting && getSlideTimer(meeting, current?.id, now);
  const drawing = now < Date.parse(state.drawRevealsAt || "");
  const activePrize = meeting?.luckyDraw?.prizes.find(prize => prize.id === selectedPrize);
  useEffect(() => {
    const available = meeting?.luckyDraw?.prizes ?? [];
    const selectionFrame = requestAnimationFrame(() => {
      setSelectedPrize(current => available.some(prize => prize.id === current && prize.winners.length < prize.quantity)
        ? current
        : available.find(prize => prize.winners.length < prize.quantity)?.id || "");
    });
    return () => cancelAnimationFrame(selectionFrame);
  }, [meeting?._id, meeting?.luckyDraw?.prizes]);

  const createQuickPrize = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = quickPrizeName.trim();
    if (!name || creatingPrize) return;
    setCreatingPrize(true);
    setQuickPrizeError("");
    try {
      const previousIds = new Set((meeting?.luckyDraw?.prizes ?? []).map(prize => prize.id));
      const updated = await meetingService.addOrUpdatePrize(meetingId, {
        name,
        reward: "",
        quantity: Math.max(1, quickPrizeQuantity),
        order: (meeting?.luckyDraw?.prizes.length ?? 0) + 1,
        color: "#f59e0b",
      });
      const created = updated.prizes.find(prize => !previousIds.has(prize.id)) || updated.prizes.at(-1);
      await refresh();
      if (created) setSelectedPrize(created.id);
      setQuickPrizeOpen(false);
      setQuickPrizeName("Giải thưởng may mắn");
      setQuickPrizeQuantity(1);
    } catch (error) {
      setQuickPrizeError(error instanceof Error ? error.message : "Không thể tạo giải thưởng.");
    } finally {
      setCreatingPrize(false);
    }
  };
  const status = syncError || (snapshot ? connected ? "Đã đồng bộ máy chủ" : "Đang đồng bộ qua kết nối dự phòng" : "Đang kết nối cuộc họp…");

  return createPortal(
    <div ref={root} className="fixed inset-0 z-[200] overflow-y-auto bg-slate-50 text-slate-900 font-sans">
      {/* Top Header Bar */}
      <header className={(readOnly && fullscreen ? "absolute inset-x-0 top-0 z-20 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100 " : "sticky top-0 z-20 ") + "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-3 sm:px-6 shadow-xs"}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-2xl bg-cyan-600 text-white shadow-xs shrink-0">
            {readOnly ? <Tv className="h-5 w-5" /> : <SlidersHorizontal className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-base sm:text-lg text-slate-900 truncate">
              {readOnly ? "Màn hình trình chiếu" : "Bảng điều khiển cuộc họp"}
            </h1>
            <p className="text-xs text-slate-500 truncate font-medium">{meeting?.title || "Đang tải…"}</p>
          </div>
        </div>

        {/* Live sync pill badge */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${syncError ? "bg-amber-50 text-amber-800 border-amber-200" : connected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-cyan-50 text-cyan-700 border-cyan-200"}`}>
            <span className={`h-2 w-2 rounded-full ${syncError ? "bg-amber-500" : connected ? "bg-emerald-500 animate-pulse" : "bg-cyan-500"}`} />
            <span>{status}</span>
            <button type="button" onClick={() => void refresh()} className="ml-1 text-slate-400 hover:text-slate-700 transition cursor-pointer" title="Đồng bộ lại">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          {/* Action buttons */}
          {readOnly ? (
            <>
              <button
                type="button"
                onClick={() => void enterFullscreen()}
                className="inline-flex items-center gap-1.5 min-h-10 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Toàn màn hình</span>
              </button>
              <button
                type="button"
                onClick={() => setShare(true)}
                className="inline-flex items-center gap-1.5 min-h-10 rounded-xl bg-cyan-700 hover:bg-cyan-800 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer shadow-xs"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Mở bảng điều khiển cuộc họp</span>
              </button>
            </>
          ) : (
            <a
              href={meetingRoomUrl(meetingId, "display")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 min-h-10 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 px-3.5 py-2 text-xs font-bold text-cyan-800 transition cursor-pointer shadow-2xs"
            >
              <ExternalLink className="h-3.5 w-3.5 text-cyan-600" />
              <span>Mở màn hình trình chiếu</span>
            </a>
          )}

          <a
            href={tabToPath("CUỘC HỌP")}
            className="inline-flex items-center gap-1.5 min-h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Về cuộc họp</span>
          </a>
        </div>
      </header>

      {/* Sync Error / Screen Notice Banner */}
      {(syncError || screenError) && (
        <div role="status" className={"flex items-center justify-between gap-2 px-6 py-2.5 text-xs font-medium " + (syncError ? "bg-amber-100 text-amber-900 border-b border-amber-200" : "bg-cyan-50 text-cyan-900 border-b border-cyan-100")}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{screenError || status}</span>
          </div>
          <button type="button" className="underline font-bold hover:text-cyan-950 cursor-pointer" onClick={() => void refresh()}>
            Đồng bộ lại
          </button>
        </div>
      )}

      {/* Main Body */}
      {!snapshot ? (
        <div role="status" className="grid min-h-[60vh] place-items-center p-6 text-slate-400 text-sm">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-600" />
            <span>{status}</span>
          </div>
        </div>
      ) : readOnly ? (
        <main className="flex min-h-[80vh] items-center justify-center bg-slate-100" style={fullscreen ? { height: "100dvh" } : {}}>
          <div style={fullscreen && state.view === "speaker" ? { width: "100%", height: "100%" } : { width: "min(100%, 177.7778dvh)" }}>
            <MeetingStage snapshot={snapshot} now={now} fill={fullscreen && state.view === "speaker"} />
          </div>
        </main>
      ) : (
        <main className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 pb-16 lg:grid-cols-12 items-start">
          {/* LEFT COLUMN: LIVE BROADCAST SCREEN & SPEAKING TIMER (7/12) */}
          <section className="lg:col-span-7 space-y-5">
            {/* Live Broadcast Viewport Card */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/60">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                  </span>
                  <span>Nội dung đang chiếu · {views.find(item => item.value === state.view)?.label}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Live Stage</span>
              </div>
              <div className="p-3 bg-slate-950 aspect-video flex items-center justify-center relative overflow-hidden">
                <MeetingStage snapshot={snapshot} now={now} />
              </div>
            </div>

            {/* Quick View Selector Pills */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Chuyển màn hình trình chiếu
              </span>
              <fieldset disabled={disabled} className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Chọn nội dung trình chiếu">
                {views.map(view => {
                  const Icon = view.icon;
                  const isActive = state.view === view.value;
                  return (
                    <button
                      key={view.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => void showView(view.value)}
                      className={`flex items-center justify-center gap-2 min-h-11 rounded-xl px-3 py-2.5 text-xs font-bold transition cursor-pointer disabled:opacity-40 ${isActive
                        ? "bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-sm shadow-cyan-600/20"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                        }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                      <span>{view.label}</span>
                    </button>
                  );
                })}
              </fieldset>
            </div>

            {commandError && (
              <p role="alert" className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-700">
                {commandError}
              </p>
            )}

            {/* Current Speaker & Micro Countdown Controller */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <Megaphone className="h-4 w-4 text-cyan-600" />
                  Người đang phát biểu
                </span>
                {current && (
                  <span className="text-[11px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md font-bold">
                    Lượt {meeting.currentIndex + 1}/{meeting.speakers.length}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap bg-gradient-to-r from-cyan-50/70 to-sky-50/50 p-4 rounded-2xl border border-cyan-100">
                <div className="min-w-0">
                  <strong className="text-base sm:text-lg font-bold text-slate-800 block truncate">
                    {current?.name || (meeting.speechesCompletedAt ? "Đã hoàn tất phần phát biểu" : "Chưa bắt đầu")}
                  </strong>
                  <p className="text-xs text-slate-500 mt-0.5">{timer?.label || "Sẵn sàng"}</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl sm:text-4xl font-mono font-black tabular-nums text-cyan-800">
                    {timer?.time || "—"}
                  </span>
                </div>
              </div>

              {/* MC Control Command Grid */}
              <fieldset disabled={disabled} className="grid grid-cols-2 gap-2 pt-1">
                {meeting.status === "scheduled" && (
                  <button
                    type="button"
                    className="col-span-2 flex items-center justify-center gap-2 min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
                    onClick={() => void control("start")}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Bắt đầu cuộc họp</span>
                  </button>
                )}

                {meeting.status === "paused" ? (
                  <button
                    type="button"
                    className="col-span-2 flex items-center justify-center gap-2 min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                    onClick={() => void command("/presentation", { speakerId: current?.id })}
                    disabled={!current}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Tiếp tục</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 min-h-11 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40"
                    disabled={!current || meeting.status !== "live"}
                    onClick={() => void control(meeting.speakerStartedAt ? "pause" : "start_speaker")}
                  >
                    {meeting.speakerStartedAt ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    <span>{meeting.speakerStartedAt ? "Tạm dừng" : "Bắt đầu đếm giờ"}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 min-h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-40"
                  disabled={!current || meeting.currentIndex <= 0}
                  onClick={() => void control("previous")}
                >
                  <SkipBack className="h-3.5 w-3.5" />
                  <span>Người trước</span>
                </button>

                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 min-h-11 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40"
                  disabled={!current}
                  onClick={() => void control("next")}
                >
                  <span>{meeting.currentIndex + 1 >= meeting.speakers.length ? "Hoàn tất phát biểu" : "Người tiếp theo"}</span>
                  <SkipForward className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 min-h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-40"
                  disabled={!current}
                  onClick={() => void control("reset_speaker")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Đặt lại đồng hồ</span>
                </button>
              </fieldset>
            </div>

            {/* Auto Advance Settings */}
            <AutoAdvanceSettings
              key={String(state.autoAdvance)}
              state={state}
              disabled={Boolean(disabled)}
              onSave={value => command("/presentation-state", value, "PATCH")}
            />

            {/* End Meeting Action */}
            {["live", "paused"].includes(meeting.status) && (
              <button
                type="button"
                disabled={busy || Boolean(syncError)}
                className="w-full min-h-11 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                onClick={() => setShowFinish(true)}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Kết thúc cuộc họp</span>
              </button>
            )}
          </section>

          {/* RIGHT COLUMN: SPEAKER SELECTOR & LUCKY DRAW (5/12) */}
          <section className="lg:col-span-5 space-y-5">
            {/* Pick Speaker Card */}
            <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <Users className="h-4 w-4 text-cyan-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Chọn người phát biểu</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Chọn để xem trước, bấm “Bắt đầu & chiếu” để đưa lên màn hình lớn.
              </p>
              <select
                aria-label="Người phát biểu"
                value={selectedSpeaker}
                onChange={event => setSelectedSpeaker(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none transition shadow-2xs"
              >
                <option value="">Chọn trong {meeting.speakers.length} người đã check-in</option>
                {meeting.speakers.map((person, index) => (
                  <option key={person.id} value={person.id}>
                    {index + 1}. {person.name}{person.id === current?.id ? " · Đang phát biểu" : ""}
                  </option>
                ))}
              </select>

              {selected && (
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
                  <SpeakerStage meeting={meeting} slide={snapshot.slides.find(slide => slide.id === selected.id)} now={now} />
                </div>
              )}

              <fieldset disabled={disabled || !selected} className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 min-h-11 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40"
                  onClick={() => void command("/presentation", { speakerId: selected?.id })}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Bắt đầu & chiếu</span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 min-h-11 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition cursor-pointer disabled:opacity-40"
                  disabled={Boolean(selected) && meeting.speakers.indexOf(selected) < Math.max(0, meeting.currentIndex)}
                  onClick={() => void command("/defer", { speakerId: selected?.id })}
                >
                  <span>Để cuối lượt</span>
                </button>
              </fieldset>
            </div>

            {/* Lucky Draw Card */}
            <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <Gift className="h-4 w-4 text-cyan-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quay thưởng trên màn hình lớn</h2>
              </div>
              <select
                aria-label="Giải thưởng"
                value={selectedPrize}
                onChange={event => setSelectedPrize(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none transition shadow-2xs"
              >
                <option value="">Chọn giải thưởng</option>
                {meeting.luckyDraw?.prizes.map(prize => (
                  <option key={prize.id} value={prize.id}>
                    {prize.name} · {prize.winners.length}/{prize.quantity}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {meeting.luckyDraw?.prizes.length ? "Có thể tạo thêm giải ngay tại đây." : "Chưa có giải thưởng để quay."}
                </p>
                <button
                  type="button"
                  onClick={() => { setQuickPrizeOpen(open => !open); setQuickPrizeError(""); }}
                  disabled={disabled}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tạo giải nhanh
                </button>
              </div>
              {quickPrizeOpen && (
                <form onSubmit={createQuickPrize} className="grid grid-cols-[1fr_5.5rem] gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Tên giải
                    <input
                      required
                      autoFocus
                      value={quickPrizeName}
                      onChange={event => setQuickPrizeName(event.target.value)}
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-amber-400"
                    />
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600">
                    Số lượng
                    <input
                      aria-label="Số lượng người trúng"
                      required
                      type="number"
                      min={1}
                      max={100}
                      value={quickPrizeQuantity}
                      onChange={event => setQuickPrizeQuantity(Math.max(1, Number(event.target.value) || 1))}
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs text-slate-800 outline-none focus:border-amber-400"
                    />
                  </label>
                  {quickPrizeError && <p role="alert" className="col-span-2 text-xs font-semibold text-rose-600">{quickPrizeError}</p>}
                  <button
                    type="submit"
                    disabled={creatingPrize || !quickPrizeName.trim()}
                    className="col-span-2 min-h-10 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-40"
                  >
                    {creatingPrize ? "Đang tạo…" : "Tạo và chọn giải này"}
                  </button>
                </form>
              )}
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 min-h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold shadow-sm shadow-amber-500/20 transition cursor-pointer disabled:opacity-40"
                disabled={disabled || drawing || !activePrize || activePrize.winners.length >= activePrize.quantity || meeting.status === "scheduled"}
                onClick={() => void command("/presentation-draw", { prizeId: selectedPrize })}
              >
                <Sparkles className="h-4 w-4" />
                <span>{drawing ? "Đang quay…" : "Bắt đầu quay"}</span>
              </button>
              <p className="text-[11px] text-slate-400">Hai màn hình cùng hiển thị kết quả sau 5 giây.</p>
            </div>
          </section>
        </main>
      )}

      {/* Share QR Dialog */}
      {share && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-label="Mở điều khiển trên điện thoại">
          <div className="max-w-sm w-full space-y-4 rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Bảng điều khiển cuộc họp</h2>
              <button type="button" onClick={() => setShare(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">Quét mã và đăng nhập tài khoản có quyền điều hành cuộc họp.</p>
            {shareQr && (
              <div className="p-4 bg-slate-50 rounded-2xl inline-block border border-slate-200/80">
                <img src={shareQr} alt="QR mở bảng điều khiển" className="mx-auto w-56 h-56 rounded-lg" />
              </div>
            )}
            <a
              href={controlUrl}
              className="block text-xs font-bold text-cyan-700 hover:text-cyan-800 underline transition"
            >
              Mở bảng điều khiển
            </a>
            <button
              type="button"
              className="w-full min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              onClick={() => setShare(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showFinish}
        title="Kết thúc cuộc họp?"
        description="Màn hình trình chiếu sẽ thông báo cuộc họp đã kết thúc."
        isSubmitting={busy}
        onClose={() => setShowFinish(false)}
        onConfirm={async () => { if (await control("finish")) setShowFinish(false); }}
        confirmLabel="Kết thúc cuộc họp"
      />
    </div>,
    document.body
  );
}
