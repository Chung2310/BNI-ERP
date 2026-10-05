import { MeetingSpeakingTimeFields } from "../components/meetings/MeetingSpeakingTimeFields";
import { defaultSpeakingTimeSlots, speakingTimeSlotsForEdit, validateSpeakingTimeSlots, type SpeakingTier, type SpeakingTimeSlot } from "../utils/meetingSpeakingTime";
import { MeetingCalendar } from "../components/meetings/MeetingCalendar";
import { MeetingScheduleActions } from "../components/meetings/MeetingScheduleActions";
import { RescheduleMeetingDialog } from "../components/meetings/RescheduleMeetingDialog";
import { MeetingRecurrenceFields } from "../components/meetings/MeetingRecurrenceFields";
import { MeetingSeriesBulkEditDialog, type MeetingSeriesChanges } from "../components/meetings/MeetingSeriesBulkEditDialog";
import { vietnamDateTime, type MeetingRecurrence } from "../utils/meetingRecurrence";
import { meetingElapsedLabel } from "../components/meetings/meetingElapsedLabel";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MemberMeetingDetail, { memberAttendance, memberAttendanceLabel } from "../components/meetings/MemberMeetingDetail";
import { SpeechesCompleteDialog } from "../components/meetings/SpeechesCompleteDialog";
import { SlideTransitionDelayInput } from "../components/meetings/SlideTransitionDelayInput";
import { MeetingSlides } from "../components/meetings/MeetingSlides";
import { MeetingCheckInPanel } from "../components/meetings/MeetingCheckInPanel";
import { CompanyCheckInQrDialog } from "../components/meetings/CompanyCheckInQrDialog";
import { MeetingLocationFields } from "../components/meetings/MeetingLocationFields";
import { MeetingCoverImageField } from "../components/meetings/MeetingCoverImageField";
import { MeetingDateTimePicker } from "../components/meetings/MeetingDateTimePicker";
import {
  CalendarDays,
  QrCode,
  Clock3,
  ImagePlus,
  Megaphone,
  Users,
  Gift,
  Play,
  Pause,
  Square,
  MapPin,
  X,
  Search,
  Pencil,
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
import { MeetingFlowStepper, MEETING_FLOW_META, loadMeetingFlowOrder, saveMeetingFlowOrder, type MeetingFlowStep } from "../components/meetings/MeetingFlowStepper";
import { ActiveMembersPanel } from "../components/meetings/ActiveMembersPanel";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { SearchableSelect } from "../components/common/SearchableSelect";
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
  seriesId?: string;
  originalStartsAt?: string;
  _id: string;
  title: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  gpsRadiusMeters?: number;
  checkInQrExpiresAt?: string;
  coverImage?: string;
  startsAt: string;
  endsAt?: string;
  startedAt?: string;
  reminderDays: number;
  status: "scheduled" | "live" | "paused" | "ended" | "cancelled";
  speakers: Speaker[];
  tiers: SpeakingTier[];
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

function defaultEnd(value: string) {
  return value ? vietnamDateTime(new Date(new Date(value + ":00+07:00").getTime() + 2 * 60 * 60 * 1000)) : "";
}

export default function MeetingTab() {
  const { hasPermission, userProfile } = useAuth();
  const canManage = hasPermission("meetings:manage") || hasPermission("access:manage");

  const [showSharedQr, setShowSharedQr] = useState(false);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [calendarMonth, setCalendarMonth] = useState(() => vietnamDateTime(new Date()).slice(0,7));
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [recurrence, setRecurrence] = useState<MeetingRecurrence>({ startDate: "", months: 6, weekday: 3, time: "07:00" });
  const [items, setItems] = useState<Meeting[]>([]);
  const [detailMeetingId, setDetailMeetingId] = useState<string | null>(null);
  const detailMeetingIdRef = useRef<string | null>(null);
  detailMeetingIdRef.current = detailMeetingId;
  // Quy trình điều hành: các bước theo thứ tự do MC sắp xếp (lưu localStorage)
  const [flowOrder, setFlowOrder] = useState<MeetingFlowStep[]>(loadMeetingFlowOrder);
  const [flowStep, setFlowStep] = useState<MeetingFlowStep>("checkin");
  const [slidesOpen, setSlidesOpen] = useState(false);
  const updateFlowOrder = useCallback((order: MeetingFlowStep[]) => {
    setFlowOrder(order);
    saveMeetingFlowOrder(order);
  }, []);
  const goToFlowStep = useCallback((step: MeetingFlowStep) => {
    setFlowStep(step);
    setSlidesOpen(false);
  }, []);
  const meetingFlowSteps = useRef(new Map<string, MeetingFlowStep>());
  const getMeetingFlowStep = (meetingId: string): MeetingFlowStep => {
    const inMemory = meetingFlowSteps.current.get(meetingId);
    if (inMemory && flowOrder.includes(inMemory)) return inMemory;
    try {
      const saved = localStorage.getItem("bni_meeting_flow_step:" + meetingId);
      if (flowOrder.includes(saved as MeetingFlowStep)) return saved as MeetingFlowStep;
    } catch { /* Fall back to the initial step when browser storage is unavailable. */ }
    return "checkin";
  };
  const openMeetingFlow = (meeting: Meeting) => {
    goToFlowStep(getMeetingFlowStep(meeting._id));
  };
  useEffect(() => {
    if (!detailMeetingId || !canManage) return;
    meetingFlowSteps.current.set(detailMeetingId, flowStep);
    try {
      localStorage.setItem("bni_meeting_flow_step:" + detailMeetingId, flowStep);
    } catch { /* The in-memory state still remembers the step during this visit. */ }
  }, [detailMeetingId, flowStep, canManage]);
  const [attendedOnly, setAttendedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "live" | "ended" | "cancelled">("all");
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
    setFlowStep("presentation");
    setSlidesOpen(true);
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
  const [createModal, setCreateModal] = useState<"single" | "recurring" | null>(null);
  const recurring = createModal === "recurring";
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [gpsPoint, setGpsPoint] = useState<{latitude:number;longitude:number}|null>(null);
  const [gpsRadiusMeters, setGpsRadiusMeters] = useState(200);
  const [coverImage, setCoverImage] = useState("");
  const [reminderDays, setReminderDays] = useState(1);
  const [tiers, setTiers] = useState<SpeakingTimeSlot[]>(defaultSpeakingTimeSlots);
  const [fallbackSeconds, setFallbackSeconds] = useState(20);

  // Edit Meeting Modal state
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [bulkEditingMeeting, setBulkEditingMeeting] = useState<Meeting | null>(null);
  const [bulkMeetingCandidates, setBulkMeetingCandidates] = useState<Meeting[]>([]);
  const [bulkEditingChanges, setBulkEditingChanges] = useState<MeetingSeriesChanges | null>(null);
  const [bulkEditingLoading, setBulkEditingLoading] = useState(false);
  const [bulkEditingSaving, setBulkEditingSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editGpsPoint, setEditGpsPoint] = useState<{latitude:number;longitude:number}|null>(null);
  const [editGpsRadiusMeters, setEditGpsRadiusMeters] = useState(200);
  const [editCoverImage, setEditCoverImage] = useState("");
  const [editReminderDays, setEditReminderDays] = useState(1);
  const [editTiers, setEditTiers] = useState<SpeakingTimeSlot[]>([]);
  const [editFallbackSeconds, setEditFallbackSeconds] = useState(20);

  // Delete Meeting Confirmation Dialog state
  const [deletingMeeting, setDeletingMeeting] = useState<Meeting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancellingMeeting, setCancellingMeeting] = useState<Meeting | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [reschedulingMeeting, setReschedulingMeeting] = useState<Meeting | null>(null);

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
      const selectedId = detailMeetingIdRef.current;
      if (selectedId && !next.some(item => item._id === selectedId)) {
        try { next.push(await api("/" + selectedId)); } catch { setDetailMeetingId(null); }
      }
      setItems(next);
      setCalendarRevision(value => value + 1);
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
  const canModifyActiveMeeting = canManage && !!activeMeeting && activeMeeting.status !== "ended";

  useEffect(() => {
    if (editingMeeting && items.some(item => item._id === editingMeeting._id && item.status === "ended")) setEditingMeeting(null);
  }, [items, editingMeeting]);
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

  const openCreateModal = (mode: "single" | "recurring") => {
    setTitle("");
    setStartsAt("");
    setEndsAt("");
    setLocation("");
    setGpsPoint(null);
    setGpsRadiusMeters(200);
    setCoverImage("");
    setReminderDays(1);
    setTiers(defaultSpeakingTimeSlots());
    setFallbackSeconds(20);
    setRecurrence({ startDate: "", months: 6, weekday: 3, time: "07:00" });
    setCreateModal(mode);
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (recurring && !recurrence.startDate) { toast.error("Vui lòng chọn ngày bắt đầu chu kỳ."); return; }
    const timeSlotError = validateSpeakingTimeSlots(tiers);
    if (timeSlotError) { toast.error(timeSlotError); return; }
    void run(async () => {
      const result = await api(recurring ? "/series" : "", "POST", {
        ...(!recurring ? { title } : {}),
        ...(recurring ? { recurrence } : { startsAt: new Date(startsAt + ":00+07:00").toISOString(), endsAt: new Date(endsAt + ":00+07:00").toISOString() }),
        location,
        ...(gpsPoint || {}),
        gpsRadiusMeters,
        coverImage,
        reminderDays,
        tiers,
        fallbackSeconds,
      });
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setLocation("");
      setGpsPoint(null);
      setCoverImage("");
      setCreateModal(null);
      if (!recurring) toast.success("Tạo cuộc họp mới thành công!");
      if (recurring) {
        const first = result[0];
        setCalendarMonth(vietnamDateTime(first.startsAt).slice(0,7));
        setView("calendar"); setDetailMeetingId(null);
        toast.success("Đã tạo " + result.length + " buổi họp định kỳ.");
      } else { detailMeetingIdRef.current = result._id; setDetailMeetingId(result._id); }
      if (!recurring) openMeetingFlow(result);
    });
  };

  const openEditModal = (m: Meeting, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (m.status === "ended") return;
    setEditingMeeting(m);
    setPrioritySpeakerId("");
    setPriorityPosition(1);
    setEditTitle(m.title);
    setEditLocation(m.location || "");
    setEditGpsPoint(typeof m.latitude === "number" && typeof m.longitude === "number" ? { latitude: m.latitude, longitude: m.longitude } : null);
    setEditGpsRadiusMeters(m.gpsRadiusMeters || 200);
    setEditCoverImage(m.coverImage || "");
    setEditReminderDays(m.reminderDays ?? 1);
    setEditTiers(speakingTimeSlotsForEdit(m.tiers));
    setEditFallbackSeconds(m.fallbackSeconds || 20);

    // Format startsAt for datetime-local
    try {
      setEditStartsAt(vietnamDateTime(m.startsAt));
      setEditEndsAt(vietnamDateTime(m.endsAt || new Date(new Date(m.startsAt).getTime() + 120 * 60000)));
    } catch {
      setEditStartsAt("");
      setEditEndsAt("");
    }
  };

  const update = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;
    const timeSlotError = validateSpeakingTimeSlots(editTiers);
    if (timeSlotError) { toast.error(timeSlotError); return; }
    void run(async () => {
      await api(`/${editingMeeting._id}`, "PUT", {
        version: editingMeeting.__v,
        title: editTitle,
        ...(editingMeeting.status === "scheduled" ? { startsAt: new Date(editStartsAt + ":00+07:00").toISOString() } : {}),
        endsAt: new Date(editEndsAt + ":00+07:00").toISOString(),
        location: editLocation,
        latitude: editGpsPoint?.latitude ?? null,
        longitude: editGpsPoint?.longitude ?? null,
        gpsRadiusMeters: editGpsRadiusMeters,
        coverImage: editCoverImage,
        reminderDays: editReminderDays,
        tiers: editTiers,
        fallbackSeconds: editFallbackSeconds,
      });
      setEditingMeeting(null);
      toast.success("Cập nhật cuộc họp thành công!");
    });
  };

  const openBulkEditSelection = async () => {
    if (!editingMeeting?.seriesId || editingMeeting.status !== "scheduled") return;
    const timeSlotError = validateSpeakingTimeSlots(editTiers);
    if (timeSlotError) { toast.error(timeSlotError); return; }

    const changes: MeetingSeriesChanges = {};
    const originalStart = vietnamDateTime(editingMeeting.startsAt);
    const originalStartMs = new Date(editingMeeting.startsAt).getTime();
    const originalEndMs = editingMeeting.endsAt ? new Date(editingMeeting.endsAt).getTime() : originalStartMs + 120 * 60000;
    const nextStartMs = new Date(editStartsAt + ":00+07:00").getTime();
    const nextEndMs = new Date(editEndsAt + ":00+07:00").getTime();
    const nextDurationMs = nextEndMs - nextStartMs;
    if (!Number.isFinite(nextDurationMs) || nextDurationMs <= 0 || nextDurationMs > 24 * 60 * 60000) {
      toast.error("Thời lượng cuộc họp phải từ 1 phút đến 24 giờ.");
      return;
    }

    if (editLocation !== (editingMeeting.location || "")) changes.location = editLocation;
    if (editStartsAt.slice(11, 16) !== originalStart.slice(11, 16)) changes.startsTime = editStartsAt.slice(11, 16);
    if (Math.round(nextDurationMs / 60000) !== Math.round((originalEndMs - originalStartMs) / 60000)) {
      changes.durationMinutes = Math.round(nextDurationMs / 60000);
    }

    if (editCoverImage !== (editingMeeting.coverImage || "")) changes.coverImage = editCoverImage;

    const originalTiers = speakingTimeSlotsForEdit(editingMeeting.tiers);
    if (JSON.stringify(editTiers) !== JSON.stringify(originalTiers)) changes.tiers = editTiers;
    if (editFallbackSeconds !== (editingMeeting.fallbackSeconds || 20)) changes.fallbackSeconds = editFallbackSeconds;

    if (!Object.keys(changes).length) {
      toast.error("Hãy chỉnh ít nhất một thông tin trước khi áp dụng hàng loạt.");
      return;
    }

    setBulkMeetingCandidates([]);
    setBulkEditingChanges(changes);
    setBulkEditingMeeting(editingMeeting);
    setBulkEditingLoading(true);
    try {
      const allMeetings: Meeting[] = await api("?history=all");
      const now = Date.now();
      setBulkMeetingCandidates(allMeetings
        .filter(item => item.seriesId === editingMeeting.seriesId && item.status === "scheduled" && new Date(item.startsAt).getTime() > now)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    } catch (error) {
      setBulkEditingMeeting(null);
      setBulkEditingChanges(null);
      toast.error(error instanceof Error ? error.message : "Không thể tải các buổi họp định kỳ.");
    } finally {
      setBulkEditingLoading(false);
    }
  };

  const closeBulkEditSelection = () => {
    setBulkEditingMeeting(null);
    setBulkEditingChanges(null);
    setBulkMeetingCandidates([]);
  };

  const applyBulkMeetingChanges = async (meetingIds: string[]) => {
    if (!bulkEditingMeeting || !bulkEditingChanges) return;
    setBulkEditingSaving(true);
    try {
      const result: { updatedCount: number } = await api(`/${bulkEditingMeeting._id}/series`, "PUT", { meetingIds, changes: bulkEditingChanges });
      closeBulkEditSelection();
      setEditingMeeting(null);
      await refresh();
      toast.success(`Đã cập nhật ${result.updatedCount} buổi họp.`);
    } finally {
      setBulkEditingSaving(false);
    }
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

  const matchesMeetingFilter = (m: Meeting) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.location && m.location.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (!canManage && attendedOnly && !memberAttendance(m, userProfile?.uid)) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "scheduled") return m.status === "scheduled";
    if (statusFilter === "live") return m.status === "live" || m.status === "paused";
    if (statusFilter === "ended") return m.status === "ended";
    if (statusFilter === "cancelled") return m.status === "cancelled";
    return true;
  };
  const filteredItems = items.filter(matchesMeetingFilter);

  return (
    <div className={`@container w-full px-0.5 text-left sm:pr-2 ${view === "calendar" ? "flex flex-col sm:h-full sm:min-h-0" : "max-h-[85vh] overflow-y-auto pb-5"}`} id="meeting_tab_view">
      {/* Header bar */}
      <div className="mb-2 flex shrink-0 flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600 shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-normal text-cyan-700 dark:text-cyan-400 tracking-tight">
                {canManage ? "Quản lý buổi họp" : "Cuộc họp"}
              </h1>
              <p className="hidden lg:block text-[11px] text-slate-500 font-normal mt-0.5">
                {canManage ? "Lên lịch → Đón tiếp & check-in → Điều hành phát biểu → Quay thưởng" : "Theo dõi lịch họp và thông tin tham dự của bạn"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={showSharedQr}
                  aria-controls="company-checkin-qr"
                  onClick={() => setShowSharedQr(true)}
                  className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-50"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Check-in</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateModal("recurring")}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-3 py-2 text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>Tạo lịch định kỳ</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter Toolbar: Search + Status Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Status Tabs */}
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 select-none [&>button]:shrink-0 [&>button]:whitespace-nowrap">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "all"
                ? "bg-cyan-600 text-white shadow-xs"
                : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200"
                }`}
            >
              Tất cả {view === "list" && "(" + items.length + ")"}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("live")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "live"
                ? "bg-cyan-600 text-white shadow-xs"
                : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200"
                }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Đang diễn ra {view === "list" && "(" + items.filter((m) => m.status === "live" || m.status === "paused").length + ")"}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("scheduled")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "scheduled"
                ? "bg-cyan-600 text-white shadow-xs"
                : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200"
                }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Sắp diễn ra {view === "list" && "(" + items.filter((m) => m.status === "scheduled").length + ")"}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ended")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "ended"
                ? "bg-cyan-600 text-white shadow-xs"
                : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200"
                }`}
            >
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Đã kết thúc {view === "list" && "(" + items.filter((m) => m.status === "ended").length + ")"}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("cancelled")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${statusFilter === "cancelled"
                ? "bg-cyan-600 text-white shadow-xs"
                : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200"
                }`}
            >
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Đã hủy {view === "list" && "(" + items.filter((m) => m.status === "cancelled").length + ")"}
            </button>
          </div>

          {!canManage && <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer"><input type="checkbox" className="rounded text-cyan-600 focus:ring-cyan-500" checked={attendedOnly} onChange={event => setAttendedOnly(event.target.checked)} />Chỉ buổi đã check-in</label>}
          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên cuộc họp, địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none shadow-2xs"
            />
          </div>
        </div>
      </div>

      <div className="mb-2 inline-flex shrink-0 self-start items-center gap-1 rounded-xl bg-slate-100 p-0.5 border border-slate-200/60" role="group" aria-label="Chế độ xem cuộc họp">
        <button
          type="button"
          aria-pressed={view === "calendar"}
          onClick={() => setView("calendar")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            view === "calendar"
              ? "bg-white text-cyan-700 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-cyan-700"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Lịch tháng</span>
        </button>
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            view === "list"
              ? "bg-white text-cyan-700 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-cyan-700"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Danh sách</span>
        </button>
      </div>
      {canManage && showSharedQr && <CompanyCheckInQrDialog api={api} companyCode={userProfile?.companyCode} onClose={() => setShowSharedQr(false)} />}
      {/* Grid of Meeting Cards (Dạng danh sách / Thẻ hiển thị) */}
      {view === "calendar" ? <MeetingCalendar<Meeting> month={calendarMonth} onMonthChange={setCalendarMonth} revision={calendarRevision} tick={tick} flowStepLabel={meetingId => MEETING_FLOW_META[getMeetingFlowStep(meetingId)].label} load={api} canManage={canManage} filter={matchesMeetingFilter}
        onOpen={meeting => { setItems(previous => [...previous.filter(item => item._id !== meeting._id), meeting]); setDetailMeetingId(meeting._id); openMeetingFlow(meeting); }}
        onReschedule={setReschedulingMeeting}
        onCancel={setCancellingMeeting}
        onDelete={setDeletingMeeting}
      /> : loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải cuộc họp...</p> : loadError ? <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{loadError}<button type="button" onClick={() => { setLoading(true); void refresh(); }} className="ml-3 font-bold">Thử lại</button></div> : filteredItems.length > 0 ? (
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
            const currentMeetingStep = isLive ? MEETING_FLOW_META[detailMeetingId === m._id ? flowStep : getMeetingFlowStep(m._id)] : null;

            return (
              <div
                key={m._id}
                onClick={() => {
                  setDetailMeetingId(m._id);
                  openMeetingFlow(m);
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
                          {meetingElapsedLabel(m, tick)}
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

                  {/* Edit meeting */}
                  {canManage && m.status !== "ended" && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title="Sửa cuộc họp"
                        onClick={(e) => openEditModal(m, e)}
                        className="rounded-lg bg-white/90 backdrop-blur-md p-1.5 text-slate-700 hover:bg-white hover:text-cyan-700 shadow-sm border border-slate-200/60 transition cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Time preview on image bottom */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex min-w-0 items-center justify-between gap-1.5 text-xs">
                    <div className={`flex min-w-0 flex-1 items-center gap-1.5 font-medium ${m.coverImage ? "text-white/95 drop-shadow-sm" : "text-slate-600 drop-shadow-xs"}`}>
                      <Clock3 className={`h-3.5 w-3.5 shrink-0 ${m.coverImage ? "text-cyan-300" : "text-slate-500"}`} />
                      <span className="truncate">{dateText(m.startsAt)}</span>
                    </div>
                    {currentMeetingStep && <span title={`Đang ${currentMeetingStep.label}`} className="max-w-[48%] shrink-0 truncate rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-cyan-800 shadow-xs">Đang {currentMeetingStep.label}</span>}
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

                {canManage && m.status !== "ended" && (
                  <div className="px-3 pb-3" onClick={(event) => event.stopPropagation()}>
                    <MeetingScheduleActions
                      status={m.status}
                      onCancel={() => setCancellingMeeting(m)}
                      onReschedule={() => setReschedulingMeeting(m)}
                      onDelete={() => setDeletingMeeting(m)}
                    />
                  </div>
                )}

                {/* Card Footer: Action Button */}
                <div className="px-3 pb-3 pt-0 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={!canManage ? "Xem chi tiết cuộc họp" : isLive ? "Tiếp tục điều hành" : m.status === "scheduled" ? "Mở buổi họp & check-in" : "Xem buổi họp"}
                    onClick={(event) => { event.stopPropagation(); setDetailMeetingId(m._id); openMeetingFlow(m); }}
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
            {canManage ? "Không có cuộc họp nào phù hợp với bộ lọc hiện tại. Bạn có thể tạo lịch định kỳ bằng nút ở đầu trang." : "Chưa có cuộc họp phù hợp. Bạn có thể đổi bộ lọc để xem các buổi họp khác."}
          </p>
        </div>
      )}

      {/* POPUP CHI TIẾT CUỘC HỌP (Meeting Detail Modal) */}
      {!canManage && activeMeeting && <MemberMeetingDetail key={activeMeeting._id} onCheckIn={async (location) => { const updated = await api("/" + activeMeeting._id + "/checkin", "POST", location); setItems(previous => previous.map(item => item._id === updated._id ? updated : item)); }} meeting={activeMeeting} userId={userProfile?.uid} onClose={() => setDetailMeetingId(null)} />}
      {canManage && activeMeeting && (
        <div className={`fixed inset-0 z-50 ${isModalFullscreen ? "bg-slate-900 overflow-hidden" : "flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"}`}>
          <div className={`${isModalFullscreen ? "w-full h-full max-w-none max-h-none rounded-none border-0" : "w-full max-w-6xl h-[92vh] min-h-[620px] rounded-3xl border border-slate-200 shadow-2xl"} flex flex-col bg-slate-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}>
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
                          {meetingElapsedLabel(activeMeeting, tick)}
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

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
                {canModifyActiveMeeting && (
                  <MeetingScheduleActions
                    status={activeMeeting.status}
                    onCancel={() => setCancellingMeeting(activeMeeting)}
                    onReschedule={() => setReschedulingMeeting(activeMeeting)}
                    onDelete={() => setDeletingMeeting(activeMeeting)}
                  />
                )}

                {canModifyActiveMeeting && (
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

            <MeetingFlowStepper
              order={flowOrder}
              current={flowStep}
              canReorder={canModifyActiveMeeting}
              badges={{ checkin: activeMeeting.speakers.length, luckyDraw: activeMeeting.luckyDraw?.winners?.length }}
              onSelect={goToFlowStep}
              onReorder={updateFlowOrder}
              onFinish={canManage && ["live", "paused"].includes(activeMeeting.status) ? () => setFinishRequested(true) : undefined}
            />

            {/* Modal Body Content (Scrollable) */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {activeMeeting.status === "ended" && <p role="status" className="rounded-xl border border-cyan-100 bg-cyan-50/50 px-4 py-3 text-sm text-slate-600">Cuộc họp đã kết thúc. Bạn chỉ có thể xem thông tin và kết quả.</p>}
              {flowStep === "presentation" && (
                <div role="group" aria-label="Chế độ xem thuyết trình" className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button type="button" aria-pressed={!slidesOpen} onClick={() => setSlidesOpen(false)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:text-cyan-700 aria-pressed:shadow-2xs cursor-pointer"><Users className="h-3.5 w-3.5" /> Bảng điều hành</button>
                  <button type="button" aria-pressed={slidesOpen} onClick={() => setSlidesOpen(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:text-cyan-700 aria-pressed:shadow-2xs cursor-pointer"><Megaphone className="h-3.5 w-3.5" /> Slide trình chiếu</button>
                </div>
              )}
              {flowStep === "presentation" && slidesOpen && (
                <MeetingSlides
                  key={activeMeeting._id}
                  meeting={activeMeeting}
                  canManage={canModifyActiveMeeting}
                  api={api}
                  startFromFirst={startPresentation}
                  initialSpeakerId={presentationSpeakerId}
                  onDeferSpeaker={deferSpeaker}
                  onPresentationStarted={presentationStarted}
                  onPresentationClosed={presentationClosed}
                  onStartPresentation={canModifyActiveMeeting ? startPresentationTimer : undefined}
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
              {(flowStep === "checkin" || (flowStep === "presentation" && !slidesOpen)) && (
                <div className="space-y-4">
                  {flowStep === "presentation" && (<>
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
                        {canModifyActiveMeeting && <button type="button" disabled={saving || !activeMeeting.speakers.length}
                          onClick={() => {
                            const targetSpeakerId = (checkedSpeakerIds.length > 0 ? checkedSpeakerIds[checkedSpeakerIds.length - 1] : presentationSpeakerId) || "";
                            if (targetSpeakerId) setPresentationSpeakerId(targetSpeakerId);
                            presentationFullscreen.current = document.documentElement.requestFullscreen && !document.fullscreenElement
                              ? document.documentElement.requestFullscreen().then(() => true).catch(() => false)
                              : null;
                            setStartPresentation(true); setFlowStep("presentation"); setSlidesOpen(true);
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 disabled:opacity-40 hover:bg-cyan-700 transition cursor-pointer">
                          <Play className="h-3.5 w-3.5" /> Bắt đầu thuyết trình
                        </button>}
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
                  {flowStep === "checkin" && <MeetingCheckInPanel key={activeMeeting._id} meeting={activeMeeting} canManage={canModifyActiveMeeting} api={api} companyCode={userProfile?.companyCode} onConfigure={() => openEditModal(activeMeeting)} />}
                  {/* Guest Checkin Form (MC / Admin) */}
                  {canManage && ["scheduled", "live", "paused"].includes(activeMeeting.status) && (
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
                          {flowStep === "checkin" ? "Người đã check-in · thứ tự phát biểu" : "Danh sách thuyết trình"} ({filteredSpeakers.length}{filteredSpeakers.length !== activeMeeting.speakers.length ? `/${activeMeeting.speakers.length}` : ""})
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
                              className="mt-2 text-cyan-600 hover:text-cyan-800 font-semibold cursor-pointer"
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
              {flowStep === "luckyDraw" && (
                <LuckyDrawTab
                  meeting={activeMeeting as any}
                  canManage={canModifyActiveMeeting}
                  onRefreshMeeting={refresh}
                  onStartMeeting={() => control("start")}
                />
              )}

              {/* BƯỚC: THÀNH VIÊN TÍCH CỰC */}
              {flowStep === "activeMembers" && <ActiveMembersPanel meeting={activeMeeting} meetings={items} />}
            </div>
          </div>
        </div>
      )}

      {/* POPUP TẠO CUỘC HỌP ĐƠN LẺ / LỊCH ĐỊNH KỲ */}
      {createModal && (
        <div key={createModal} role="dialog" aria-modal="true" aria-labelledby="create-meeting-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="max-h-[90dvh] overflow-y-auto w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 id="create-meeting-title" className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-cyan-600" />
                {recurring ? "Tạo lịch định kì" : "Tạo cuộc họp BNI mới"}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                aria-label="Đóng popup tạo lịch"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={create} className="space-y-4 pt-4 text-xs">
              {!recurring && <div>
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
              </div>}

              {recurring && <>
                <MeetingRecurrenceFields value={recurrence} onChange={setRecurrence} />
              </>}

              <div className={recurring ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
                {!recurring && <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Thời gian bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <MeetingDateTimePicker
                    required
                    value={startsAt}
                    onChange={value => { setStartsAt(value); if (!endsAt || endsAt <= value) setEndsAt(defaultEnd(value)); }}
                  />
                </div>}

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

              {!recurring && <div className="text-sm font-bold text-slate-700"><label className="mb-1 block">Thời gian kết thúc cuộc họp <span className="text-rose-500">*</span></label><MeetingDateTimePicker ariaLabel="Giờ kết thúc cuộc họp" required value={endsAt} onChange={setEndsAt} /><span className="mt-1 block text-xs font-normal text-slate-500">QR dùng chung nhận check-in từ giờ bắt đầu đến trước giờ kết thúc. Mặc định 2 giờ, có thể điều chỉnh.</span></div>}

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

              <MeetingSpeakingTimeFields value={tiers} onChange={setTiers} fallbackSeconds={fallbackSeconds} onFallbackChange={setFallbackSeconds} />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModal(null)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 font-bold text-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 font-bold shadow-sm shadow-cyan-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Đang tạo..." : recurring ? "Tạo lịch định kỳ" : "Tạo cuộc họp"}
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
                    Thời gian bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <MeetingDateTimePicker
                    required
                    disabled={editingMeeting.status !== "scheduled"}
                    value={editStartsAt}
                    onChange={value => { const duration = new Date(editEndsAt + ":00+07:00").getTime() - new Date(editStartsAt + ":00+07:00").getTime(); setEditStartsAt(value); if (value) setEditEndsAt(vietnamDateTime(new Date(new Date(value + ":00+07:00").getTime() + (duration > 0 ? duration : 120 * 60000)))); }}
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

              <div className="text-sm font-bold text-slate-700"><label className="mb-1 block">Thời gian kết thúc cuộc họp <span className="text-rose-500">*</span></label><MeetingDateTimePicker ariaLabel="Giờ kết thúc cuộc họp" required value={editEndsAt} onChange={setEditEndsAt} /><span className="mt-1 block text-xs font-normal text-slate-500">QR dùng chung nhận check-in từ giờ bắt đầu đến trước giờ kết thúc. Mặc định 2 giờ, có thể điều chỉnh.</span></div>

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

              <MeetingSpeakingTimeFields value={editTiers} onChange={setEditTiers} fallbackSeconds={editFallbackSeconds} onFallbackChange={setEditFallbackSeconds} />

              {canManage && orderingMeeting && ["scheduled", "live", "paused"].includes(orderingMeeting.status) && orderingMeeting.speakers.length > 0 && <div className="mb-4 space-y-2 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">
                <h4 className="font-bold text-slate-800">Sắp xếp thứ tự thuyết trình</h4>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-48 flex-1 text-xs font-normal">Chọn người phát biểu
                    <SearchableSelect ariaLabel="Chọn người để sắp xếp" searchPlaceholder="Tìm khách hoặc thành viên..."
                      placeholder={pendingStart >= orderingMeeting.speakers.length ? "Không còn người đang chờ phát biểu" : "Chọn khách hoặc thành viên"}
                      className="mt-1" compact subtle disabled={saving}
                      value={orderingMeeting.speakers.slice(pendingStart).some(person => person.id === prioritySpeakerId) ? prioritySpeakerId : orderingMeeting.speakers[pendingStart]?.id || ""}
                      onChange={setPrioritySpeakerId}
                      options={orderingMeeting.speakers.map((person, index) => ({
                        value: person.id,
                        label: `${person.name}${index < pendingStart ? index === orderingMeeting.currentIndex ? " — Đang phát biểu" : " — Đã phát biểu" : ""}`,
                        searchText: person.name,
                        disabled: index < pendingStart,
                      }))} />
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
                {pendingStart >= orderingMeeting.speakers.length && <p role="status" className="text-xs text-slate-600">Danh sách check-in đã được tải. Các lượt đã hoàn tất hoặc đang phát biểu nên không thể đổi ưu tiên. Để thuyết trình lại, chọn người trong bước Thuyết trình rồi bấm Bắt đầu thuyết trình.</p>}
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
                {editingMeeting.seriesId && editingMeeting.status === "scheduled" && (
                  <button type="button" disabled={saving || bulkEditingLoading} onClick={() => void openBulkEditSelection()} className="rounded-xl border border-cyan-200 bg-white px-4 py-2 font-bold text-cyan-800 hover:bg-cyan-50 disabled:opacity-50">
                    {bulkEditingLoading ? <>&#272;ang t&#7843;i...</> : <>&#193;p d&#7909;ng h&#224;ng lo&#7841;t</>}
                  </button>
                )}

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
      {bulkEditingMeeting && bulkEditingChanges && <MeetingSeriesBulkEditDialog key={bulkEditingMeeting._id} meeting={bulkEditingMeeting} meetings={bulkMeetingCandidates} changes={bulkEditingChanges} loading={bulkEditingLoading} saving={bulkEditingSaving} onClose={closeBulkEditSelection} onApply={applyBulkMeetingChanges} />}
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
      {reschedulingMeeting && <RescheduleMeetingDialog key={reschedulingMeeting._id} meeting={reschedulingMeeting} onClose={() => setReschedulingMeeting(null)} onConfirm={async startsAt => {
        await api(`/${reschedulingMeeting._id}`, "PUT", { startsAt, version: reschedulingMeeting.__v });
        setCalendarMonth(vietnamDateTime(startsAt).slice(0, 7));
        await refresh();
        toast.success("Dời lịch thành công");
      }} />}
      <ConfirmDialog isOpen={Boolean(cancellingMeeting)} title="Hủy buổi họp này?" description={`Hủy cuộc họp “${cancellingMeeting?.title || ""}”? Cuộc họp sẽ được đánh dấu Đã hủy. Các buổi khác không thay đổi.`} confirmLabel="Hủy buổi họp" cancelLabel="Giữ lịch" isSubmitting={isCancelling} onClose={() => setCancellingMeeting(null)} onConfirm={async () => {
        if (!cancellingMeeting || isCancelling) return;
        setIsCancelling(true);
        try {
          await api(`/${cancellingMeeting._id}/control`, "POST", { action: "cancel", version: cancellingMeeting.__v });
          setCancellingMeeting(null);
          await refresh();
          toast.success("Đã hủy buổi họp.");
        } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể hủy cuộc họp."); }
        finally { setIsCancelling(false); }
      }} />
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
