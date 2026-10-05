import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { useAuth } from "../../context/AuthContext";
import { tabToPath } from "../../seo/seo-config";
import { meetingRoomUrl } from "../../services/meetingLiveService";
import { presentationState, type MeetingPresentationState, type PresentationView } from "../../utils/meetingPresentation";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { MeetingStage, SpeakerStage } from "./MeetingStage";
import { getSlideTimer } from "./slideTimer";
import { useMeetingLive } from "./useMeetingLive";

const button = "min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-40";
const primary = "min-h-12 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-40";
const views: { value: PresentationView; label: string }[] = [
  { value: "checkin", label: "QR check-in" }, { value: "speaker", label: "Người phát biểu" },
  { value: "luckyDraw", label: "Quay thưởng" }, { value: "activeMembers", label: "Xếp hạng" },
  { value: "waiting", label: "Màn hình chờ" },
];

type Props = { meetingId: string; mode: "control" | "display" };
export default function RemoteMeetingRoom(props: Props) {
  const { hasPermission } = useAuth();
  if (!hasPermission("meetings:manage") && !hasPermission("access:manage")) {
    return <p role="alert" className="p-6">Bạn cần quyền điều hành cuộc họp để mở màn hình này.</p>;
  }
  return <MeetingRoom key={props.meetingId + props.mode} {...props} />;
}

function AutoAdvanceSettings({ state, disabled, onSave }: {
  state: MeetingPresentationState; disabled: boolean;
  onSave: (value: { autoAdvance: boolean; autoAdvanceDelay: number }) => Promise<boolean>;
}) {
  const [enabled, setEnabled] = useState(state.autoAdvance);
  const [delay, setDelay] = useState(String(state.autoAdvanceDelay));
  return <form className="space-y-3 rounded-2xl border bg-white p-4" onSubmit={event => {
    event.preventDefault();
    const seconds = Number(delay);
    if (delay !== "" && Number.isInteger(seconds) && seconds >= 0 && seconds <= 3600) void onSave({ autoAdvance: enabled, autoAdvanceDelay: seconds });
  }}>
    <fieldset disabled={disabled} className="space-y-3">
      <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Tự chuyển người khi hết giờ</label>
      <label className="flex items-center gap-3 text-sm">Thời gian chờ chuyển lượt (giây)
        <input required type="number" min={0} max={3600} step={1} value={delay} onChange={event => setDelay(event.target.value)} className="w-24 rounded-lg border p-3" />
      </label>
      <p className="text-xs text-slate-500">Cuộc họp tiếp tục tự chuyển lượt khi điện thoại khóa màn hình.</p>
      <button className={button}>Lưu chế độ chuyển lượt</button>
    </fieldset>
  </form>;
}

