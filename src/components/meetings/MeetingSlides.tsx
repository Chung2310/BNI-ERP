import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Maximize, ChevronLeft, ChevronRight, X, Play, Pause, RefreshCw, Pencil } from "lucide-react";
import { renderProfileSlide, loadSlideImage, SLIDE_WIDTH, SLIDE_HEIGHT } from "./profileSlideRenderer";
import { drawSlideTimer, getSlideTimer, type SlideTimerMeeting } from "./slideTimer";
import { SlideTransitionDelayInput } from "./SlideTransitionDelayInput";
import { SpeechesCompleteMessage } from "./SpeechesCompleteDialog";
import type { ProfileSlide, SlideDeck } from "./slideTypes";

type Props = {
  meeting: SlideTimerMeeting & { _id: string; __v: number };
  canManage: boolean;
  startFromFirst?: boolean;
  autoAdvance?: boolean;
  onStartPresentation?: (speakerId: string) => Promise<void>;
  autoAdvanceDelay?: number;
  onAutoAdvanceChange?: (enabled: boolean) => void;
  onAutoAdvanceDelayChange?: (seconds: number) => void;
  fullscreenRequest?: Promise<boolean> | null;
  onPresentationStarted?: () => void;
  api: (path: string, method?: string, body?: unknown) => Promise<SlideDeck>;
};
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40";
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function MeetingSlides({ meeting, canManage, api, startFromFirst = false, onPresentationStarted, autoAdvance = false, autoAdvanceDelay = 3, onAutoAdvanceChange, onAutoAdvanceDelayChange, fullscreenRequest, onStartPresentation }: Props) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (meeting.status !== "live" || !meeting.speakerStartedAt) return;
    setNow(Date.now());
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(clock);
  }, [meeting.status, meeting.speakerStartedAt]);
  const [deck, setDeck] = useState<SlideDeck>({ slides: [], version: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"manual" | "auto" | "live">(autoAdvance ? "auto" : "manual");
  const changeMode = useCallback((next: "manual" | "auto" | "live") => {
    if (next === "auto" && !canManage) return;
    setMode(next);
    onAutoAdvanceChange?.(next === "auto");
  }, [onAutoAdvanceChange, canManage]);
  useEffect(() => {
    setMode(previous => autoAdvance ? "auto" : previous === "auto" ? "manual" : previous);
  }, [autoAdvance]);
  const [presenting, setPresenting] = useState(startFromFirst);
  const [cleanPresentation, setCleanPresentation] = useState(startFromFirst);
  const presentationActive = useRef(startFromFirst);
  presentationActive.current = presenting;
  const presentationDialog = useRef<HTMLDivElement>(null);
  const [openingSlide, setOpeningSlide] = useState<{ slideId: string; speakerId: string | undefined } | null>(null);
  const [controls, setControls] = useState(true);
  const [draft, setDraft] = useState<ProfileSlide | null>(null);
  const [saving, setSaving] = useState(false);
  const [startingSpeech, setStartingSpeech] = useState(false);
  const speechRequest = useRef(false);
  const [drawing, setDrawing] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drawError, setDrawError] = useState("");
  const preview = useRef<HTMLCanvasElement>(null);
  const screen = useRef<HTMLCanvasElement>(null);
  const rendered = useRef<HTMLCanvasElement | null>(null);
  const draftVersion = useRef(0);
  const hideTimer = useRef<number | undefined>(undefined);
  const fullScreenOwned = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode immediately sets effects up again; only a real unmount exits.
      queueMicrotask(() => {
        if (!mounted.current && fullScreenOwned.current && document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        }
      });
    };
  }, []);
  const launchButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(`/${meeting._id}/slides`).then((data: SlideDeck) => {
      if (!cancelled) { setDeck(data); setError(""); }
    }).catch(e => { if (!cancelled) setError(e.message || "Không tải được slide."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, meeting._id, meeting.__v, revision]);

  const queue = useMemo(() => deck.slides.filter(s => !excluded.has(s.id)), [deck.slides, excluded]);
  const currentSpeakerId = ["live", "paused"].includes(meeting.status) ? meeting.speakers[meeting.currentIndex]?.id : undefined;
  // Preview the first profile on launch, then follow the next MC speaker change.
  const liveSlideId = openingSlide && openingSlide.speakerId === currentSpeakerId ? openingSlide.slideId : currentSpeakerId;
  const followsSpeaker = mode !== "manual";
  const selected = followsSpeaker
    ? deck.slides.find(s => s.id === liveSlideId)
    : queue.find(s => s.id === selectedId) || queue[0];
  useEffect(() => {
    if (openingSlide && openingSlide.speakerId !== currentSpeakerId) setOpeningSlide(null);
  }, [currentSpeakerId, openingSlide]);
  const active = draft || selected;
  const speechesComplete = !!meeting.speechesCompletedAt && ["live", "paused"].includes(meeting.status);
  const timer = useMemo(() => getSlideTimer(meeting, active?.id, now), [meeting, active?.id, now]);
  const index = queue.findIndex(s => s.id === selected?.id);

  const move = useCallback((direction: number) => {
    setDraft(null);
    if (queue.length) setSelectedId(queue[(Math.max(0, index) + direction + queue.length) % queue.length].id);
  }, [queue, index]);



  useEffect(() => {
    let cancelled = false;
    rendered.current = null;
    setDrawing(true); setWarnings([]); setDrawError("");
    if (!active) { setDrawing(false); return; }
    renderProfileSlide(active).then(result => {
      if (cancelled) return;
      rendered.current = result.canvas;
      for (const target of [preview.current, screen.current]) {
        target?.getContext("2d")?.drawImage(result.canvas, 0, 0);
      }
      setWarnings(result.warnings);
    }).catch(e => { if (!cancelled) setDrawError(e.message || "Không thể dựng slide."); })
      .finally(() => { if (!cancelled) setDrawing(false); });
    return () => { cancelled = true; };
  }, [active]);

  useEffect(() => {
    if (presenting && rendered.current) screen.current?.getContext("2d")?.drawImage(rendered.current, 0, 0);
  }, [presenting]);

  useEffect(() => {
    if (!rendered.current || drawing) return;
    for (const target of [preview.current, screen.current]) {
      const ctx = target?.getContext("2d");
      if (ctx) { ctx.drawImage(rendered.current, 0, 0); drawSlideTimer(ctx, timer); }
    }
  }, [timer, drawing, presenting]);

  // Preload the next two attendees, including during manual presentation.
  useEffect(() => {
    for (const offset of [1, 2]) {
      const next = queue[(Math.max(0, index) + offset) % queue.length];
      if (next) { void loadSlideImage(next.photoURL); void loadSlideImage(next.coverImage); }
    }
  }, [queue, index]);

  const closePresentation = useCallback(() => {
    setPresenting(false); setMode(autoAdvance ? "auto" : "manual"); setOpeningSlide(null);
    presentationActive.current = false;
    onPresentationStarted?.();
    if (fullScreenOwned.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    fullScreenOwned.current = false;
    window.setTimeout(() => launchButton.current?.focus(), 0);
  }, [onPresentationStarted, autoAdvance]);

  useEffect(() => {
    if (!fullscreenRequest) return;
    let cancelled = false;
    void fullscreenRequest.then(opened => {
      if (!opened) return;
      if (cancelled && mounted.current) return;
      if (!mounted.current || !presentationActive.current) {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      } else {
        fullScreenOwned.current = true;
      }
    });
    return () => { cancelled = true; };
  }, [fullscreenRequest]);

  useEffect(() => {
    const onFullscreen = () => {
      if (!document.fullscreenElement && fullScreenOwned.current) closePresentation();
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.clearTimeout(hideTimer.current);
    };
  }, [closePresentation]);

  useEffect(() => {
    if (!presenting) return;
    const keydown = (e: KeyboardEvent) => {
      if (document.querySelector("[data-speeches-complete]")) return;
      if (e.key === "Escape") { e.preventDefault(); closePresentation(); }
      if (e.key === "Tab") {
        if (cleanPresentation) { e.preventDefault(); presentationDialog.current?.focus(); return; }
        // The presentation is modal; keep keyboard focus on its controls.
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-slide-controls] button'));
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        e.preventDefault();
        buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        setControls(true);
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (cleanPresentation && mode !== "manual") return;
        changeMode("manual"); move(e.key === "ArrowRight" ? 1 : -1);
      }
      if (!cleanPresentation && e.code === "Space" && !(document.activeElement instanceof HTMLButtonElement)) {
        e.preventDefault(); changeMode(mode === "auto" ? "manual" : "auto");
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [presenting, move, closePresentation, cleanPresentation, mode, changeMode]);

  useEffect(() => {
    if (presenting) (cleanPresentation ? presentationDialog.current : exitButton.current)?.focus();
  }, [presenting, cleanPresentation]);

  const showControls = useCallback(() => {
    setControls(true); window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControls(false), 2500);
  }, []);

  const present = useCallback((clean = false) => {
    setCleanPresentation(clean);
    presentationActive.current = true;
    setDraft(null); setPresenting(true); showControls();
    if (!document.fullscreenElement && !(startFromFirst && fullscreenRequest) && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().then(() => {
        if (mounted.current && presentationActive.current) fullScreenOwned.current = true;
        else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      }).catch(() => {});
    }
  }, [showControls, fullscreenRequest, startFromFirst]);

  const beginPresentation = useCallback((slide: ProfileSlide, clean = true) => {
    if (speechRequest.current) return;
    setOpeningSlide({ slideId: slide.id, speakerId: currentSpeakerId });
    setSelectedId(slide.id);
    setMode(autoAdvance ? "auto" : "manual");
    present(clean);
    if (onStartPresentation) {
      speechRequest.current = true;
      setStartingSpeech(true); setError("");
      void onStartPresentation(slide.id).catch(error => {
        closePresentation();
        setError(error instanceof Error ? error.message : "Không bắt đầu được bộ đếm. Vui lòng thử lại.");
      }).finally(() => { speechRequest.current = false; if (mounted.current) setStartingSpeech(false); });
    }
  }, [currentSpeakerId, present, autoAdvance, onStartPresentation, closePresentation]);

  useEffect(() => {
    if (!startFromFirst || loading || error || !deck.slides.length) return;
    beginPresentation(deck.slides.find(slide => slide.id === currentSpeakerId) || deck.slides[0]);
    onPresentationStarted?.();
  }, [startFromFirst, loading, error, deck.slides, currentSpeakerId, beginPresentation, onPresentationStarted]);

  async function save(reset = false) {
    if (!active || saving) return;
    setSaving(true); setError("");
    try {
      const id = active.id;
      const profile = { name: active.name, company: active.company, photoURL: active.photoURL, coverImage: active.coverImage, phone: active.phone, industry: active.industry, bio: active.bio };
      const data = await api(`/${meeting._id}/slides/${id}`, "PUT", { version: draft ? draftVersion.current : deck.version, profile: reset ? null : profile });
      setDeck(data); setDraft(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được slide."); }
    finally { setSaving(false); }
  }

  function download() {
    if (!rendered.current || !active) return;
    try {
      const snapshot = document.createElement("canvas");
      snapshot.width = SLIDE_WIDTH; snapshot.height = SLIDE_HEIGHT;
      const ctx = snapshot.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(rendered.current, 0, 0);
      drawSlideTimer(ctx, timer);
      snapshot.toBlob(blob => {
        if (!blob) { setDrawError("Không thể xuất ảnh. Vui lòng thử lại."); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `BNI-${active.name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "slide"}.png`;
        link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch { setDrawError("Không thể xuất ảnh do quyền truy cập ảnh nguồn. Hãy dùng ảnh đã tải lên hệ thống."); }
  }

  const ready = !!active && !drawing && !drawError && !loading && !error;
  const canvas = (ref: React.RefObject<HTMLCanvasElement>) => <canvas ref={ref} width={SLIDE_WIDTH} height={SLIDE_HEIGHT}
    role="img" aria-label={active ? `Slide ${active.kind === "member" ? "thành viên" : "khách mời"}: ${active.name}, ${active.company}, ${active.kind === "member" ? [active.phone, active.industry].filter(Boolean).join(", ") : ""}, ${active.bio}` : "Chưa chọn người"}
    style={{ width: "100%", height: "100%", objectFit: "contain", visibility: drawing || !active || drawError ? "hidden" : "visible" }} />;

  return <section aria-label="Slide giới thiệu" className="space-y-4">
    {timer && <p className="sr-only" role="timer" aria-live="off">#{timer.arrivalOrder}: {timer.time}. {timer.label}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm font-semibold">Chế độ <select aria-label="Chế độ trình chiếu" className="ml-2 rounded-lg border p-2" value={mode} disabled={!!draft} onChange={e => changeMode(e.target.value as typeof mode)}>
        <option value="manual">Chuyển thủ công</option><option value="auto" disabled={!canManage}>Tự chuyển sau khi hết giờ</option><option value="live">Theo người đang phát biểu</option>
      </select></label>
      {mode === "auto" && <label className="flex items-center gap-2 text-sm">Chờ sau khi hết giờ <SlideTransitionDelayInput value={autoAdvanceDelay} onChange={value => onAutoAdvanceDelayChange?.(value)} disabled={!canManage} /> giây rồi chuyển slide</label>}
      <button className={button} disabled={loading || !!draft} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} /> Làm mới hồ sơ</button>
      <button className={button} disabled={!ready} onClick={download}><Download size={16} /> Tải PNG</button>
      <button className={button} disabled={startingSpeech || loading || !!error || !selected || !!draft} onClick={() => { if (selected) beginPresentation(selected); }}><Play size={16} /> Bắt đầu thuyết trình</button>
      <button ref={launchButton} className={button} disabled={startingSpeech || !ready || !!draft} onClick={() => { if (selected) beginPresentation(selected, false); }}><Maximize size={16} /> Trình chiếu</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button className="underline" onClick={() => setRevision(v => v + 1)}>Tải lại dữ liệu</button></p>}
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-2 rounded-xl border bg-white p-3">
        <p className="text-sm font-bold">Danh sách chiếu ({queue.length}/{deck.slides.length})</p>
        <p className="text-xs text-slate-500">Theo thứ tự check-in / phát biểu. Chế độ theo diễn giả luôn hiển thị người đang nói.</p>
        <button className="text-xs text-red-700 underline" disabled={!!draft} onClick={() => setExcluded(new Set())}>Chọn tất cả</button>
        <div className="max-h-80 space-y-1 overflow-auto">
          {deck.slides.map(s => <div key={s.id} className={`flex items-center gap-2 rounded-lg p-2 ${selected?.id === s.id ? "bg-red-50" : ""}`}>
            <input type="checkbox" aria-label={`Chiếu ${s.name}`} checked={!excluded.has(s.id)} disabled={!!draft || followsSpeaker} onChange={e => setExcluded(old => { const next = new Set(old); if (e.target.checked) next.delete(s.id); else next.add(s.id); return next; })} />
            <button className="min-w-0 text-left text-sm disabled:opacity-50" disabled={!!draft || excluded.has(s.id)} onClick={() => { setSelectedId(s.id); changeMode("manual"); }}>
              <span className="block truncate font-semibold">{s.name}</span><span className="text-xs text-slate-500">{s.kind === "member" ? "Thành viên" : "Khách mời"}</span>
            </button>
          </div>)}
        </div>
      </aside>
      <div className="min-w-0 space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
          {canvas(preview)}
          {(drawing || !active || drawError) && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white">
            {speechesComplete && followsSpeaker ? <div className="rounded-2xl bg-white p-8"><SpeechesCompleteMessage /></div> : drawError || (loading ? "Đang tải hồ sơ…" : active ? "Đang chuẩn bị ảnh và font…" : followsSpeaker ? "Chưa có người đang phát biểu." : deck.slides.length ? "Chọn ít nhất một người để trình chiếu." : "Chưa có người check-in. Hãy check-in thành viên hoặc khách mời trước.")}
          </div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button aria-label="Slide trước" className={button} disabled={!queue.length || !!draft || followsSpeaker} onClick={() => { changeMode("manual"); move(-1); }}><ChevronLeft size={16} /></button>
            <span className="text-sm text-slate-500">{followsSpeaker ? "Đồng bộ diễn giả" : `${index < 0 ? 0 : index + 1} / ${queue.length}`}</span>
            <button aria-label="Slide tiếp" className={button} disabled={!queue.length || !!draft || followsSpeaker} onClick={() => { changeMode("manual"); move(1); }}><ChevronRight size={16} /></button>
          </div>
          {canManage && active && !draft && <button className={button} disabled={loading || !!error} onClick={() => { changeMode("manual"); setSelectedId(active.id); draftVersion.current = deck.version; setDraft({ ...active }); }}><Pencil size={16} /> Bổ sung thông tin slide</button>}
        </div>
        {warnings.map(w => <p key={w} role="status" className="text-sm text-amber-700">{w}</p>)}
        {draft && <form className="space-y-3 rounded-xl border bg-white p-4" onSubmit={e => { e.preventDefault(); void save(); }}>
          <p className="text-sm font-bold">Thông tin riêng cho slide trong cuộc họp này</p>
          <p className="text-xs text-slate-500">Tự điền từ hồ sơ khi chưa có bản chỉnh riêng. Bio có thể nhập tại đây. Lưu sẽ giữ bản thông tin hiện tại cho slide; dùng “Dùng lại hồ sơ” để lấy thông tin hồ sơ mới nhất.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["name", "Họ và tên", "text", 150], ["company", "Công ty / thương hiệu", "text", 150],
              ["phone", "Số điện thoại", "tel", 40], ["industry", "Lĩnh vực / dịch vụ", "text", 150],
              ["photoURL", "URL ảnh đại diện", "url", 2000], ["coverImage", "URL ảnh bìa", "url", 2000],
            ] as const).filter(([key]) => draft.kind === "member" || (key !== "phone" && key !== "industry")).map(([key, label, type, max]) => <label key={key} className="space-y-1 text-xs font-semibold">{label}<input className={fieldClass} type={type} maxLength={max} required={key === "name"} value={draft[key]} disabled={saving} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
          </div>
          <label className="block text-xs font-semibold">Bio / giới thiệu ngắn<textarea className={fieldClass} rows={3} maxLength={1000} value={draft.bio} disabled={saving} onChange={e => setDraft({ ...draft, bio: e.target.value })} /></label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={button} disabled={saving}>{saving ? "Đang lưu…" : "Lưu thông tin slide"}</button>
            <button type="button" className={button} disabled={saving} onClick={() => { setDraft(null); setError(""); setRevision(v => v + 1); }}>Hủy</button>
            <button type="button" className={button} disabled={saving} onClick={() => void save(true)}>Dùng lại hồ sơ</button>
          </div>
        </form>}
      </div>
    </div>
    {presenting && createPortal(<div ref={presentationDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Trình chiếu hồ sơ" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black" onMouseMove={showControls} onTouchStart={showControls} style={{ cursor: cleanPresentation || !controls ? "none" : "default", outline: "none" }}>
      <div style={{ width: "min(100vw, 177.7778vh)", height: "min(100vh, 56.25vw)" }}>{canvas(screen)}</div>
      {(loading || error || drawing || !active || drawError) && <div role="status" className="absolute text-white">{speechesComplete && followsSpeaker ? <div className="max-w-2xl rounded-3xl bg-white p-12"><SpeechesCompleteMessage /></div> : error || drawError || (loading ? "Đang tải slide…" : active ? "Đang chuẩn bị slide…" : "Chờ người phát biểu…")}</div>}
      {!cleanPresentation && <div data-slide-controls className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900/90 p-3 text-white" style={{ opacity: controls ? 1 : 0 }} onFocus={() => setControls(true)}>
        <button aria-label="Slide trước khi trình chiếu" className="rounded p-2" onClick={() => { changeMode("manual"); move(-1); }}><ChevronLeft /></button>
        <button aria-label={mode === "auto" ? "Tạm dừng tự chạy" : "Bật tự chạy"} className="rounded p-2" onClick={() => changeMode(mode === "auto" ? "manual" : "auto")}>{mode === "auto" ? <Pause /> : <Play />}</button>
        <span className="whitespace-nowrap text-sm">{followsSpeaker ? "Theo diễn giả" : `${index + 1} / ${queue.length}`}</span>
        <button aria-label="Slide tiếp khi trình chiếu" className="rounded p-2" onClick={() => { changeMode("manual"); move(1); }}><ChevronRight /></button>
        <button ref={exitButton} aria-label="Thoát trình chiếu" className="rounded p-2" onClick={closePresentation}><X /></button>
      </div>}
    </div>, document.body)}
  </section>;
}
