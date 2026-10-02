import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ChevronLeft, ChevronRight, Play, RefreshCw, Pencil, ArrowDownToLine } from "lucide-react";
import { renderProfileSlide, loadSlideImage, SLIDE_WIDTH, SLIDE_HEIGHT } from "./profileSlideRenderer";
import { drawSlideTimer, getSlideTimer, type SlideTimerMeeting } from "./slideTimer";
import { SlideTransitionDelayInput } from "./SlideTransitionDelayInput";
import { SpeechesCompleteMessage } from "./SpeechesCompleteDialog";
import type { ProfileSlide, SlideDeck } from "./slideTypes";

type Props = {
  meeting: SlideTimerMeeting & { _id: string; __v: number };
  canManage: boolean;
  startFromFirst?: boolean;
  initialSpeakerId?: string;
  onDeferSpeaker?: (speakerId: string | string[]) => Promise<void>;
  autoAdvance?: boolean;
  onMoveSpeaker?: (direction: number) => Promise<void>;
  controlBusy?: boolean;
  onStartPresentation?: (speakerId: string) => Promise<void>;
  autoAdvanceDelay?: number;
  onAutoAdvanceChange?: (enabled: boolean) => void;
  onAutoAdvanceDelayChange?: (seconds: number) => void;
  fullscreenRequest?: Promise<boolean> | null;
  onPresentationStarted?: () => void;
  onPresentationClosed?: () => void;
  api: (path: string, method?: string, body?: unknown) => Promise<SlideDeck>;
};
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40";
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function MeetingSlides({ meeting, canManage, api, startFromFirst = false, onPresentationStarted, onPresentationClosed, autoAdvance = false, autoAdvanceDelay = 3, onAutoAdvanceChange, onAutoAdvanceDelayChange, fullscreenRequest, onStartPresentation, onMoveSpeaker, controlBusy = false, initialSpeakerId, onDeferSpeaker }: Props) {
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
  const [checkedSpeakerIds, setCheckedSpeakerIds] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const mode = autoAdvance ? "auto" : "manual";
  const changeMode = useCallback((next: "manual" | "auto") => {
    if (!canManage) return;
    onAutoAdvanceChange?.(next === "auto");
  }, [onAutoAdvanceChange, canManage]);
  const [presenting, setPresenting] = useState(startFromFirst);
  const presentationActive = useRef(startFromFirst);
  presentationActive.current = presenting;
  const presentationDialog = useRef<HTMLDivElement>(null);
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
  // Selection previews a profile; fullscreen follows the shared speaker after starting it.
  const followsSpeaker = ["live", "paused"].includes(meeting.status);
  const chosen = (!followsSpeaker || !presenting || startingSpeech) ? queue.find(s => s.id === selectedId) : undefined;
  const selected = chosen || (followsSpeaker
    ? deck.slides.find(s => s.id === currentSpeakerId)
    : queue[0]);
  useEffect(() => { setSelectedId(""); setCheckedSpeakerIds([]); }, [currentSpeakerId]);
  const active = draft || selected;
  const speechesComplete = !!meeting.speechesCompletedAt && ["live", "paused"].includes(meeting.status);
  const timer = useMemo(() => getSlideTimer(meeting, active?.id, now), [meeting, active?.id, now]);
  const index = queue.findIndex(s => s.id === selected?.id);

  const navigationBusy = startingSpeech || controlBusy || !!draft || loading;
  const canMove = (direction: number) => !navigationBusy && (followsSpeaker
    ? canManage && !!onMoveSpeaker && !autoAdvance && !!currentSpeakerId && (direction > 0 || meeting.currentIndex > 0)
    : !!queue.length && index + direction >= 0 && index + direction < queue.length);
  const move = useCallback((direction: number) => {
    if (speechRequest.current || controlBusy || draft || loading) return;
    if (!followsSpeaker) {
      const next = queue[index + direction];
      if (next) setSelectedId(next.id);
      return;
    }
    if (!canManage || !onMoveSpeaker || autoAdvance || !currentSpeakerId || (direction < 0 && meeting.currentIndex <= 0)) return;
    setSelectedId("");
    speechRequest.current = true;
    setStartingSpeech(true); setError("");
    void onMoveSpeaker(direction).catch(error => {
      setError(error instanceof Error ? error.message : "Không chuyển được lượt. Vui lòng thử lại.");
    }).finally(() => { speechRequest.current = false; if (mounted.current) setStartingSpeech(false); });
  }, [queue, index, followsSpeaker, canManage, onMoveSpeaker, autoAdvance, currentSpeakerId, meeting.currentIndex, controlBusy, draft, loading]);

  const deferSpeaker = async (speakerId: string | string[]) => {
    if (!canManage || !onDeferSpeaker || speechRequest.current || navigationBusy) return;
    speechRequest.current = true;
    setStartingSpeech(true); setError("");
    try { await onDeferSpeaker(speakerId); setSelectedId(""); setCheckedSpeakerIds([]); }
    catch (error) { setError(error instanceof Error ? error.message : "Không hoãn được lượt."); }
    finally { speechRequest.current = false; if (mounted.current) setStartingSpeech(false); }
  };



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
    if (!presentationActive.current) return;
    setPresenting(false);
    presentationActive.current = false;
    onPresentationStarted?.();
    if (fullScreenOwned.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    fullScreenOwned.current = false;
    onPresentationClosed?.();
    window.setTimeout(() => launchButton.current?.focus(), 0);
  }, [onPresentationStarted, onPresentationClosed]);

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
    };
  }, [closePresentation]);

  useEffect(() => {
    if (!presenting) return;
    const keydown = (e: KeyboardEvent) => {
      if (document.querySelector("[data-speeches-complete]")) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePresentation(); return; }
      if (e.key === "Tab") {
        e.preventDefault(); presentationDialog.current?.focus(); return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (mode !== "manual") return;
        move(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [presenting, move, closePresentation, mode]);

  useEffect(() => {
    if (presenting) presentationDialog.current?.focus();
  }, [presenting]);

  const present = useCallback(() => {
    presentationActive.current = true;
    setDraft(null); setPresenting(true);
    if (!document.fullscreenElement && !(startFromFirst && fullscreenRequest) && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().then(() => {
        if (mounted.current && presentationActive.current) fullScreenOwned.current = true;
        else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      }).catch(() => {});
    }
  }, [fullscreenRequest, startFromFirst]);

  const beginPresentation = useCallback((slide: ProfileSlide) => {
    if (speechRequest.current) return;
    setSelectedId(slide.id);
    present();
    if (onStartPresentation) {
      speechRequest.current = true;
      setStartingSpeech(true); setError("");
      void onStartPresentation(slide.id).catch(error => {
        closePresentation();
        setError(error instanceof Error ? error.message : "Không bắt đầu được bộ đếm. Vui lòng thử lại.");
      }).finally(() => { speechRequest.current = false; if (mounted.current) setStartingSpeech(false); });
    }
  }, [present, onStartPresentation, closePresentation]);

  useEffect(() => {
    if (!startFromFirst || loading || error || !deck.slides.length) return;
    beginPresentation(deck.slides.find(slide => slide.id === initialSpeakerId) || deck.slides.find(slide => slide.id === currentSpeakerId) || deck.slides[0]);
    onPresentationStarted?.();
  }, [startFromFirst, loading, error, deck.slides, initialSpeakerId, currentSpeakerId, beginPresentation, onPresentationStarted]);

  async function save(reset = false) {
    if (!active || saving) return;
    setSaving(true); setError("");
    try {
      const id = active.id;
      const profile = { name: active.name, company: active.company, photoURL: active.photoURL, coverImage: active.coverImage, phone: active.phone, ...(active.email !== undefined ? { email: active.email } : {}), industry: active.industry, bio: active.bio };
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
    role="img" aria-label={active ? `Slide ${active.kind === "member" ? "thành viên" : "khách mời"}: ${active.name}, ${active.company}, ${[active.phone, active.email, active.industry].filter(Boolean).join(", ")}, ${active.bio}` : "Chưa chọn người"}
    style={{ width: "100%", height: "100%", objectFit: "contain", visibility: drawing || !active || drawError ? "hidden" : "visible" }} />;

  return <section aria-label="Slide giới thiệu" className="space-y-4">
    {timer && <p className="sr-only" role="timer" aria-live="off">#{timer.arrivalOrder}: {timer.time}. {timer.label}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm font-semibold">Chế độ <select aria-label="Chế độ trình chiếu" className="ml-2 rounded-lg border p-2" value={mode} disabled={!!draft || !canManage || !onAutoAdvanceChange || navigationBusy} onChange={e => changeMode(e.target.value as typeof mode)}>
        <option value="manual">Thủ công</option><option value="auto">Tự động</option>
      </select></label>
      {mode === "auto" && <label className="flex items-center gap-2 text-sm">Chờ sau khi hết giờ <SlideTransitionDelayInput value={autoAdvanceDelay} onChange={value => onAutoAdvanceDelayChange?.(value)} disabled={!canManage} /> giây rồi chuyển slide</label>}
      <button className={button} disabled={loading || !!draft} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} /> Làm mới hồ sơ</button>
      <button className={button} disabled={!ready} onClick={download}><Download size={16} /> Tải PNG</button>
      <button
        ref={launchButton}
        className={button}
        disabled={navigationBusy || !!error || !selected}
        onClick={() => {
          const target = (checkedSpeakerIds.length > 0 ? deck.slides.find(s => s.id === checkedSpeakerIds[checkedSpeakerIds.length - 1] || checkedSpeakerIds.includes(s.id)) : null) || selected;
          if (target) beginPresentation(target);
        }}
      >
        <Play size={16} /> Bắt đầu thuyết trình
      </button>
    </div>
    <p className="text-xs text-slate-500">Toàn màn hình: dùng phím ← → để chuyển lượt ở chế độ thủ công; Esc để thoát toàn màn hình.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button className="underline" onClick={() => setRevision(v => v + 1)}>Tải lại dữ liệu</button></p>}
    <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-stretch">
      <aside className="flex flex-col h-full rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Danh sách chiếu ({queue.length}/{deck.slides.length})
          </p>
          {!followsSpeaker && !(canManage && onDeferSpeaker) && meeting.status === "scheduled" && (
            <button className="text-xs text-cyan-700 font-semibold underline cursor-pointer" disabled={!!draft} onClick={() => setExcluded(new Set())}>
              Chọn tất cả
            </button>
          )}
        </div>
        {canManage && onDeferSpeaker && ["scheduled", "live", "paused"].includes(meeting.status) && checkedSpeakerIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs py-1 mt-1">
            <button
              type="button"
              title="Chuyển xuống cuối lượt"
              aria-label="Chuyển xuống cuối lượt"
              disabled={navigationBusy}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition cursor-pointer shadow-2xs"
              onClick={() => void deferSpeaker(checkedSpeakerIds)}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span className="font-bold">({checkedSpeakerIds.length})</span>
            </button>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-cyan-700 transition-colors cursor-pointer"
              disabled={navigationBusy}
              onClick={() => {
                setCheckedSpeakerIds([]);
                setSelectedId("");
              }}
            >
              Bỏ chọn
            </button>
          </div>
        )}
        <div className="flex-1 min-h-[360px] max-h-[540px] lg:max-h-none space-y-1 overflow-y-auto pr-1 mt-2">
          {deck.slides.map(s => {
            const isSelected = selected?.id === s.id || checkedSpeakerIds.includes(s.id);
            return (
              <div
                key={s.id}
                className={`flex flex-wrap items-center gap-2 rounded-xl p-2.5 transition-colors ${
                  isSelected
                    ? "bg-cyan-50/90 border border-cyan-300 text-cyan-950 font-medium shadow-2xs"
                    : "hover:bg-slate-50 border border-transparent text-slate-800"
                }`}
              >
                {canManage && onDeferSpeaker && ["scheduled", "live", "paused"].includes(meeting.status) && (
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${s.name}`}
                    checked={checkedSpeakerIds.includes(s.id)}
                    disabled={navigationBusy || (meeting.status !== "scheduled" && meeting.speakers.findIndex(person => person.id === s.id) < meeting.currentIndex)}
                    onChange={e => {
                      if (e.target.checked) {
                        setCheckedSpeakerIds(ids => [...ids, s.id]);
                        setSelectedId(s.id);
                      } else {
                        setCheckedSpeakerIds(ids => {
                          const next = ids.filter(id => id !== s.id);
                          if (selectedId === s.id) {
                            setSelectedId(next[next.length - 1] || "");
                          }
                          return next;
                        });
                      }
                    }}
                  />
                )}
                {!followsSpeaker && !(canManage && onDeferSpeaker) && meeting.status === "scheduled" && (
                  <input
                    type="checkbox"
                    aria-label={`Chiếu ${s.name}`}
                    checked={!excluded.has(s.id)}
                    disabled={!!draft}
                    onChange={e => setExcluded(old => {
                      const next = new Set(old);
                      if (e.target.checked) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })}
                  />
                )}
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-xs disabled:opacity-50 cursor-pointer"
                  aria-pressed={isSelected}
                  disabled={navigationBusy || (followsSpeaker && !canManage) || excluded.has(s.id)}
                  onClick={() => setSelectedId(s.id)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="truncate font-bold text-slate-800">{s.name}</span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      s.kind === "member"
                        ? "bg-cyan-50 text-cyan-700 border border-cyan-200/80"
                        : "bg-amber-50 text-amber-700 border border-amber-200/80"
                    }`}>
                      {s.kind === "member" ? "Thành viên" : "Khách mời"}
                    </span>
                  </div>
                  {s.company && <span className="block truncate text-[11px] text-slate-400 mt-0.5">{s.company}</span>}
                </button>
                {canManage && onDeferSpeaker && ["scheduled", "live", "paused"].includes(meeting.status) && meeting.speakers.findIndex(person => person.id === s.id) >= (meeting.status === "scheduled" ? 0 : Math.max(0, meeting.currentIndex)) && (
                  <button
                    type="button"
                    title="Để cuối lượt"
                    aria-label={`Để cuối lượt: ${s.name}`}
                    className="p-1.5 rounded-lg border border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition cursor-pointer"
                    disabled={navigationBusy || meeting.speakers.at(-1)?.id === s.id}
                    onClick={() => void deferSpeaker(s.id)}
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
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
            <button aria-label="Slide trước" className={button} disabled={!canMove(-1)} onClick={() => move(-1)}><ChevronLeft size={16} /></button>
            <span className="text-sm text-slate-500">{followsSpeaker ? "Đồng bộ diễn giả" : `${index < 0 ? 0 : index + 1} / ${queue.length}`}</span>
            <button aria-label="Slide tiếp" className={button} disabled={!canMove(1)} onClick={() => move(1)}><ChevronRight size={16} /></button>
          </div>
          {canManage && active && !draft && <button className={button} disabled={loading || !!error} onClick={() => { setSelectedId(active.id); draftVersion.current = deck.version; setDraft({ ...active }); }}><Pencil size={16} /> Bổ sung thông tin slide</button>}
        </div>
        {warnings.map(w => <p key={w} role="status" className="text-sm text-amber-700">{w}</p>)}
        {draft && <form className="space-y-3 rounded-xl border bg-white p-4" onSubmit={e => { e.preventDefault(); void save(); }}>
          <p className="text-sm font-bold">Thông tin riêng cho slide trong cuộc họp này</p>
          <p className="text-xs text-slate-500">Tự điền từ hồ sơ khi chưa có bản chỉnh riêng. Bio có thể nhập tại đây. Lưu sẽ giữ bản thông tin hiện tại cho slide; dùng “Dùng lại hồ sơ” để lấy thông tin hồ sơ mới nhất.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["name", "Họ và tên", "text", 150], ["company", "Công ty / thương hiệu", "text", 150],
              ["phone", "Số điện thoại", "tel", 40], ["email", "Email", "email", 254], ["industry", "Lĩnh vực / dịch vụ", "text", 150],
              ["photoURL", "URL ảnh đại diện", "url", 2000], ["coverImage", "URL ảnh bìa", "url", 2000],
            ] as const).map(([key, label, type, max]) => <label key={key} className="space-y-1 text-xs font-semibold">{label}<input className={fieldClass} type={type} maxLength={max} required={key === "name"} value={draft[key] ?? ""} disabled={saving} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
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
    {presenting && createPortal(<div ref={presentationDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Trình chiếu hồ sơ" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black" style={{ cursor: "none", outline: "none" }}>
      <div style={{ width: "min(100vw, 177.7778vh)", height: "min(100vh, 56.25vw)" }}>{canvas(screen)}</div>
      {(loading || error || drawing || !active || drawError) && <div role="status" className="absolute text-white">{speechesComplete && followsSpeaker ? <div className="max-w-2xl rounded-3xl bg-white p-12"><SpeechesCompleteMessage /></div> : error || drawError || (loading ? "Đang tải slide…" : active ? "Đang chuẩn bị slide…" : "Chờ người phát biểu…")}</div>}
    </div>, document.body)}
  </section>;
}