function MeetingRoom({ meetingId, mode }: Props) {
  const readOnly = mode === "display";
  const { snapshot, now, syncError, commandError, connected, busy, refresh, command } = useMeetingLive(meetingId, readOnly);
  const root = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [selectedPrize, setSelectedPrize] = useState("");
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
  const disabled = busy || !!syncError || !snapshot || closed;
  const control = (action: string) => command("/control", { action });
  const showView = (view: PresentationView) => command("/presentation-state", { view }, "PATCH");
  const timer = meeting && getSlideTimer(meeting, current?.id, now);
  const drawing = now < Date.parse(state.drawRevealsAt || "");
  const activePrize = meeting?.luckyDraw?.prizes.find(prize => prize.id === selectedPrize);
  const status = syncError || (snapshot ? connected ? "Đã đồng bộ máy chủ" : "Đang đồng bộ qua kết nối dự phòng" : "Đang kết nối cuộc họp…");

  return createPortal(<div ref={root} className="fixed inset-0 z-[200] overflow-y-auto bg-slate-100 text-slate-900">
    <header className={(readOnly && fullscreen ? "absolute inset-x-0 top-0 z-20 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100 " : "sticky top-0 z-20 ") + "flex flex-wrap items-center justify-between gap-2 border-b bg-white/95 p-3"}>
      <div><h1 className="font-bold">{readOnly ? "Màn hình trình chiếu" : "Bảng điều khiển cuộc họp"}</h1><p className="text-xs text-slate-500">{meeting?.title}</p></div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {readOnly ? <><button className={button} onClick={() => void enterFullscreen()}>Toàn màn hình</button>
          <button className={button} onClick={() => setShare(true)}>Mở bảng điều khiển cuộc họp</button></>
          : <a className={button} href={meetingRoomUrl(meetingId, "display")} target="_blank" rel="noreferrer">Mở màn hình trình chiếu</a>}
        <a className={button} href={tabToPath("CUỘC HỌP")}>Về cuộc họp</a>
      </div>
    </header>
    {(syncError || screenError || !readOnly) && <div role="status" className={"flex items-center justify-between gap-2 px-4 py-2 text-xs " + (syncError ? "bg-amber-100 text-amber-900" : "bg-cyan-50 text-cyan-900")}>
      <span>{screenError || status}</span><button type="button" className="underline" onClick={() => void refresh()}>Đồng bộ lại</button>
    </div>}
    {!snapshot ? <div role="status" className="grid min-h-[60vh] place-items-center p-6">{status}</div>
      : readOnly ? <main className="flex min-h-[80vh] items-center justify-center bg-black" style={fullscreen ? { height: "100dvh" } : {}}>
        <div style={{ width: "min(100%, 177.7778dvh)" }}><MeetingStage snapshot={snapshot} now={now} /></div>
      </main> : <main className="mx-auto grid max-w-7xl gap-5 p-3 pb-12 md:p-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border bg-white">
            <p className="border-b px-4 py-3 text-sm font-semibold">Nội dung đang chiếu · {views.find(item => item.value === state.view)?.label}</p>
            <MeetingStage snapshot={snapshot} now={now} />
          </div>
          <fieldset disabled={disabled} className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Chọn nội dung trình chiếu">
            {views.map(view => <button key={view.value} type="button" aria-pressed={state.view === view.value}
              onClick={() => void showView(view.value)} className={state.view === view.value ? primary : button}>{view.label}</button>)}
          </fieldset>
          {commandError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{commandError}</p>}
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm text-slate-500">Người đang phát biểu</p>
            <div className="my-3 flex items-center justify-between gap-3"><strong>{current?.name || (meeting.speechesCompletedAt ? "Đã hoàn tất phần phát biểu" : "Chưa bắt đầu")}</strong>
              <span className="text-3xl font-bold tabular-nums">{timer?.time || "—"}</span></div>
            <p className="mb-4 text-sm text-slate-500">{timer?.label}</p>
            <fieldset disabled={disabled} className="grid grid-cols-2 gap-2">
              {meeting.status === "scheduled" && <button className={primary} onClick={() => void control("start")}>Bắt đầu cuộc họp</button>}
              {meeting.status === "paused"
                ? <button className={primary} onClick={() => void command("/presentation", { speakerId: current?.id })} disabled={!current}>Tiếp tục</button>
                : <button className={primary} disabled={!current || meeting.status !== "live"} onClick={() => void control(meeting.speakerStartedAt ? "pause" : "start_speaker")}>{meeting.speakerStartedAt ? "Tạm dừng" : "Bắt đầu đếm giờ"}</button>}
              <button className={button} disabled={!current || meeting.currentIndex <= 0} onClick={() => void control("previous")}>Người trước</button>
              <button className={button} disabled={!current} onClick={() => void control("next")}>{meeting.currentIndex + 1 >= meeting.speakers.length ? "Hoàn tất phát biểu" : "Người tiếp theo"}</button>
              <button className={button} disabled={!current} onClick={() => void control("reset_speaker")}>Đặt lại đồng hồ</button>
            </fieldset>
          </div>
          <AutoAdvanceSettings key={String(state.autoAdvance) + ":" + state.autoAdvanceDelay} state={state} disabled={!!disabled} onSave={value => command("/presentation-state", value, "PATCH")} />
          {["live", "paused"].includes(meeting.status) && <button disabled={busy || !!syncError} className="min-h-12 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700" onClick={() => setShowFinish(true)}>Kết thúc cuộc họp</button>}
        </section>
        <section className="space-y-4">
          <div className="space-y-4 rounded-2xl border bg-white p-4">
            <h2 className="font-bold">Chọn người phát biểu</h2>
            <p className="text-xs text-slate-500">Chọn để xem trước, bấm “Bắt đầu & chiếu” để đưa lên màn hình lớn.</p>
            <select aria-label="Người phát biểu" value={selectedSpeaker} onChange={event => setSelectedSpeaker(event.target.value)} className="min-h-12 w-full rounded-xl border p-3">
              <option value="">Chọn trong {meeting.speakers.length} người đã check-in</option>
              {meeting.speakers.map((person, index) => <option key={person.id} value={person.id}>{index + 1}. {person.name}{person.id === current?.id ? " · Đang phát biểu" : ""}</option>)}
            </select>
            {selected && <div className="overflow-hidden rounded-xl border"><SpeakerStage meeting={meeting} slide={snapshot.slides.find(slide => slide.id === selected.id)} now={now} /></div>}
            <fieldset disabled={disabled || !selected} className="grid grid-cols-2 gap-2">
              <button className={primary} onClick={() => void command("/presentation", { speakerId: selected?.id })}>Bắt đầu & chiếu</button>
              <button className={button} disabled={!!selected && meeting.speakers.indexOf(selected) < Math.max(0, meeting.currentIndex)} onClick={() => void command("/defer", { speakerId: selected?.id })}>Để cuối lượt</button>
            </fieldset>
          </div>
          <div className="space-y-4 rounded-2xl border bg-white p-4">
            <h2 className="font-bold">Quay thưởng trên màn hình lớn</h2>
            <select aria-label="Giải thưởng" value={selectedPrize} onChange={event => setSelectedPrize(event.target.value)} className="min-h-12 w-full rounded-xl border p-3">
              <option value="">Chọn giải thưởng</option>
              {meeting.luckyDraw?.prizes.map(prize => <option key={prize.id} value={prize.id}>{prize.name} · {prize.winners.length}/{prize.quantity}</option>)}
            </select>
            {!meeting.luckyDraw?.prizes.length && <p className="text-sm text-slate-500">Tạo giải thưởng trong phần Quay thưởng của cuộc họp trước khi điều khiển.</p>}
            <button className={primary} disabled={disabled || drawing || !activePrize || activePrize.winners.length >= activePrize.quantity || meeting.status === "scheduled"}
              onClick={() => void command("/presentation-draw", { prizeId: selectedPrize })}>{drawing ? "Đang quay…" : "Quay & công bố kết quả"}</button>
            <p className="text-xs text-slate-500">Hai màn hình cùng hiển thị kết quả sau 5 giây.</p>
          </div>
        </section>
      </main>}
    {share && <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Mở điều khiển trên điện thoại">
      <div className="max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center"><h2 className="text-lg font-bold">Bảng điều khiển cuộc họp</h2>
        <p className="text-sm">Quét mã và đăng nhập tài khoản có quyền điều hành cuộc họp.</p>
        {shareQr && <img src={shareQr} alt="QR mở bảng điều khiển" className="mx-auto w-64" />}
        <a href={controlUrl} className="block text-cyan-700 underline">Mở bảng điều khiển</a>
        <button className={button} onClick={() => setShare(false)}>Đóng</button>
      </div>
    </div>}
    <ConfirmDialog isOpen={showFinish} title="Kết thúc cuộc họp?" description="Màn hình trình chiếu sẽ thông báo cuộc họp đã kết thúc."
      isSubmitting={busy} onClose={() => setShowFinish(false)} onConfirm={async () => { if (await control("finish")) setShowFinish(false); }} confirmLabel="Kết thúc cuộc họp" />
  </div>, document.body);
}
