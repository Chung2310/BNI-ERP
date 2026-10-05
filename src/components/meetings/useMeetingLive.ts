import { useCallback, useEffect, useRef, useState } from "react";
import { meetingLiveApi, MeetingLiveError, type MeetingLiveSnapshot } from "../../services/meetingLiveService";
import { socketService } from "../../services/socketService";

export function useMeetingLive(meetingId: string, readOnly: boolean) {
  const [snapshot, setSnapshot] = useState<MeetingLiveSnapshot | null>(null);
  const latest = useRef<MeetingLiveSnapshot | null>(null);
  const [now, setNow] = useState(Date.now);
  const [syncError, setSyncError] = useState("");
  const [commandError, setCommandError] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const clock = useRef({ server: 0, local: 0 });

  useEffect(() => {
    if (!meetingId) {
      setSnapshot(null);
      setConnected(false);
      return;
    }
    mounted.current = true;
    latest.current = null;
    clock.current = { server: Date.now(), local: performance.now() };
    let disposed = false;
    let requested = false;
    let inFlight: Promise<void> | null = null;
    const controller = new AbortController();
    const refresh = (): Promise<void> => {
      if (disposed) return Promise.resolve();
      requested = true;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        do {
          requested = false;
          const started = performance.now();
          try {
            const initialized = latest.current !== null;
            const response = await meetingLiveApi<{ meeting: MeetingLiveSnapshot["meeting"]; slides?: MeetingLiveSnapshot["slides"]; serverNow: number; serverReceivedAt?: number }>("/" + meetingId + "/live" + (initialized ? "/state" : ""), "GET", undefined, controller.signal);
            const data: MeetingLiveSnapshot = { ...response, slides: response.slides ?? latest.current?.slides ?? [] };
            if (disposed) return;
            if (data.meeting._id !== meetingId || (latest.current && data.meeting.__v < latest.current.meeting.__v)) continue;
            const received = performance.now();
            const serverWork = data.serverReceivedAt ? Math.max(0, data.serverNow - data.serverReceivedAt) : 0;
            clock.current = { server: data.serverNow + Math.max(0, received - started - serverWork) / 2, local: received };
            setNow(clock.current.server);
            setSyncError("");
            latest.current = data;
            socketService.reconnect();
            setSnapshot(previous => previous && JSON.stringify([previous.meeting, previous.slides]) === JSON.stringify([data.meeting, data.slides]) ? previous : data);
          } catch (error) {
            if (!disposed) setSyncError(error instanceof MeetingLiveError ? error.message : "Mất kết nối. Đang thử đồng bộ lại…");
          }
        } while (requested && !disposed);
      })().finally(() => { inFlight = null; });
      return inFlight;
    };
    refreshRef.current = refresh;
    const onUpdate = (event: { id?: string; meetingId?: string; version?: number; serverNow?: number; live?: Partial<MeetingLiveSnapshot["meeting"]> }) => {
      if (event?.id !== meetingId && event?.meetingId !== meetingId) return;
      const current = latest.current;
      if (!current || !event.live) { void refresh(); return; }
      const version = typeof event.version === "number" ? event.version : event.live.__v;
      if (typeof version === "number" && version < current.meeting.__v) return;
      const serverNow = typeof event.serverNow === "number" ? event.serverNow : Date.now();
      const updated: MeetingLiveSnapshot = {
        ...current,
        meeting: { ...current.meeting, ...event.live, __v: version ?? current.meeting.__v },
        serverNow,
      };
      const received = performance.now();
      latest.current = updated;
      clock.current = { server: serverNow, local: received };
      setNow(serverNow);
      setSyncError("");
      setSnapshot(previous => previous?.meeting._id === meetingId ? updated : previous);
    };
    const offUpdate = socketService.on("meeting_updated", onUpdate);
    const offDraw = socketService.on("lucky_draw_spun", onUpdate);
    const offStatus = socketService.onStatusChange(value => {
      setConnected(value);
      if (value) void refresh();
    });
    const wake = () => {
      if (document.visibilityState !== "hidden") {
        socketService.reconnect();
        void refresh();
      }
    };
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    document.addEventListener("visibilitychange", wake);
    const poll = window.setInterval(() => void refresh(), 5000);
    const tick = window.setInterval(() => setNow(clock.current.server + performance.now() - clock.current.local), 250);
    void refresh();
    return () => {
      disposed = true; mounted.current = false; controller.abort();
      offUpdate(); offDraw(); offStatus();
      window.clearInterval(poll); window.clearInterval(tick);
      window.removeEventListener("online", wake); window.removeEventListener("pageshow", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [meetingId]);

  const refresh = useCallback(() => refreshRef.current(), []);
  const command = useCallback(async (path: string, body: Record<string, unknown>, method = "POST") => {
    if (readOnly || pending.current || !latest.current) return false;
    pending.current = true; setBusy(true); setCommandError("");
    let success = false;
    let responseHasMeeting = false;
    try {
      const result = await meetingLiveApi<unknown>("/" + meetingId + path, method, { ...body, version: latest.current.meeting.__v });
      const returnedMeeting = result && typeof result === "object" ? result as Partial<MeetingLiveSnapshot["meeting"]> : null;
      if (returnedMeeting?._id === meetingId && typeof returnedMeeting.__v === "number" && latest.current) {
        responseHasMeeting = true;
        if (returnedMeeting.__v >= latest.current.meeting.__v) {
          const received = performance.now();
          const serverNow = clock.current.server + (received - clock.current.local);
          const updated: MeetingLiveSnapshot = {
            ...latest.current,
            meeting: { ...latest.current.meeting, ...returnedMeeting },
            serverNow,
          };
          latest.current = updated;
          clock.current = { server: serverNow, local: received };
          setNow(serverNow);
          setSnapshot(updated);
        }
      }
      success = true;
    } catch (error) {
      if (mounted.current) setCommandError(error instanceof MeetingLiveError && error.status === 409
        ? "Cuộc họp vừa thay đổi trên thiết bị khác. Đã yêu cầu đồng bộ lại; hãy kiểm tra trước khi thao tác tiếp."
        : error instanceof MeetingLiveError ? error.message : "Chưa xác nhận được thao tác. Hãy kiểm tra trạng thái sau khi kết nối lại.");
    } finally {
      if (!responseHasMeeting) await refresh();
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
    return success;
  }, [meetingId, readOnly, refresh]);

  return { snapshot: snapshot?.meeting._id === meetingId ? snapshot : null, now, syncError, commandError, connected, busy, refresh, command };
}
