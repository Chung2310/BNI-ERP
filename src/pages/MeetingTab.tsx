import React, { useCallback, useEffect, useState } from "react";
import { MeetingCheckInPanel } from "../components/meetings/MeetingCheckInPanel";
import { MeetingLocationFields } from "../components/meetings/MeetingLocationFields";
import { MeetingCoverImageField } from "../components/meetings/MeetingCoverImageField";
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
  PowerOff,
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
  coverImage?: string;
  startsAt: string;
  reminderDays: number;
  status: "scheduled" | "live" | "paused" | "ended" | "cancelled";
  speakers: Speaker[];
  tiers: Array<{ count: number; seconds: number }>;
  fallbackSeconds: number;
  currentIndex: number;
  speakerStartedAt?: string;
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

const dateText = (s: string) =>
  new Date(s).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });

export default function MeetingTab() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("meetings:manage") || hasPermission("access:manage");

  const [items, setItems] = useState<Meeting[]>([]);
  const [detailMeetingId, setDetailMeetingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"checkin" | "speakers" | "luckyDraw">("checkin");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "live" | "ended">("all");
  const [tick, setTick] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [finishRequested, setFinishRequested] = useState(false);

  // Create Meeting Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [gpsPoint, setGpsPoint] = useState<{latitude:number;longitude:number}|null>(null);
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

  // Guest Checkin state inside detail modal
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next: Meeting[] = await api("");
      setItems(next);
    } catch (e: any) {
      toast.error(e.message || "Không thể tải danh sách cuộc họp");
    }
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
        coverImage,
        reminderDays,
        tiers,
        fallbackSeconds,
      });
      setTitle("");
      setStartsAt("");
      setLocation("");
      setGpsPoint(null);
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
    setEditTitle(m.title);
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
    if (endingMeeting.status !== "live" && endingMeeting.status !== "paused") {
      toast.error("Chỉ có thể kết thúc khi cuộc họp đang diễn ra.");
      return;
    }
    setIsEnding(true);
    try {
      await api(`/${endingMeeting._id}/control`, "POST", { action: "finish", version: endingMeeting.__v });
      toast.success(`Đã kết thúc buổi họp "${endingMeeting.title}"`);
      setEndingMeeting(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Không thể kết thúc cuộc họp.");
    } finally {
      setIsEnding(false);
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

  const control = async (action: string): Promise<void> => {
    if (!activeMeeting) return;
    const actionLabels: Record<string, string> = {
      start: "Bắt đầu cuộc họp",
      pause: "Tạm dừng cuộc họp",
      resume: "Tiếp tục cuộc họp",
      next: "Chuyển người tiếp theo",
      finish: "Kết thúc cuộc họp",
    };
    await run(async () => {
      await api(`/${activeMeeting._id}/control`, "POST", { action, version: activeMeeting.__v });
      toast.success(actionLabels[action] || "Cập nhật trạng thái thành công");
    });
  };

  const reorder = (index: number, delta: number) => {
    if (!activeMeeting) return;
    const copy = [...activeMeeting.speakers];
    const next = index + delta;
    if (next < 0 || next >= copy.length) return;
    [copy[index], copy[next]] = [copy[next], copy[index]];
    void run(() =>
      api(`/${activeMeeting._id}/order`, "PUT", { version: activeMeeting.__v, speakerIds: copy.map((s) => s.id) })
    );
  };

  const current = activeMeeting && ["live", "paused"].includes(activeMeeting.status) ? activeMeeting.speakers[activeMeeting.currentIndex] : undefined;
  const upcoming = activeMeeting && !["ended", "cancelled"].includes(activeMeeting.status) ? activeMeeting.speakers[activeMeeting.status === "scheduled" ? 0 : activeMeeting.currentIndex + 1] : undefined;
  const elapsed = activeMeeting
    ? activeMeeting.elapsedSeconds +
    (activeMeeting.status === "live" && activeMeeting.speakerStartedAt
      ? Math.max(0, (tick - new Date(activeMeeting.speakerStartedAt).getTime()) / 1000)
      : 0)
    : 0;
  const remaining = current ? current.seconds - elapsed : 0;

  const statusMap: Record<string, { label: string; badge: string; dot: string; border: string }> = {
    scheduled: {
      label: "Sắp diễn ra",
      badge: "bg-amber-50 text-amber-700 border-amber-200/70",
      dot: "bg-amber-500",
      border: "border-amber-200 hover:border-amber-300",
    },
    live: {
      label: "Đang diễn ra",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
      dot: "bg-emerald-500 animate-pulse",
      border: "border-emerald-300 hover:border-emerald-400 shadow-emerald-500/10",
    },
    paused: {
      label: "Đang tạm dừng",
      badge: "bg-sky-50 text-sky-700 border-sky-200/70",
      dot: "bg-sky-500",
      border: "border-sky-200 hover:border-sky-300",
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

  const filteredItems = items.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.location && m.location.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "scheduled") return m.status === "scheduled";
    if (statusFilter === "live") return m.status === "live" || m.status === "paused";
    if (statusFilter === "ended") return m.status === "ended" || m.status === "cancelled";
    return true;
  });

  return (
    <div className="mx-auto max-h-[85vh] max-w-7xl overflow-y-auto px-0.5 pb-8 text-left sm:pr-2" id="meeting_tab_view">
      {/* Header bar */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-600 to-teal-700 rounded-2xl shadow-sm text-white shrink-0">
              <CalendarDays className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-xl md:text-2xl tracking-tight">
                Quản lý buổi họp
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Lên lịch → Đón tiếp & check-in → Điều hành phát biểu → Quay thưởng
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
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
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
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-2xs transition-all duration-200 hover:shadow-md cursor-pointer ${s.border}`}
              >
                {/* Top Cover / Header Image */}
                <div className="relative h-36 w-full overflow-hidden bg-slate-100">
                  {m.coverImage ? (
                    <img
                      src={m.coverImage}
                      alt={m.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 p-4 flex flex-col justify-between text-white">
                      <CalendarDays className="h-8 w-8 text-cyan-400/40" />
                      <span className="text-[11px] font-mono text-slate-400">BNI CHAPTER MEETING</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-black/20" />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border backdrop-blur-md ${s.badge}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>

                  {/* Top Action Icons (Kết thúc, Sửa, Xóa) */}
                  {canManage && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
                      {isLive && (
                        <button
                          type="button"
                          title="Kết thúc cuộc họp"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEndingMeeting(m);
                          }}
                          className="rounded-xl bg-white/80 backdrop-blur-md p-1.5 text-slate-700 hover:bg-rose-50 hover:text-rose-600 shadow-sm transition cursor-pointer"
                        >
                          <PowerOff className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Sửa cuộc họp"
                        onClick={(e) => openEditModal(m, e)}
                        className="rounded-xl bg-white/80 backdrop-blur-md p-1.5 text-slate-700 hover:bg-white hover:text-cyan-700 shadow-sm transition cursor-pointer"
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
                        className="rounded-xl bg-white/80 backdrop-blur-md p-1.5 text-slate-700 hover:bg-rose-50 hover:text-rose-600 shadow-sm transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Time preview on image bottom */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center gap-1.5 text-xs text-white/95 font-medium drop-shadow-sm">
                    <Clock3 className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                    <span className="truncate">{dateText(m.startsAt)}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-2 group-hover:text-cyan-700 transition">
                      {m.title}
                    </h3>

                    {m.location && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 line-clamp-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{m.location}</span>
                      </p>
                    )}
                  </div>

                  {/* Stats Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
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
                  </div>
                </div>

                {/* Card Footer: Action Button */}
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); setDetailMeetingId(m._id); setActiveSubTab(m.status === "scheduled" ? "checkin" : "speakers"); }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-50 group-hover:bg-cyan-600 text-slate-700 group-hover:text-white py-2 text-xs font-bold transition-all duration-200 cursor-pointer"
                  >
                    <span>{isLive ? "Tiếp tục điều hành" : m.status === "scheduled" ? "Mở buổi họp & check-in" : "Xem buổi họp"}</span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  {canManage && isLive && (
                    <button
                      type="button"
                      title="Kết thúc buổi họp"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEndingMeeting(m);
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-600 text-rose-700 hover:text-white px-3 py-2 text-xs font-bold transition-all duration-150 cursor-pointer shrink-0 shadow-2xs"
                    >
                      <PowerOff className="h-3.5 w-3.5" />
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
            Không có cuộc họp nào phù hợp với bộ lọc hiện tại. Bấm nút bên dưới để tạo cuộc họp mới.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Tạo cuộc họp mới
            </button>
          )}
        </div>
      )}

      {/* POPUP CHI TIẾT CUỘC HỌP (Meeting Detail Modal) */}
      {activeMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-6xl max-h-[94vh] flex flex-col rounded-3xl bg-slate-50 shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                    <span
                      className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0 ${statusMap[activeMeeting.status]?.badge || "bg-slate-100 text-slate-600"
                        }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusMap[activeMeeting.status]?.dot}`} />
                      {statusMap[activeMeeting.status]?.label || activeMeeting.status}
                    </span>
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
                <div className="flex overflow-x-auto bg-slate-100 p-1 rounded-xl"><button type="button" onClick={() => setActiveSubTab("checkin")} aria-pressed={activeSubTab === "checkin"} className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 aria-pressed:bg-white aria-pressed:text-cyan-700">Check-in ({activeMeeting.speakers.length})</button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("speakers")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-bold transition cursor-pointer ${activeSubTab === "speakers"
                      ? "bg-white text-cyan-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Điều hành</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab("luckyDraw")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-bold transition cursor-pointer ${activeSubTab === "luckyDraw"
                      ? "bg-cyan-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
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

                <button
                  type="button"
                  title="Đóng popup"
                  onClick={() => setDetailMeetingId(null)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
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
                          <h2 className="mt-1 text-xl md:text-2xl font-black text-white">{activeMeeting.title}</h2>
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
                        <h2 className="mt-1 text-xl font-extrabold text-slate-800">{activeMeeting.title}</h2>
                      </div>
                    )}

                    {/* Meeting Actions & Status Bar */}
                    <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-white">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold border ${statusMap[activeMeeting.status]?.badge || "bg-slate-100 text-slate-600"
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
                  {canManage && activeMeeting.status === "scheduled" && (
                          <button
                            type="button"
                            onClick={() => control("start")}
                            disabled={!activeMeeting.speakers.length || saving}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer disabled:opacity-40"
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
                              className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                            >
                              <Pause className="h-3.5 w-3.5" />
                              Tạm dừng
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => control("next")}
                              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm shadow-cyan-600/20 transition cursor-pointer"
                            >
                              Người tiếp theo ❯
                            </button>

                            <button
                              type="button"
                              onClick={() => setFinishRequested(true)}
                              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 text-xs font-bold transition cursor-pointer"
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
                              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
                            >
                              <Play className="h-3.5 w-3.5" fill="currentColor" />
                              Tiếp tục
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => control("next")}
                              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                            >
                              Người tiếp theo ❯
                            </button>
                            <button type="button" disabled={saving} onClick={() => setFinishRequested(true)} className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white">Kết thúc</button>
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
                        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                          <Megaphone className="h-4 w-4 text-cyan-600" />
                          Diễn giả hiện tại
                        </span>
                        {current && (
                          <span className="text-[11px] font-mono text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md font-bold">
                            {fmt(current.seconds)} mục tiêu
                          </span>
                        )}
                      </div>

                      {current ? (
                        <div className="my-4 flex items-center gap-4">
                          {current.coverImage || current.photoURL ? (
                            <img
                              src={current.coverImage || current.photoURL}
                              alt={current.name}
                              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-cyan-500/30"
                            />
                          ) : (
                            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cyan-100 font-extrabold text-cyan-800 text-xl">
                              {current.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-extrabold text-base text-slate-800">{current.name}</h3>
                            <p className="truncate text-xs text-slate-500">{current.email || "Khách mời"}</p>
                            <span className="mt-1 inline-block text-[11px] font-bold text-cyan-700 bg-cyan-50/80 px-2 py-0.5 rounded-md">
                              Lượt thứ {activeMeeting.currentIndex + 1} / {activeMeeting.speakers.length}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">
                          Chưa có diễn giả nào đang phát biểu.
                        </div>
                      )}

                      {/* Timer Display */}
                      <div className="rounded-xl bg-slate-50 p-3.5 flex items-center justify-between">
                        <span className="text-xs text-slate-600 font-medium">Thời gian còn lại:</span>
                        <span
                          className={`font-mono text-2xl font-black ${remaining < 0
                            ? "text-rose-600 animate-pulse"
                            : remaining < 10
                              ? "text-amber-500"
                              : "text-slate-800"
                            }`}
                        >
                          {remaining < 0 ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}
                        </span>
                      </div>
                    </div>

                    {/* Upcoming Speaker Card */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          Diễn giả tiếp theo
                        </span>
                        {upcoming && (
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                            {fmt(upcoming.seconds)}
                          </span>
                        )}
                      </div>

                      {upcoming ? (
                        <div className="my-4 flex items-center gap-4">
                          {upcoming.coverImage || upcoming.photoURL ? (
                            <img
                              src={upcoming.coverImage || upcoming.photoURL}
                              alt={upcoming.name}
                              className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 font-extrabold text-slate-600 text-xl">
                              {upcoming.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-extrabold text-base text-slate-800">{upcoming.name}</h3>
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
                        <span className="font-bold text-slate-700">{activeMeeting.speakers.length} người</span>
                      </div>
                    </div>
                  </div>}

                  </>)}
                  {activeSubTab === "checkin" && <MeetingCheckInPanel key={activeMeeting._id} meeting={activeMeeting} canManage={canManage} api={api} onRefresh={refresh} onConfigure={() => openEditModal(activeMeeting)} onOperate={() => setActiveSubTab("speakers")} />}
                  {/* Guest Checkin Form (MC / Admin) */}
                  {canManage && activeSubTab === "checkin" && ["scheduled", "live", "paused"].includes(activeMeeting.status) && (
                    <form
                      onSubmit={addGuest}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-wrap items-center gap-3"
                    >
                      <span className="font-bold text-xs text-slate-700 shrink-0">MC ghi nhận khách tại chỗ:</span>
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
                        className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 text-xs font-bold transition cursor-pointer disabled:opacity-40"
                      >
                        Check-in khách
                      </button>
                    </form>
                  )}

                  {/* Speakers Queue Table */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <Users className="h-4 w-4 text-cyan-600" />
                      {activeSubTab === "checkin" ? "Người đã check-in · thứ tự phát biểu" : "Danh sách thứ tự phát biểu"} ({activeMeeting.speakers.length})
                    </h3>

                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {activeMeeting.speakers.map((p, i) => {
                        const isSpeaking = i === activeMeeting.currentIndex && activeMeeting.status === "live";
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${isSpeaking
                              ? "border border-cyan-300 bg-cyan-50/70 shadow-2xs"
                              : "border border-slate-200/60 bg-slate-50/50 hover:bg-slate-50"
                              }`}
                          >
                            <span className="w-6 text-center font-mono text-xs font-bold text-slate-400">
                              {i + 1}
                            </span>

                            {p.coverImage || p.photoURL ? (
                              <img
                                src={p.coverImage || p.photoURL}
                                alt={p.name}
                                className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-100 font-bold text-xs text-cyan-700">
                                {p.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}

                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold text-slate-800">{p.name}</span>
                              <span className="text-[11px] text-slate-500">
                                {p.email || "Khách mời"} • {p.seconds} giây
                              </span>
                            </div>

                            {isSpeaking && (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Megaphone className="h-3 w-3 animate-bounce" /> Đang nói
                              </span>
                            )}

                            {canManage && activeMeeting.status === "scheduled" && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title="Đưa lên trên"
                                  onClick={() => reorder(i, -1)}
                                  disabled={!i}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 disabled:opacity-20 cursor-pointer"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  title="Đưa xuống dưới"
                                  onClick={() => reorder(i, 1)}
                                  disabled={i + 1 >= activeMeeting.speakers.length}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 disabled:opacity-20 cursor-pointer"
                                >
                                  ▼
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {!activeMeeting.speakers.length && (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Chưa có ai check-in vào cuộc họp này.
                        </div>
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
                  <input
                    required
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none"
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
                  <input
                    required
                    type="datetime-local"
                    value={editStartsAt}
                    onChange={(e) => setEditStartsAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none"
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

      <ConfirmDialog isOpen={finishRequested} title="Kết thúc buổi họp?" description="Sau khi kết thúc, buổi họp ngừng nhận check-in và điều hành phát biểu." confirmLabel="Kết thúc buổi họp" isSubmitting={saving} onClose={() => setFinishRequested(false)} onConfirm={async () => { await control("finish"); setFinishRequested(false); }} />
      {/* POPUP XÁC NHẬN KẾT THÚC CUỘC HỌP */}
      <ConfirmDialog
        isOpen={!!endingMeeting}
        title="Kết thúc buổi họp?"
        description={`Bạn có chắc chắn muốn kết thúc buổi họp "${endingMeeting?.title}"? Trạng thái cuộc họp sẽ được chuyển sang "Đã kết thúc" và ngừng nhận check-in.`}
        tone="warning"
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
