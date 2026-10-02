import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MemberMeetingDetail, { memberAttendance, memberAttendanceLabel } from "../components/meetings/MemberMeetingDetail";
import { SpeechesCompleteDialog } from "../components/meetings/SpeechesCompleteDialog";
import { SlideTransitionDelayInput } from "../components/meetings/SlideTransitionDelayInput";
import { MeetingSlides } from "../components/meetings/MeetingSlides";
import { MeetingCheckInPanel } from "../components/meetings/MeetingCheckInPanel";
import { MeetingLocationFields } from "../components/meetings/MeetingLocationFields";
import { MeetingCoverImageField } from "../components/meetings/MeetingCoverImageField";
import { MeetingDateTimePicker } from "../components/meetings/MeetingDateTimePicker";
import {
  CalendarDays,
  Clock3,
  ImagePlus,
  Megaphone,
  Plus,
  Users,
  Gift,
  Play,
  Pause,
  Square,
  MapPin,
  X,
  Search,
  Pencil,
  Trash2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Trophy,
  Filter,
  RotateCcw,
  ArrowDownToLine,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { socketService } from "../services/socketService";
import { useAuth } from "../context/AuthContext";
import { LuckyDrawTab } from "../components/meetings/LuckyDrawTab";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { toast } from "./Toast";

type Speaker = {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  photoURL?: string;
  coverImage?: string;
  seconds: number;
  spokenSeconds?: number;
  deferred?: boolean;
  checkedInAt?: string;
};

type LuckyDrawWinner = {
  prizeId: string;
  prizeName: string;
  winnerId: string;
  winnerName: string;
  winnerEmail?: string;
  winnerAvatar?: string;
  wonAt: string;
  verificationHash?: string;
  redrawCount?: number;
};

type LuckyDrawPrize = {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  order: number;
  sponsorName?: string;
  sponsorAvatar?: string;
  valueText?: string;
};

type Meeting = {
  _id: string;
  title: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  gpsRadiusMeters?: number;
  checkInQrExpiresAt?: string;
  allowDirectCheckIn?: boolean;
  coverImage?: string;
  startsAt: string;
  reminderDays: number;
  status: "scheduled" | "live" | "paused" | "ended" | "cancelled";
  speakers: Speaker[];
  tiers: Array<{ count: number; seconds: number }>;
  fallbackSeconds: number;
  currentIndex: number;
  speakerStartedAt?: string;
  speechesCompletedAt?: string;
  elapsedSeconds: number;
  __v: number;
  luckyDraw?: {
    enabled: boolean;
    requireCheckIn: boolean;
    allowMultipleWins: boolean;
    animationDurationMs: number;
    prizes: LuckyDrawPrize[];
    winners: LuckyDrawWinner[];
  };
};

const token = () => localStorage.getItem("accessToken") || "";

async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/v1/meetings${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Không thể kết nối máy chủ.");
  return data.data;
}

const fmt = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(Math.max(0, s) % 60)
      .toString()
      .padStart(2, "0")}`;

const dateText = (s: string) => {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return s;
  }
};

export default function MeetingTab() {
  const { hasPermission, userProfile } = useAuth();
  const canManage = hasPermission("meetings:manage") || hasPermission("access:manage");

  const [items, setItems] = useState<Meeting[]>([]);
  const [detailMeetingId, setDetailMeetingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"checkin" | "speakers" | "luckyDraw" | "slides">("checkin");
  const [attendedOnly, setAttendedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "live" | "ended">("all");
  const [tick, setTick] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [finishRequested, setFinishRequested] = useState(false);
  const [dismissedCompletion, setDismissedCompletion] = useState("");
  const [startPresentation, setStartPresentation] = useState(false);
  const [presentationSpeakerId, setPresentationSpeakerId] = useState("");
  const [checkedSpeakerIds, setCheckedSpeakerIds] = useState<string[]>([]);
  const presentationFullscreen = useRef<Promise<boolean> | null>(null);
  const presentationStarted = useCallback(() => setStartPresentation(false), []);
  const presentationClosed = useCallback(() => {
    setStartPresentation(false);
    presentationFullscreen.current = null;
    setActiveSubTab("slides");
  }, []);
  const [prioritySpeakerId, setPrioritySpeakerId] = useState("");
  const [priorityPosition, setPriorityPosition] = useState(1);

  // Fullscreen state for Meeting Detail Modal
  const [isModalFullscreen, setIsModalFullscreen] = useState(false);

  const toggleModalFullscreen = useCallback(() => {
    if (!isModalFullscreen) {
      setIsModalFullscreen(true);
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsModalFullscreen(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isModalFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isModalFullscreen) {
        setIsModalFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isModalFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsModalFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalFullscreen]);

  const handleCloseDetailModal = useCallback(() => {
    if (isModalFullscreen) {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsModalFullscreen(false);
    }
    setDetailMeetingId(null);
  }, [isModalFullscreen]);

  // Create Meeting Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [gpsPoint, setGpsPoint] = useState<{latitude:number;longitude:number}|null>(null);
  const [allowDirectCheckIn, setAllowDirectCheckIn] = useState(false);
  const [editAllowDirectCheckIn, setEditAllowDirectCheckIn] = useState(false);
  const [gpsRadiusMeters, setGpsRadiusMeters] = useState(200);
  const [coverImage, setCoverImage] = useState("");
  const [reminderDays, setReminderDays] = useState(1);
  const [tiers, setTiers] = useState([
    { count: 10, seconds: 30 },
    { count: 10, seconds: 20 },
  ]);
  const [fallbackSeconds, setFallbackSeconds] = useState(20);

  // Edit Meeting Modal state
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editGpsPoint, setEditGpsPoint] = useState<{latitude:number;longitude:number}|null>(null);
  const [editGpsRadiusMeters, setEditGpsRadiusMeters] = useState(200);
  const [editCoverImage, setEditCoverImage] = useState("");
  const [editReminderDays, setEditReminderDays] = useState(1);
  const [editTiers, setEditTiers] = useState<Array<{ count: number; seconds: number }>>([]);
  const [editFallbackSeconds, setEditFallbackSeconds] = useState(20);

  // Delete Meeting Confirmation Dialog state
  const [deletingMeeting, setDeletingMeeting] = useState<Meeting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // End Meeting Confirmation Dialog state
  const [endingMeeting, setEndingMeeting] = useState<Meeting | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  // Start Meeting Confirmation Dialog state
  const [startingMeeting, setStartingMeeting] = useState<Meeting | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Guest Checkin state inside detail modal
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  // Speaker search & filter state inside detail modal
  const [speakerSearch, setSpeakerSearch] = useState("");
  const [speakerTypeFilter, setSpeakerTypeFilter] = useState<"all" | "guest" | "member">("all");

  // Auto-advance speaker and slide when time runs out
  const [autoAdvance, setAutoAdvance] = useState(() => {
    return localStorage.getItem("bni_auto_advance_speaker") === "true";
  });
  const [autoAdvanceDelay, setAutoAdvanceDelay] = useState(() => {
    const saved = localStorage.getItem("bni_auto_advance_delay");
    const parsed = saved === null ? 3 : Number(saved);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
  });
  const updateAutoAdvance = useCallback((enabled: boolean) => {
    setAutoAdvance(enabled);
    localStorage.setItem("bni_auto_advance_speaker", String(enabled));
  }, []);
  const updateAutoAdvanceDelay = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    setAutoAdvanceDelay(seconds);
    localStorage.setItem("bni_auto_advance_delay", String(seconds));
  }, []);
  const autoAdvancedSpeakerRef = useRef<string | null>(null);
  const meetingControlPending = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next: Meeting[] = await api("");
      setItems(next);
      setLoadError("");
    } catch (e: any) {
      setLoadError(e.message || "Không thể tải danh sách cuộc họp");
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => setTick(Date.now()), 250);
    const offMeeting = socketService.on("meeting_updated", () => void refresh());
    const offLucky = socketService.on("lucky_draw_spun", () => void refresh());
    return () => {
      window.clearInterval(timer);
      offMeeting();
      offLucky();
    };
  }, [refresh]);

  const activeMeeting = items.find((m) => m._id === detailMeetingId) || null;
  useEffect(() => {
    setPresentationSpeakerId("");
    setCheckedSpeakerIds([]);
    setSpeakerSearch("");
    setSpeakerTypeFilter("all");
  }, [activeMeeting?._id, activeMeeting?.speakers[activeMeeting.currentIndex]?.id]);

  const speakersWithIndex = useMemo(() => {
    if (!activeMeeting?.speakers) return [];
    return activeMeeting.speakers.map((s, idx) => ({ ...s, originalIndex: idx }));
  }, [activeMeeting?.speakers]);

  const filteredSpeakers = useMemo(() => {
    let list = speakersWithIndex;
    if (speakerTypeFilter === "guest") {
      list = list.filter((s) => !s.userId);
    } else if (speakerTypeFilter === "member") {
      list = list.filter((s) => Boolean(s.userId));
    }

    const q = speakerSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [speakersWithIndex, speakerTypeFilter, speakerSearch]);

  const guestSpeakerCount = useMemo(() => {
    return activeMeeting?.speakers.filter((s) => !s.userId).length || 0;
  }, [activeMeeting?.speakers]);

  const memberSpeakerCount = useMemo(() => {
    return activeMeeting?.speakers.filter((s) => Boolean(s.userId)).length || 0;
  }, [activeMeeting?.speakers]);

  const completionKey = activeMeeting?.speechesCompletedAt && ["live", "paused"].includes(activeMeeting.status)
    ? activeMeeting._id + ":" + activeMeeting.speechesCompletedAt : "";
  const dismissCompletion = useCallback(() => setDismissedCompletion(completionKey), [completionKey]);

  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Thao tác thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const result = await api("", "POST", {
        title,
        startsAt: new Date(startsAt).toISOString(),
        location,
        ...(gpsPoint || {}),
        gpsRadiusMeters,
        allowDirectCheckIn,
        coverImage,
        reminderDays,
        tiers,
        fallbackSeconds,
      });
      setTitle("");
      setStartsAt("");
      setLocation("");
      setGpsPoint(null);
      setAllowDirectCheckIn(false);
      setCoverImage("");
      setShowCreateModal(false);
      toast.success("Tạo cuộc họp mới thành công!");
      setDetailMeetingId(result._id);
      setActiveSubTab("checkin");
    });
  };

  const openEditModal = (m: Meeting, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingMeeting(m);
    setPrioritySpeakerId("");
    setPriorityPosition(1);
    setEditTitle(m.title);
    setEditAllowDirectCheckIn(m.allowDirectCheckIn === true);
    setEditLocation(m.location || "");
    setEditGpsPoint(typeof m.latitude === "number" && typeof m.longitude === "number" ? { latitude: m.latitude, longitude: m.longitude } : null);
    setEditGpsRadiusMeters(m.gpsRadiusMeters || 200);
    setEditCoverImage(m.coverImage || "");
    setEditReminderDays(m.reminderDays ?? 1);
    setEditTiers(
      m.tiers?.length
        ? m.tiers.map((t) => ({ ...t }))
        : [
          { count: 10, seconds: 30 },
          { count: 10, seconds: 20 },
        ]
    );
    setEditFallbackSeconds(m.fallbackSeconds || 20);

    // Format startsAt for datetime-local
    try {
      const d = new Date(m.startsAt);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      setEditStartsAt(localISOTime);
    } catch {
      setEditStartsAt("");
    }
  };

  const update = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;
    void run(async () => {
      await api(`/${editingMeeting._id}`, "PUT", {
        title: editTitle,
        startsAt: new Date(editStartsAt).toISOString(),
        location: editLocation,
        latitude: editGpsPoint?.latitude ?? null,
        longitude: editGpsPoint?.longitude ?? null,
        gpsRadiusMeters: editGpsRadiusMeters,
        allowDirectCheckIn: editAllowDirectCheckIn,
        coverImage: editCoverImage,
        reminderDays: editReminderDays,
        tiers: editTiers,
        fallbackSeconds: editFallbackSeconds,
      });
      setEditingMeeting(null);
      toast.success("Cập nhật cuộc họp thành công!");
    });
  };

  const handleDelete = async () => {
    if (!deletingMeeting) return;
    setIsDeleting(true);
    try {
      await api(`/${deletingMeeting._id}`, "DELETE");
      toast.success("Đã xóa cuộc họp thành công!");
      if (detailMeetingId === deletingMeeting._id) {
        setDetailMeetingId(null);
      }
      setDeletingMeeting(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Không thể xóa cuộc họp.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEndMeeting = async () => {
    if (!endingMeeting) return;
    setIsEnding(true);
    try {
      await api(`/${endingMeeting._id}/control`, "POST", { action: "finish", version: endingMeeting.__v });
      toast.success(`Buổi họp "${endingMeeting.title}" đã kết thúc!`);
      if (detailMeetingId === endingMeeting._id) {
        setDetailMeetingId(null);
      }
      setEndingMeeting(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Không thể kết thúc cuộc họp.");
    } finally {
      setIsEnding(false);
    }
  };

  const handleStartMeeting = async () => {
    if (!startingMeeting) return;
    setIsStarting(true);
    try {
      await api(`/${startingMeeting._id}/control`, "POST", { action: "start", version: startingMeeting.__v });
      toast.success(`Buổi họp "${startingMeeting.title}" đã bắt đầu!`);
      setStartingMeeting(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Không thể bắt đầu cuộc họp.");
    } finally {
      setIsStarting(false);
    }
  };

  const addGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMeeting) return;
    void run(async () => {
      await api(`/${activeMeeting._id}/checkin`, "POST", { name: guestName, email: guestEmail });
      toast.success(`Đã check-in cho khách mời "${guestName}"`);
      setGuestName("");
      setGuestEmail("");
    });
  };

  const requestMeetingControl = async (action: string): Promise<void> => {
    if (!activeMeeting || !canManage || meetingControlPending.current) return;
    meetingControlPending.current = true;
    setSaving(true);
    try {
      const updated: Meeting = await api(`/${activeMeeting._id}/control`, "POST", { action, version: activeMeeting.__v });
      setItems(previous => previous.map(item => item._id === updated._id ? updated : item));
    } finally {
      meetingControlPending.current = false;
      setSaving(false);
    }
  };

  const deferSpeaker = async (speakerId: string | string[]): Promise<void> => {
    if (!activeMeeting || !canManage || meetingControlPending.current) return;
    meetingControlPending.current = true;
    setSaving(true);
    try {
      const updated: Meeting = await api(`/${activeMeeting._id}/defer`, "POST", { ...(Array.isArray(speakerId) ? { speakerIds: speakerId } : { speakerId }), version: activeMeeting.__v });
      setItems(previous => previous.map(item => item._id === updated._id ? updated : item));
      setPresentationSpeakerId("");
      setCheckedSpeakerIds([]);
    } finally {
      meetingControlPending.current = false;
      setSaving(false);
    }
  };

  const control = async (action: string): Promise<void> => {
    if (!activeMeeting) return;
    const actionLabels: Record<string, string> = {
      start: "Bắt đầu cuộc họp",
      start_speaker: "Bắt đầu tính giờ phát biểu",
      reset_speaker: "Đã đặt lại thời gian phát biểu",
      pause: "Tạm dừng phát biểu",
      resume: "Tiếp tục cuộc họp",
      next: "Chuyển người tiếp theo",
      finish: "Kết thúc cuộc họp",
    };
    await run(async () => {
      await requestMeetingControl(action);
      toast.success(actionLabels[action] || "Cập nhật trạng thái thành công");
    });
  };

  const orderingMeeting = editingMeeting ? items.find(m => m._id === editingMeeting._id) || editingMeeting : null;
  const pendingStart = !orderingMeeting || orderingMeeting.status === "scheduled" ? 0 : Math.max(0,
    orderingMeeting.currentIndex + (orderingMeeting.speakerStartedAt || orderingMeeting.elapsedSeconds > 0 ? 1 : 0));

  const reorder = (index: number, delta: number) => {
    if (!orderingMeeting) return;
    const copy = [...orderingMeeting.speakers];
    const next = index + delta;
    if (saving || index < pendingStart || next < pendingStart || next >= copy.length) return;
    const [person] = copy.splice(index, 1);
    copy.splice(next, 0, person);
    void run(() =>
      api(`/${orderingMeeting._id}/order`, "PUT", { version: orderingMeeting.__v, speakerIds: copy.map((s) => s.id) })
    );
  };

  const startPresentationTimer = useCallback(async (speakerId: string) => {
    if (!activeMeeting || !canManage || meetingControlPending.current) return;
    meetingControlPending.current = true;
    setSaving(true);
    try {
      const updated: Meeting = await api('/' + activeMeeting._id + '/presentation', 'POST', { speakerId, version: activeMeeting.__v });
      setItems(previous => previous.map(item => item._id === updated._id ? updated : item));
    } finally {
      meetingControlPending.current = false;
      setSaving(false);
    }
  }, [activeMeeting, canManage]);

  const current = activeMeeting && ["live", "paused"].includes(activeMeeting.status) ? activeMeeting.speakers[activeMeeting.currentIndex] : undefined;
  const upcoming = activeMeeting && !["ended", "cancelled"].includes(activeMeeting.status) ? activeMeeting.speakers[activeMeeting.status === "scheduled" ? 0 : activeMeeting.currentIndex + 1] : undefined;
  const elapsed = activeMeeting
    ? activeMeeting.elapsedSeconds +
    (activeMeeting.status === "live" && activeMeeting.speakerStartedAt
      ? Math.max(0, (tick - new Date(activeMeeting.speakerStartedAt).getTime()) / 1000)
      : 0)
    : 0;
  const remaining = current ? current.seconds - elapsed : 0;

  // Auto-advance to next speaker and slide when time expires + delay
  useEffect(() => {
    if (!autoAdvance || !canManage || saving) return;
    if (!activeMeeting || activeMeeting.status !== "live" || !activeMeeting.speakerStartedAt) return;
    if (!current) return;

    if (remaining <= 0) {
      const overtime = Math.abs(remaining);
      if (overtime >= autoAdvanceDelay) {
        const speakerKey = `${activeMeeting._id}_${current.id}_${activeMeeting.speakerStartedAt}_${activeMeeting.__v}`;
        if (autoAdvancedSpeakerRef.current !== speakerKey) {
          autoAdvancedSpeakerRef.current = speakerKey;
          void run(async () => {
            await requestMeetingControl("next");
            toast.success(upcoming ? `Hết giờ! Đã tự động chuyển sang: ${upcoming.name}` : "Đã hoàn tất phần phát biểu.");
          });
        }
      }
    }
  }, [tick, autoAdvance, autoAdvanceDelay, canManage, saving, activeMeeting, current, upcoming, remaining]);

  const statusMap: Record<string, { label: string; badge: string; dot: string; border: string }> = {
    scheduled: {
      label: "Sắp diễn ra",
      badge: "bg-amber-50 text-amber-700 border-amber-200/70",
      dot: "bg-amber-500",
      border: "border-amber-200 hover:border-amber-300",
    },
    live: {
      label: "Đang diễn ra",
      badge: "bg-green-50 text-green-700 border-green-300",
      dot: "bg-green-500 animate-pulse",
      border: "border-green-400 hover:border-green-500 shadow-green-500/15",
    },
    paused: {
      label: "Đang diễn ra",
      badge: "bg-green-50 text-green-700 border-green-300",
      dot: "bg-green-500 animate-pulse",
      border: "border-green-400 hover:border-green-500 shadow-green-500/15",
    },
    ended: {
      label: "Đã kết thúc",
      badge: "bg-slate-100 text-slate-600 border-slate-200",
      dot: "bg-slate-400",
      border: "border-slate-200 hover:border-slate-300",
    },
    cancelled: {
      label: "Đã hủy",
      badge: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
      border: "border-rose-200 hover:border-rose-300",
    },
  };

  const getLiveElapsedMinutes = (startsAt: string | Date): number => {
    const startTime = new Date(startsAt).getTime();
    const diffMs = tick - startTime;
    if (diffMs <= 0) return 1;
    return Math.floor(diffMs / 60000);
  };

  const filteredItems = items.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.location && m.location.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (!canManage && attendedOnly && !memberAttendance(m, userProfile?.uid)) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "scheduled") return m.status === "scheduled";
    if (statusFilter === "live") return m.status === "live" || m.status === "paused";
    if (statusFilter === "ended") return m.status === "ended" || m.status === "cancelled";
    return true;
  });

  return (
    <div className="@container w-full max-h-[85vh] overflow-y-auto px-0.5 pb-5 text-left sm:pr-2" id="meeting_tab_view">
      {/* Header bar */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-600 to-teal-700 rounded-2xl shadow-sm text-white shrink-0">
              <CalendarDays className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-xl md:text-2xl tracking-tight">
                {canManage ? "Quản lý buổi họp" : "Cuộc họp"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {canManage ? "Lên lịch → Đón tiếp & check-in → Điều hành phát biểu → Quay thưởng" : "Theo dõi lịch họp và thông tin tham dự của bạn"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">


            {canManage && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm shadow-cyan-600/20 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo cuộc họp mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar: Search + Status Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 select-none">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "all"
                ? "bg-cyan-600 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              Tất cả ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("live")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "live"
                ? "bg-green-600 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Đang diễn ra ({items.filter((m) => m.status === "live" || m.status === "paused").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("scheduled")}
              className={`px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "scheduled"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              Sắp diễn ra ({items.filter((m) => m.status === "scheduled").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ended")}
              className={`px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "ended"
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              Đã kết thúc ({items.filter((m) => m.status === "ended" || m.status === "cancelled").length})
            </button>
          </div>

          {!canManage && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={attendedOnly} onChange={event => setAttendedOnly(event.target.checked)} />Chỉ buổi đã check-in</label>}
          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên cuộc họp, địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Grid of Meeting Cards (Dạng danh sách / Thẻ hiển thị) */}
      {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải cuộc họp...</p> : loadError ? <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{loadError}<button type="button" onClick={() => { setLoading(true); void refresh(); }} className="ml-3 font-bold">Thử lại</button></div> : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 @min-[32rem]:grid-cols-2 @min-[48rem]:grid-cols-3 @min-[64rem]:grid-cols-4 gap-3">
          {filteredItems.map((m) => {
            const s = statusMap[m.status] || {
              label: m.status,
              badge: "bg-slate-100 text-slate-600 border-slate-200",
              dot: "bg-slate-400",
              border: "border-slate-200",
            };
            const prizeCount = m.luckyDraw?.prizes?.length || 0;
            const winnerCount = m.luckyDraw?.winners?.length || 0;
            const isLive = m.status === "live" || m.status === "paused";

            return (
              <div
                key={m._id}
                onClick={() => {
                  setDetailMeetingId(m._id);
                  setActiveSubTab(m.status === "scheduled" ? "checkin" : "speakers");
                }}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-white shadow-2xs transition-all duration-200 hover:shadow-md cursor-pointer ${s.border}`}
              >
                {/* Top Cover / Header Image */}
                <div className="relative h-24 w-full overflow-hidden bg-slate-100">
                  {m.coverImage ? (
                    <>
                      <img
                        src={m.coverImage}
                        alt={m.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-black/20" />
                    </>
                  ) : (
                    <div className="relative h-full w-full bg-gradient-to-br from-slate-50 via-slate-100/70 to-slate-200/50 p-3 flex items-center justify-end overflow-hidden border-b border-slate-200/60">
                      {/* Subtle elegant neutral accents */}
                      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-slate-200/60 blur-md pointer-events-none" />
                      <div className="absolute -left-6 -bottom-6 h-20 w-28 rounded-full bg-slate-200/40 blur-sm pointer-events-none" />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none">
                        <CalendarDays className="h-16 w-16 text-slate-400 rotate-12 transition-transform duration-300 group-hover:scale-110" />
                      </div>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2 left-2">
                    {m.status === "live" || m.status === "paused" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border border-green-300 bg-green-50/95 text-green-700 shadow-xs backdrop-blur-xs">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-80"
                            style={{ backgroundColor: "#4ade80" }}
                          />
                          <span
                            className="relative inline-flex rounded-full h-2 w-2"
                            style={{ backgroundColor: "#16a34a" }}
                          />
                        </span>
                        <span className="animate-pulse tracking-tight font-extrabold text-green-700">
                          Đang diễn ra {getLiveElapsedMinutes(m.startsAt)} phút
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold border backdrop-blur-md ${s.badge}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    )}
                  </div>

                  {/* Top Action Icons (Sửa, Xóa) */}
                  {canManage && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title="Sửa cuộc họp"
                        onClick={(e) => openEditModal(m, e)}
                        className="rounded-lg bg-white/90 backdrop-blur-md p-1.5 text-slate-700 hover:bg-white hover:text-cyan-700 shadow-sm border border-slate-200/60 transition cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Xóa cuộc họp"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingMeeting(m);
                        }}
                        className="rounded-lg bg-white/90 backdrop-blur-md p-1.5 text-slate-700 hover:bg-rose-50 hover:text-rose-600 shadow-sm border border-slate-200/60 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Time preview on image bottom */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center gap-1.5 text-xs">
                    {m.coverImage ? (
                      <div className="flex items-center gap-1.5 text-white/95 font-medium drop-shadow-sm">
                        <Clock3 className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                        <span className="truncate">{dateText(m.startsAt)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-600 font-semibold drop-shadow-xs">
                        <Clock3 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{dateText(m.startsAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-cyan-700 transition">
                      {m.title}
                    </h3>

                    {m.location && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 line-clamp-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate" title={m.location}>{m.location}</span>
                      </p>
                    )}
                  </div>

                  {!canManage && <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800">{memberAttendanceLabel(m, userProfile?.uid)}</p>}
                  {/* Stats Bar */}
                  {canManage && <div className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Users className="h-4 w-4 text-cyan-600 shrink-0" />
                      <span>{m.speakers?.length || 0} check-in</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-amber-600 font-medium justify-end">
                      <Gift className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>
                        {winnerCount > 0 ? `${winnerCount} đã trúng` : `${prizeCount} giải quay`}
                      </span>
                    </div>
                  </div>}
                </div>

                {/* Card Footer: Action Button */}
                <div className="px-3 pb-3 pt-0 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={!canManage ? "Xem chi tiết cuộc họp" : isLive ? "Tiếp tục điều hành" : m.status === "scheduled" ? "Mở buổi họp & check-in" : "Xem buổi họp"}
                    onClick={(event) => { event.stopPropagation(); setDetailMeetingId(m._id); setActiveSubTab(m.status === "scheduled" ? "checkin" : "speakers"); }}
                    className="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 group-hover:bg-cyan-600 text-slate-700 group-hover:text-white px-3 py-2 text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap"
                  >
                    <span className="truncate">{!canManage ? "Xem chi tiết" : isLive ? "Điều hành" : m.status === "scheduled" ? "Check-in" : "Xem cuộc họp"}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  {canManage && m.status === "scheduled" && (
                    <button
                      type="button"
                      title="Bắt đầu cuộc họp ngay"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStartingMeeting(m);
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white px-3 py-2 text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Bắt đầu</span>
                    </button>
                  )}

                  {canManage && isLive && (
                    <button
                      type="button"
                      title="Kết thúc buổi họp"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEndingMeeting(m);
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 shrink-0 border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Kết thúc</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <CalendarDays className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-700">Chưa tìm thấy cuộc họp nào</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {canManage ? "Không có cuộc họp nào phù hợp với bộ lọc hiện tại. Bấm nút bên dưới để tạo cuộc họp mới." : "Chưa có cuộc họp phù hợp. Bạn có thể đổi bộ lọc để xem các buổi họp khác."}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Tạo cuộc họp mới
            </button>
          )}
        </div>
      )}

      {/* POPUP CHI TIẾT CUỘC HỌP (Meeting Detail Modal) */}
      {!canManage && activeMeeting && <MemberMeetingDetail key={activeMeeting._id} onCheckIn={async (location) => { const updated = await api("/" + activeMeeting._id + "/checkin", "POST", location); setItems(previous => previous.map(item => item._id === updated._id ? updated : item)); }} meeting={activeMeeting} userId={userProfile?.uid} onClose={() => setDetailMeetingId(null)} />}
      {canManage && activeMeeting && (
        <div className={`fixed inset-0 z-50 ${isModalFullscreen ? "bg-slate-900 overflow-hidden" : "flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"}`}>
          <div className={`${isModalFullscreen ? "w-full h-full max-w-none max-h-none rounded-none border-0" : "w-full max-w-6xl max-h-[94vh] rounded-3xl border border-slate-200 shadow-2xl"} flex flex-col bg-slate-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}>
            {/* Modal Top Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-5 py-3.5 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-cyan-50 text-cyan-700 rounded-xl shrink-0">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-slate-900 text-base sm:text-lg truncate">
                      {activeMeeting.title}
                    </h2>
                    {activeMeeting.status === "live" || activeMeeting.status === "paused" ? (
                      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border border-green-400 bg-green-50 text-green-700 shadow-xs shrink-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-80" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        <span className="animate-pulse text-green-600 font-bold">
                          Đang diễn ra {getLiveElapsedMinutes(activeMeeting.startsAt)} phút
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0 ${statusMap[activeMeeting.status]?.badge || "bg-slate-100 text-slate-600"
                          }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusMap[activeMeeting.status]?.dot}`} />
                        {statusMap[activeMeeting.status]?.label || activeMeeting.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3 w-3 text-slate-400" />
                      {dateText(activeMeeting.startsAt)}
                    </span>
                    {activeMeeting.location && (
                      <span className="hidden md:flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {activeMeeting.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sub-tab Switcher & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <div className="flex overflow-x-auto bg-slate-100 p-1 rounded-xl">
                  <button type="button" onClick={() => setActiveSubTab("slides")} aria-pressed={activeSubTab === "slides"} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 aria-pressed:bg-white aria-pressed:text-cyan-700 aria-pressed:font-semibold">Thuyết trình</button>
                  <button type="button" onClick={() => setActiveSubTab("checkin")} aria-pressed={activeSubTab === "checkin"} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 aria-pressed:bg-white aria-pressed:text-cyan-700 aria-pressed:font-semibold">Check-in ({activeMeeting.speakers.length})</button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("speakers")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition cursor-pointer ${activeSubTab === "speakers"
                      ? "bg-white text-cyan-700 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                      }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Điều hành</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab("luckyDraw")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition cursor-pointer ${activeSubTab === "luckyDraw"
                      ? "bg-cyan-600 text-white shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                      }`}
                  >
                    <Gift className="h-3.5 w-3.5" />
                    <span>Quay thưởng</span>
                    {activeMeeting.luckyDraw?.winners?.length ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400 text-slate-900 font-extrabold">
                        {activeMeeting.luckyDraw.winners.length}
                      </span>
                    ) : null}
                  </button>
                </div>

                {canManage && (
                  <button
                    type="button"
                    title="Sửa cuộc họp"
                    onClick={(e) => openEditModal(activeMeeting, e)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}

                {isModalFullscreen ? (
                  <>
                    <button
                      type="button"
                      title="Thoát toàn màn hình (Esc)"
                      onClick={toggleModalFullscreen}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer shrink-0"
                    >
                      <Minimize2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Thu nhỏ</span>
                    </button>
                    <button
                      type="button"
                      title="Thoát toàn màn hình (Esc)"
                      onClick={toggleModalFullscreen}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      title="Toàn màn hình"
                      onClick={toggleModalFullscreen}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer shrink-0"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      title="Đóng popup"
                      onClick={handleCloseDetailModal}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer shrink-0"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {activeSubTab === "slides" && (
                <MeetingSlides
                  key={activeMeeting._id}
                  meeting={activeMeeting}
                  canManage={canManage}
                  api={api}
                  startFromFirst={startPresentation}
                  initialSpeakerId={presentationSpeakerId}
                  onDeferSpeaker={deferSpeaker}
                  onPresentationStarted={presentationStarted}
                  onPresentationClosed={presentationClosed}
                  onStartPresentation={canManage ? startPresentationTimer : undefined}
                  onMoveSpeaker={direction => requestMeetingControl(direction > 0 ? "next" : "previous")}
                  onTogglePause={() => control(activeMeeting.status === "paused" ? "resume" : "pause")}
                  controlBusy={saving}
                  autoAdvance={autoAdvance}
                  autoAdvanceDelay={autoAdvanceDelay}
                  onAutoAdvanceChange={updateAutoAdvance}
                  onAutoAdvanceDelayChange={updateAutoAdvanceDelay}
                  fullscreenRequest={presentationFullscreen.current}
                />
              )}
              {/* SUBTAB 1: DIỄN GIẢ & ĐIỀU PHỐI BUỔI HỌP */}
              {(activeSubTab === "speakers" || activeSubTab === "checkin") && (
                <div className="space-y-4">
                  {activeSubTab === "speakers" && (<>
                  {/* Meeting Hero Banner Card */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                    {activeMeeting.coverImage ? (
                      <div className="relative h-36 md:h-44 w-full overflow-hidden bg-slate-100">
                        <img src={activeMeeting.coverImage} alt="Cover" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
                        <div className="absolute bottom-4 left-5 right-5 text-white">
                          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200">
                            <Clock3 className="h-3.5 w-3.5" />
                            <span>{dateText(activeMeeting.startsAt)}</span>
                            {activeMeeting.location && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" /> {activeMeeting.location}
                                </span>
                              </>
                            )}
                          </div>
                          <h2 className="mt-1 text-xl md:text-2xl font-semibold text-white">{activeMeeting.title}</h2>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700">
                          <Clock3 className="h-3.5 w-3.5 text-cyan-600" />
                          <span>{dateText(activeMeeting.startsAt)}</span>
                          {activeMeeting.location && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-slate-500">
                                <MapPin className="h-3.5 w-3.5" /> {activeMeeting.location}
                              </span>
                            </>
                          )}
                        </div>
                        <h2 className="mt-1 text-xl font-semibold text-slate-800">{activeMeeting.title}</h2>
                      </div>
                    )}

                    {/* Meeting Actions & Status Bar */}
                    <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-white">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium border ${statusMap[activeMeeting.status]?.badge || "bg-slate-100 text-slate-600"
                            }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${statusMap[activeMeeting.status]?.dot}`} />
                          {statusMap[activeMeeting.status]?.label || activeMeeting.status}
                        </span>

                        <span className="text-xs text-slate-500 font-medium">
                          • {activeMeeting.speakers.length} người tham gia ({activeMeeting.speakers.filter((s) => s.userId).length} thành viên, {activeMeeting.speakers.filter((s) => !s.userId).length} khách mời)
                        </span>
                      </div>

                      {/* Operation Control Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" disabled={saving || !activeMeeting.speakers.length}
                          onClick={() => {
                            const targetSpeakerId = (checkedSpeakerIds.length > 0 ? checkedSpeakerIds[checkedSpeakerIds.length - 1] : presentationSpeakerId) || "";
                            if (targetSpeakerId) setPresentationSpeakerId(targetSpeakerId);
                            presentationFullscreen.current = document.documentElement.requestFullscreen && !document.fullscreenElement
                              ? document.documentElement.requestFullscreen().then(() => true).catch(() => false)
                              : null;
                            setStartPresentation(true); setActiveSubTab("slides");
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-cyan-800 transition cursor-pointer">
                          <Play className="h-3.5 w-3.5" /> Bắt đầu thuyết trình
                        </button>
                  {canManage && activeMeeting.status === "scheduled" && (
                    <button
                      type="button"
                      onClick={() => setStartingMeeting(activeMeeting)}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-medium shadow-sm shadow-emerald-600/20 transition cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" fill="currentColor" />
                      Bắt đầu cuộc họp
                    </button>
                  )}

                        {canManage && activeMeeting.status === "live" && (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => control("pause")}
                              className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 px-3.5 py-2 text-xs font-medium transition cursor-pointer"
                            >
                              <Pause className="h-3.5 w-3.5" />
                              Tạm dừng
                            </button>

                            <button
                              type="button"
                              disabled={saving || !current}
                              onClick={() => control("next")}
                              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 text-xs font-medium shadow-sm shadow-cyan-600/20 transition cursor-pointer"
                            >
                              {upcoming ? "Người tiếp theo ❯" : "Hoàn tất phát biểu"}
                            </button>

                            {autoAdvance && (
                              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200/80 text-[11px] font-medium text-cyan-700">
                                <Sparkles className="h-3 w-3 text-cyan-600" />
                                Hết giờ → chờ {autoAdvanceDelay}s → chuyển người & slide
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => setFinishRequested(true)}
                              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 text-xs font-medium transition cursor-pointer"
                            >
                              <Square className="h-3 w-3" fill="currentColor" />
                              Kết thúc
                            </button>
                          </>
                        )}

                        {canManage && activeMeeting.status === "paused" && (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => control("resume")}
                              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-medium shadow-sm transition cursor-pointer"
                            >
                              <Play className="h-3.5 w-3.5" fill="currentColor" />
                              Tiếp tục
                            </button>

                            <button
                              type="button"
                              disabled={saving || !current}
                              onClick={() => control("next")}
                              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 text-xs font-medium transition cursor-pointer"
                            >
                              {upcoming ? "Người tiếp theo ❯" : "Hoàn tất phát biểu"}
                            </button>
                            <button type="button" disabled={saving} onClick={() => setFinishRequested(true)} className="rounded-xl bg-slate-800 hover:bg-slate-900 px-4 py-2 text-xs font-medium text-white transition cursor-pointer">Kết thúc</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {activeMeeting.status === "scheduled" && <p className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-900">Kiểm tra danh sách và thứ tự bên dưới, sau đó bấm Bắt đầu cuộc họp. Có thể tiếp tục nhận check-in khi đang họp.</p>}
                  {["ended", "cancelled"].includes(activeMeeting.status) && <p className="rounded-xl bg-slate-100 p-4 text-sm">Buổi họp đã đóng. Danh sách tham dự được giữ lại bên dưới.</p>}
                  {/* Current & Upcoming Speakers side by side */}
                  {!["ended", "cancelled"].includes(activeMeeting.status) && <div className="grid gap-4 sm:grid-cols-2">
                    {/* Current Speaker Card */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                          <Megaphone className="h-4 w-4 text-cyan-600" />
                          Diễn giả hiện tại
                        </span>
                        {current && (
                          <span className="text-[11px] font-mono text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md font-medium">
                            {fmt(current.seconds)} mục tiêu
                          </span>
                        )}
                      </div>

                      {current ? (
                        <div className="my-4 flex items-center gap-4">
                          {current.photoURL ? (
                            <img
                              src={current.photoURL}
                              alt={current.name}
                              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-cyan-500/30"
                            />
                          ) : (
                            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cyan-50 font-semibold text-cyan-700 text-xl">
                              {current.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-base text-slate-800">{current.name}</h3>
                            <p className="truncate text-xs text-slate-500">{current.email || "Khách mời"}</p>
                            <span className="mt-1 inline-block text-[11px] font-medium text-cyan-600 bg-cyan-50/80 px-2 py-0.5 rounded-md">
                              Lượt thứ {activeMeeting.currentIndex + 1} / {activeMeeting.speakers.length}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">
                          {activeMeeting.speechesCompletedAt ? "Phần phát biểu đã hoàn tất. Cuộc họp vẫn đang tiếp tục." : "Chưa có diễn giả nào đang phát biểu."}
                        </div>
                      )}

                      {/* Timer Display */}
                      <div className="space-y-2.5 mt-2">
                        {current && <div className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${remaining <= 0 ? "bg-rose-50 border-rose-200" : "bg-cyan-50/70 border-cyan-100"}`}>
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-slate-600">
                              {remaining <= 0 ? "Thời lượng phát biểu" : !activeMeeting.speakerStartedAt && !activeMeeting.elapsedSeconds ? "Sẵn sàng" : activeMeeting.status === "paused" ? "Tạm dừng" : "Thời gian còn lại"}
                            </span>
                            {autoAdvance && remaining <= 0 && <p className="text-xs text-amber-800">
                              {upcoming ? "Chuyển người tiếp theo" : "Hoàn tất phát biểu"} sau {Math.max(0, Math.ceil(autoAdvanceDelay - Math.abs(remaining)))}s
                            </p>}
                          </div>
                          <span className={`font-mono text-2xl font-semibold ${remaining <= 0 ? "text-rose-600" : "text-slate-800"}`}>
                            {remaining <= 0 ? "Hết giờ" : fmt(remaining)}
                          </span>
                        </div>}

                        {/* Speaker Timer Actions */}
                        {canManage && current && ["live", "paused"].includes(activeMeeting.status) && (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/80">
                            <span className="text-[11px] text-slate-400">
                              {!activeMeeting.speakerStartedAt && (activeMeeting.elapsedSeconds || 0) === 0
                                ? "Bấm để bắt đầu đếm ngược"
                                : `Mục tiêu: ${current.seconds} giây`}
                            </span>

                            <div className="flex items-center gap-2">
                              {!activeMeeting.speakerStartedAt && (activeMeeting.elapsedSeconds || 0) === 0 ? (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => control("start_speaker")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs transition cursor-pointer"
                                >
                                  <Play className="h-3.5 w-3.5" fill="currentColor" />
                                  <span>Bắt đầu tính giờ ({current.seconds}s)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => control("start_speaker")}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
                                  title="Bấm giờ lại từ đầu cho diễn giả này"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Bấm giờ lại ({current.seconds}s)</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Auto-Advance Setting Box */}
                        {canManage && ["scheduled", "live", "paused"].includes(activeMeeting.status) && (
                          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs">
                            <label className="flex items-center gap-2 font-medium text-slate-700">Chế độ
                              <select aria-label="Chế độ điều hành" value={autoAdvance ? "auto" : "manual"} disabled={saving} onChange={e => updateAutoAdvance(e.target.value === "auto")} className="rounded-lg border border-slate-300 bg-white p-2">
                                <option value="manual">Thủ công</option><option value="auto">Tự động</option>
                              </select>
                            </label>

                            {autoAdvance && (
                              <div className="flex items-center gap-1.5 ml-auto">
                                <span className="text-slate-500 font-medium">Thời gian chuyển slide:</span>
                                <SlideTransitionDelayInput value={autoAdvanceDelay} onChange={updateAutoAdvanceDelay} />
                                <span className="text-slate-500 font-medium">giây</span>
                              </div>
                            )}
                            {autoAdvance && <p className="w-full text-xs text-slate-500">Khi hết thời gian phát biểu, chờ {autoAdvanceDelay} giây rồi chuyển người và slide. Đây là thời gian chờ chuyển lượt, không phải thời lượng phát biểu.</p>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upcoming Speaker Card */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          Diễn giả tiếp theo
                        </span>
                        {upcoming && (
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md font-medium">
                            {fmt(upcoming.seconds)}
                          </span>
                        )}
                      </div>

                      {upcoming ? (
                        <div className="my-4 flex items-center gap-4">
                          {upcoming.photoURL ? (
                            <img
                              src={upcoming.photoURL}
                              alt={upcoming.name}
                              className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-50 font-semibold text-slate-500 text-xl">
                              {upcoming.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-base text-slate-800">{upcoming.name}</h3>
                            <p className="truncate text-xs text-slate-500">{upcoming.email || "Khách mời"}</p>
                            <span className="mt-1 inline-block text-[11px] font-medium text-slate-500">
                              Hãy chuẩn bị tài liệu và micro!
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">
                          {activeMeeting.speakers.length > 0
                            ? "Đã là người phát biểu cuối cùng."
                            : "Chưa có danh sách diễn giả."}
                        </div>
                      )}

                      <div className="rounded-xl bg-slate-50 p-3.5 flex items-center justify-between text-xs text-slate-500">
                        <span>Tổng số người check-in:</span>
                        <span className="font-semibold text-slate-700">{activeMeeting.speakers.length} người</span>
                      </div>
                    </div>
                  </div>}

                  </>)}
                  {activeSubTab === "checkin" && <MeetingCheckInPanel key={activeMeeting._id} meeting={activeMeeting} canManage={canManage} api={api} onRefresh={refresh} onConfigure={() => openEditModal(activeMeeting)} onOperate={() => setActiveSubTab("speakers")} />}
                  {/* Guest Checkin Form (MC / Admin) */}
                  {canManage && (activeSubTab === "checkin" || activeSubTab === "speakers") && ["scheduled", "live", "paused"].includes(activeMeeting.status) && (
                    <form
                      onSubmit={addGuest}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-wrap items-center gap-3"
                    >
                      <span className="font-medium text-xs text-slate-600 shrink-0">MC ghi nhận khách tại chỗ:</span>
                      <input
                        required
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Họ tên khách mời..."
                        className="min-w-36 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500 focus:outline-none"
                      />
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="Email khách mời..."
                        className="min-w-44 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!canManage || saving}
                        title={!canManage ? "Chỉ MC/Admin có quyền check-in khách mời" : ""}
                        className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 text-xs font-medium transition cursor-pointer disabled:opacity-40"
                      >
                        Check-in khách
                      </button>
                    </form>
                  )}

                  {/* Speakers Queue Table */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
                    <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-cyan-600" />
                        <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-600">
                          {activeSubTab === "checkin" ? "Người đã check-in · thứ tự phát biểu" : "Danh sách thuyết trình"} ({filteredSpeakers.length}{filteredSpeakers.length !== activeMeeting.speakers.length ? `/${activeMeeting.speakers.length}` : ""})
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Quick filter pills */}
                        <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
                          <button
                            type="button"
                            onClick={() => setSpeakerTypeFilter("all")}
                            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                              speakerTypeFilter === "all"
                                ? "bg-white text-slate-800 font-semibold shadow-2xs"
                                : "hover:text-slate-900"
                            }`}
                          >
                            Tất cả ({activeMeeting.speakers.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSpeakerTypeFilter("guest")}
                            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                              speakerTypeFilter === "guest"
                                ? "bg-cyan-600 text-white font-semibold shadow-2xs"
                                : "hover:text-cyan-700 text-slate-600"
                            }`}
                          >
                            Khách mời ({guestSpeakerCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSpeakerTypeFilter("member")}
                            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                              speakerTypeFilter === "member"
                                ? "bg-cyan-600 text-white font-semibold shadow-2xs"
                                : "hover:text-cyan-700 text-slate-600"
                            }`}
                          >
                            Thành viên ({memberSpeakerCount})
                          </button>
                        </div>

                        {/* Search input with clear button */}
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Tìm kiếm khách..."
                            value={speakerSearch}
                            onChange={(e) => setSpeakerSearch(e.target.value)}
                            className="w-40 sm:w-52 pl-8 pr-7 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none transition shadow-2xs"
                          />
                          {speakerSearch && (
                            <button
                              type="button"
                              onClick={() => setSpeakerSearch("")}
                              className="absolute right-1.5 top-1 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                              title="Xóa tìm kiếm"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {canManage && ["scheduled", "live", "paused"].includes(activeMeeting.status) && checkedSpeakerIds.length > 0 && (
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs py-1">
                        <span className="font-medium text-slate-600">Đã chọn {checkedSpeakerIds.length}</span>
                        <button
                          type="button"
                          title="Chuyển xuống cuối lượt"
                          aria-label="Chuyển xuống cuối lượt"
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition cursor-pointer shadow-2xs"
                          onClick={() => void deferSpeaker(checkedSpeakerIds).catch(error => toast.error(error.message || "Không hoãn được lượt."))}
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                          <span className="font-medium">({checkedSpeakerIds.length})</span>
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:text-cyan-700 transition-colors cursor-pointer"
                          disabled={saving}
                          onClick={() => setCheckedSpeakerIds([])}
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    )}
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {filteredSpeakers.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          <Search className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                          <p>
                            {!activeMeeting.speakers.length
                              ? "Chưa có ai check-in vào cuộc họp này."
                              : "Không tìm thấy khách mời hoặc diễn giả nào phù hợp."}
                          </p>
                          {(speakerSearch || speakerTypeFilter !== "all") && (
                            <button
                              type="button"
                              onClick={() => {
                                setSpeakerSearch("");
                                setSpeakerTypeFilter("all");
                              }}
                              className="mt-2 text-cyan-600 hover:text-cyan-800 font-semibold cursor-pointer underline"
                            >
                              Xóa bộ lọc tìm kiếm
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredSpeakers.map((p) => {
                          const i = p.originalIndex;
                          const isSpeaking = i === activeMeeting.currentIndex && ["live", "paused"].includes(activeMeeting.status);
                          const isGuest = !p.userId;
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${isSpeaking
                                ? "border border-cyan-300 bg-cyan-50/70 shadow-2xs"
                                : "border border-slate-200/60 bg-slate-50/50 hover:bg-slate-50"
                                }`}
                            >
                              <span className="w-6 text-center font-mono text-xs font-medium text-slate-400">
                                {i + 1}
                              </span>
                              {canManage && ["scheduled", "live", "paused"].includes(activeMeeting.status) && (
                                <input
                                  type="checkbox"
                                  aria-label={`Chọn ${p.name}`}
                                  checked={checkedSpeakerIds.includes(p.id)}
                                  disabled={saving || (activeMeeting.status !== "scheduled" && i < activeMeeting.currentIndex)}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setCheckedSpeakerIds(ids => [...ids, p.id]);
                                      setPresentationSpeakerId(p.id);
                                    } else {
                                      setCheckedSpeakerIds(ids => ids.filter(id => id !== p.id));
                                    }
                                  }}
                                />
                              )}

                              {p.photoURL ? (
                                <img
                                  src={p.photoURL}
                                  alt={p.name}
                                  className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                                />
                              ) : (
                                <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-50 font-medium text-xs text-cyan-600">
                                  {p.name.slice(0, 1).toUpperCase()}
                                </span>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button type="button" aria-label={`Bắt đầu từ ${p.name}`} aria-pressed={presentationSpeakerId === p.id} disabled={saving || !canManage || !["scheduled", "live", "paused"].includes(activeMeeting.status)} onClick={() => setPresentationSpeakerId(p.id)} className="block truncate text-left text-xs font-medium text-slate-800 aria-pressed:text-cyan-700 aria-pressed:underline">{p.name}</button>
                                  {isGuest ? (
                                    <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                                      Khách mời
                                    </span>
                                  ) : (
                                    <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/80">
                                      Thành viên
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  {p.email || (isGuest ? "Khách mời" : "")} • {p.seconds} giây
                                </span>
                              </div>

                              {isSpeaking && (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Megaphone className="h-3 w-3 animate-bounce" /> Đang nói
                                </span>
                              )}
                              {canManage && ["scheduled", "live", "paused"].includes(activeMeeting.status) && (activeMeeting.status === "scheduled" || i >= activeMeeting.currentIndex) ? (
                                <button
                                  type="button"
                                  title={i === activeMeeting.speakers.length - 1 ? (p.deferred ? "Đã chuyển cuối lượt" : "Người cuối danh sách") : "Chuyển xuống cuối lượt"}
                                  aria-label={`Để cuối lượt: ${p.name}`}
                                  disabled={saving || i === activeMeeting.speakers.length - 1}
                                  onClick={() => void deferSpeaker(p.id).catch(error => toast.error(error.message || "Không hoãn được lượt."))}
                                  className={`shrink-0 p-1.5 rounded-lg border transition cursor-pointer ${
                                    p.deferred
                                      ? "border-amber-300 bg-amber-100/90 text-amber-800"
                                      : "border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100"
                                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                  <ArrowDownToLine className="h-3.5 w-3.5" />
                                </button>
                              ) : p.deferred ? (
                                <span
                                  title="Đã chuyển cuối lượt"
                                  className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0"
                                >
                                  <ArrowDownToLine className="h-3.5 w-3.5" />
                                </span>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 2: VÒNG QUAY MAY MẮN (RANDOM.ORG) */}
              {activeSubTab === "luckyDraw" && (
                <LuckyDrawTab
                  meeting={activeMeeting as any}
                  canManage={canManage}
                  onRefreshMeeting={refresh}
                  onStartMeeting={() => control("start")}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP TẠO CUỘC HỌP MỚI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="max-h-[90dvh] overflow-y-auto w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-cyan-600" />
                Tạo cuộc họp BNI mới
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={create} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên cuộc họp <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Buổi họp định kỳ Chapter Tuần 40"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Thời gian diễn ra <span className="text-rose-500">*</span>
                  </label>
                  <MeetingDateTimePicker
                    required
                    value={startsAt}
                    onChange={setStartsAt}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Địa điểm / Link họp</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Khách sạn New World / Zoom"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="block rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm"><span className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={allowDirectCheckIn} onChange={event => setAllowDirectCheckIn(event.target.checked)} />Cho phép điểm danh trực tiếp trước khi cuộc họp bắt đầu</span><span className="mt-2 block text-xs text-slate-600">Khi cuộc họp bắt đầu, thành viên có thể bấm Điểm danh trực tiếp. Bật tùy chọn này để cho phép điểm danh trước giờ bắt đầu. Luôn yêu cầu GPS trong bán kính địa điểm họp.</span></label>
              <MeetingLocationFields value={gpsPoint} onChange={setGpsPoint} radius={gpsRadiusMeters} onRadiusChange={setGpsRadiusMeters} />

              <MeetingCoverImageField value={coverImage} onChange={setCoverImage} />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nhắc hẹn trước (ngày)</label>
                <input
                  type="number"
                  min="0"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(+e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Tiers duration config */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
                <span className="block font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                  Cấu hình theo toàn bộ thứ tự check-in
                </span>
                <p className="text-[10px] text-slate-500">
                  Tính theo toàn bộ danh sách check-in, gồm thành viên và khách mời. Các lượt vượt tổng số nhóm dùng thời lượng mặc định.
                </p>
                {tiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <span className="col-span-3 text-[10px] font-semibold text-slate-600">Cấp {i + 1}</span>
                    <div>
                      <span className="text-[10px] text-slate-500">Số lượng người:</span>
                      <input
                        type="number"
                        min="1"
                        value={t.count}
                        onChange={(e) =>
                          setTiers((ts) =>
                            ts.map((v, j) => (j === i ? { ...v, count: +e.target.value } : v))
                          )
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Số giây phát biểu:</span>
                      <input
                        type="number"
                        min="5"
                        value={t.seconds}
                        onChange={(e) =>
                          setTiers((ts) =>
                            ts.map((v, j) => (j === i ? { ...v, seconds: +e.target.value } : v))
                          )
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove tier ${i + 1}`}
                      title="Xóa cấp"
                      disabled={tiers.length <= 1}
                      onClick={() => setTiers((current) => current.filter((_, index) => index !== i))}
                      className="mb-0.5 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                  <span className="text-[10px] text-slate-500">
                    Tổng số lượt theo các cấp: {tiers.reduce((total, tier) => total + tier.count, 0)} người
                  </span>
                  <button
                    type="button"
                    disabled={tiers.length >= 20}
                    onClick={() =>
                      setTiers((current) => [
                        ...current,
                        { count: 10, seconds: current[current.length - 1]?.seconds || fallbackSeconds },
                      ])
                    }
                    className="rounded-lg bg-cyan-50 px-3 py-1.5 text-[11px] font-bold text-cyan-700 hover:bg-cyan-100 disabled:opacity-40 cursor-pointer"
                  >
                    + Thêm cấp thời lượng
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 font-bold text-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 font-bold shadow-sm shadow-cyan-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Đang tạo..." : "Tạo cuộc họp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP SỬA CUỘC HỌP */}
      {editingMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="max-h-[90dvh] overflow-y-auto w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-cyan-600" />
                Chỉnh sửa cuộc họp
              </h3>
              <button
                type="button"
                onClick={() => setEditingMeeting(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={update} className="space-y-4 pt-4 text-xs">


              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên cuộc họp <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ví dụ: Buổi họp định kỳ Chapter Tuần 40"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Thời gian diễn ra <span className="text-rose-500">*</span>
                  </label>
                  <MeetingDateTimePicker
                    required
                    value={editStartsAt}
                    onChange={setEditStartsAt}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Địa điểm / Link họp</label>
                  <input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Khách sạn New World / Zoom"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="block rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm"><span className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={editAllowDirectCheckIn} onChange={event => setEditAllowDirectCheckIn(event.target.checked)} />Cho phép điểm danh trực tiếp trước khi cuộc họp bắt đầu</span><span className="mt-2 block text-xs text-slate-600">Khi cuộc họp bắt đầu, thành viên có thể bấm Điểm danh trực tiếp. Bật tùy chọn này để cho phép điểm danh trước giờ bắt đầu. Luôn yêu cầu GPS trong bán kính địa điểm họp.</span></label>
              <MeetingLocationFields value={editGpsPoint} onChange={setEditGpsPoint} radius={editGpsRadiusMeters} onRadiusChange={setEditGpsRadiusMeters} />

              <MeetingCoverImageField value={editCoverImage} onChange={setEditCoverImage} />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nhắc hẹn trước (ngày)</label>
                <input
                  type="number"
                  min="0"
                  value={editReminderDays}
                  onChange={(e) => setEditReminderDays(+e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Tiers duration config */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
                <span className="block font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                  Cấu hình theo toàn bộ thứ tự check-in
                </span>
                <p className="text-[10px] text-slate-500">
                  Tính theo toàn bộ danh sách check-in, gồm thành viên và khách mời. Các lượt vượt tổng số nhóm dùng thời lượng mặc định.
                </p>
                {editTiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <span className="col-span-3 text-[10px] font-semibold text-slate-600">Cấp {i + 1}</span>
                    <div>
                      <span className="text-[10px] text-slate-500">Số lượng người:</span>
                      <input
                        type="number"
                        min="1"
                        value={t.count}
                        onChange={(e) =>
                          setEditTiers((ts) =>
                            ts.map((v, j) => (j === i ? { ...v, count: +e.target.value } : v))
                          )
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Số giây phát biểu:</span>
                      <input
                        type="number"
                        min="5"
                        value={t.seconds}
                        onChange={(e) =>
                          setEditTiers((ts) =>
                            ts.map((v, j) => (j === i ? { ...v, seconds: +e.target.value } : v))
                          )
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove tier ${i + 1}`}
                      title="Xóa cấp"
                      disabled={editTiers.length <= 1}
                      onClick={() => setEditTiers((current) => current.filter((_, index) => index !== i))}
                      className="mb-0.5 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                  <span className="text-[10px] text-slate-500">
                    Tổng số lượt theo các cấp: {editTiers.reduce((total, tier) => total + tier.count, 0)} người
                  </span>
                  <button
                    type="button"
                    disabled={editTiers.length >= 20}
                    onClick={() =>
                      setEditTiers((current) => [
                        ...current,
                        { count: 10, seconds: current[current.length - 1]?.seconds || editFallbackSeconds },
                      ])
                    }
                    className="rounded-lg bg-cyan-50 px-3 py-1.5 text-[11px] font-bold text-cyan-700 hover:bg-cyan-100 disabled:opacity-40 cursor-pointer"
                  >
                    + Thêm cấp thời lượng
                  </button>
                </div>
              </div>

              {canManage && orderingMeeting && ["scheduled", "live", "paused"].includes(orderingMeeting.status) && orderingMeeting.speakers.length > 0 && <div className="mb-4 space-y-2 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">
                <h4 className="font-bold text-slate-800">Sắp xếp thứ tự thuyết trình</h4>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-48 flex-1 text-xs font-semibold">Chọn người phát biểu
                    <select aria-label="Chọn người để sắp xếp" disabled={saving} className="mt-1 w-full rounded-lg border bg-white p-2 text-sm"
                      value={orderingMeeting.speakers.slice(pendingStart).some(person => person.id === prioritySpeakerId) ? prioritySpeakerId : orderingMeeting.speakers[pendingStart]?.id || ""}
                      onChange={event => setPrioritySpeakerId(event.target.value)}>
                      {pendingStart >= orderingMeeting.speakers.length && <option value="">Không còn người đang chờ phát biểu</option>}
                      {orderingMeeting.speakers.map((person, index) => <option key={person.id} value={person.id} disabled={index < pendingStart}>{person.name}{index < pendingStart ? index === orderingMeeting.currentIndex ? " — Đang phát biểu" : " — Đã phát biểu" : ""}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">Thứ tự ưu tiên
                    <input aria-label="Thứ tự ưu tiên" type="number" inputMode="numeric" min={1} max={Math.max(1, orderingMeeting.speakers.length - pendingStart)} disabled={saving || pendingStart >= orderingMeeting.speakers.length}
                      value={Math.max(1, Math.min(priorityPosition, orderingMeeting.speakers.length - pendingStart))} className="mt-1 block w-24 rounded-lg border bg-white p-2 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      onChange={event => setPriorityPosition(Math.max(1, Math.min(orderingMeeting.speakers.length - pendingStart, Math.floor(Number(event.target.value) || 1))))} />
                  </label>
                  <button type="button" disabled={saving || pendingStart >= orderingMeeting.speakers.length} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                    onClick={() => {
                      const selected = orderingMeeting.speakers.findIndex((person, index) => index >= pendingStart && person.id === prioritySpeakerId);
                      const index = selected >= 0 ? selected : pendingStart;
                      const target = pendingStart + Math.min(priorityPosition, orderingMeeting.speakers.length - pendingStart) - 1;
                      if (target !== index) reorder(index, target - index);
                    }}>Áp dụng thứ tự</button>
                </div>
                {pendingStart >= orderingMeeting.speakers.length && <p role="status" className="text-xs text-slate-600">Danh sách check-in đã được tải. Các lượt đã hoàn tất hoặc đang phát biểu nên không thể đổi ưu tiên. Để thuyết trình lại, chọn người trong tab Thuyết trình rồi bấm Bắt đầu thuyết trình.</p>}
                <ol className="list-inside list-decimal space-y-1 text-xs text-slate-600">
                  {orderingMeeting.speakers.map(person => <li key={person.id}>{person.name}</li>)}
                </ol>
              </div>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMeeting(null)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 font-bold text-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 font-bold shadow-sm shadow-cyan-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canManage && completionKey && dismissedCompletion !== completionKey && <SpeechesCompleteDialog onClose={dismissCompletion} />}
      <ConfirmDialog isOpen={finishRequested} title="Kết thúc buổi họp?" description="Sau khi kết thúc, buổi họp ngừng nhận check-in và điều hành phát biểu." confirmLabel="Kết thúc buổi họp" isSubmitting={saving} onClose={() => setFinishRequested(false)} onConfirm={async () => { await control("finish"); setFinishRequested(false); }} />
      {/* POPUP XÁC NHẬN BẮT ĐẦU CUỘC HỌP */}
      <ConfirmDialog
        isOpen={!!startingMeeting}
        title="Bắt đầu cuộc họp?"
        description={
          startingMeeting && startingMeeting.speakers && startingMeeting.speakers.length > 0
            ? `Bạn có chắc chắn muốn bắt đầu cuộc họp "${startingMeeting?.title}" ngay bây giờ? Trạng thái sẽ được chuyển sang "Đang diễn ra" và kích hoạt bộ đếm thời gian cho diễn giả.`
            : `Cuộc họp "${startingMeeting?.title}" hiện chưa có người check-in. Bạn có muốn bắt đầu ngay? Trạng thái sẽ chuyển sang "Đang diễn ra" và thành viên/khách mời vẫn có thể tiếp tục check-in trong lúc họp.`
        }
        tone="warning"
        confirmLabel="Bắt đầu cuộc họp"
        cancelLabel="Hủy"
        isSubmitting={isStarting}
        onConfirm={handleStartMeeting}
        onClose={() => setStartingMeeting(null)}
      />
      {/* POPUP XÁC NHẬN KẾT THÚC CUỘC HỌP */}
      <ConfirmDialog
        isOpen={!!endingMeeting}
        title="Kết thúc buổi họp?"
        description={`Bạn có chắc chắn muốn kết thúc buổi họp "${endingMeeting?.title}"? Sau khi kết thúc, trạng thái sẽ đổi sang "Đã kết thúc", buổi họp ngừng nhận check-in và điều hành phát biểu.`}
        tone="danger"
        confirmLabel="Kết thúc buổi họp"
        cancelLabel="Hủy"
        isSubmitting={isEnding}
        onConfirm={handleEndMeeting}
        onClose={() => setEndingMeeting(null)}
      />
      {/* POPUP XÁC NHẬN XÓA CUỘC HỌP */}
      <ConfirmDialog
        isOpen={!!deletingMeeting}
        title="Xác nhận xóa cuộc họp"
        description={`Bạn có chắc chắn muốn xóa cuộc họp "${deletingMeeting?.title}"? Toàn bộ danh sách diễn giả check-in và dữ liệu quay thưởng của cuộc họp này sẽ bị xóa hoàn toàn.`}
        tone="danger"
        confirmLabel="Xóa cuộc họp"
        cancelLabel="Hủy"
        isSubmitting={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingMeeting(null)}
      />
    </div>
  );
}
