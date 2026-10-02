import React, { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  Users,
  Search,
  RotateCcw,
  Calendar,
  Building2,
  Briefcase,
  ChevronRight,
  ChevronDown,
  UserCheck,
  UserX,
  UserPlus,
  Phone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import { meetingService, Meeting, Speaker } from "../../services/meetingService";
import { UserProfile } from "../../types/common";

type QuickTimeFilter = "all" | "month" | "quarter" | "year";
type StatusFilter = "all" | "ended" | "live" | "scheduled";

interface ExtendedSpeaker extends Speaker {
  company?: string;
  industry?: string;
  phone?: string;
  isMember: boolean;
}

const getLiveElapsedMinutes = (startsAt: string | Date): number => {
  const startTime = new Date(startsAt).getTime();
  const diffMs = Date.now() - startTime;
  if (diffMs <= 0) return 1;
  return Math.floor(diffMs / 60000);
};

export function MeetingStatisticsPanel() {
  const { userProfile } = useAuth();

  const [, setTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [chapterMembers, setChapterMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickTimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Sub-filter for single meeting attendee list
  const [attendeeRoleFilter, setAttendeeRoleFilter] = useState<"all" | "present" | "absent" | "guest">("all");
  const [attendeeSearch, setAttendeeSearch] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch meetings
      const meetingsData = await meetingService.listMeetings();
      setMeetings(meetingsData || []);

      // 2. Fetch chapter members
      let members: UserProfile[] = [];
      if (userProfile?.companyCode) {
        try {
          members = await authService.getUsersByCompany(userProfile.companyCode);
        } catch {
          try {
            members = await authService.getColleagues();
          } catch {
            members = [];
          }
        }
      } else {
        try {
          members = await authService.getColleagues();
        } catch {
          members = [];
        }
      }
      setChapterMembers(members || []);
    } catch (err) {
      console.error("Lỗi tải dữ liệu thống kê cuộc họp:", err);
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userProfile?.companyCode]);

  // Distinct member ids across system
  const totalChapterMembersCount = useMemo(() => {
    if (chapterMembers.length > 0) return chapterMembers.length;
    // Fallback: collect unique member userIds from all meetings
    const set = new Set<string>();
    meetings.forEach((m) => {
      (m.speakers || []).forEach((s) => {
        if (s.userId) set.add(String(s.userId));
      });
    });
    return set.size;
  }, [chapterMembers, meetings]);

  // Filter meetings logic
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (selectedMeetingId !== "all" && m._id !== selectedMeetingId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = m.title?.toLowerCase().includes(q);
        const matchLocation = m.location?.toLowerCase().includes(q);
        if (!matchTitle && !matchLocation) return false;
      }
      if (selectedDate) {
        const mDate = new Date(m.startsAt).toISOString().slice(0, 10);
        if (mDate !== selectedDate) return false;
      }
      if (quickFilter !== "all") {
        const now = new Date();
        const mDate = new Date(m.startsAt);
        if (quickFilter === "month") {
          if (mDate.getMonth() !== now.getMonth() || mDate.getFullYear() !== now.getFullYear()) return false;
        } else if (quickFilter === "quarter") {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const meetingQuarter = Math.floor(mDate.getMonth() / 3);
          if (currentQuarter !== meetingQuarter || mDate.getFullYear() !== now.getFullYear()) return false;
        } else if (quickFilter === "year") {
          if (mDate.getFullYear() !== now.getFullYear()) return false;
        }
      }
      if (statusFilter !== "all") {
        if (statusFilter === "ended" && m.status !== "ended") return false;
        if (statusFilter === "live" && !["live", "paused"].includes(m.status)) return false;
        if (statusFilter === "scheduled" && m.status !== "scheduled") return false;
      }
      return true;
    });
  }, [meetings, selectedMeetingId, searchQuery, selectedDate, quickFilter, statusFilter]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    let totalAttendees = 0;
    let totalMembersPresent = 0;
    let totalGuests = 0;
    let totalMembersAbsent = 0;

    filteredMeetings.forEach((m) => {
      const speakers = m.speakers || [];
      let meetingMembersCount = 0;
      speakers.forEach((s) => {
        totalAttendees += 1;
        if (s.userId) {
          totalMembersPresent += 1;
          meetingMembersCount += 1;
        } else {
          totalGuests += 1;
        }
      });
      // Absent count for this meeting
      const meetingAbsent = Math.max(0, totalChapterMembersCount - meetingMembersCount);
      totalMembersAbsent += meetingAbsent;
    });

    const completedCount = filteredMeetings.filter((m) => m.status === "ended").length;
    const liveCount = filteredMeetings.filter((m) => ["live", "paused"].includes(m.status)).length;
    const scheduledCount = filteredMeetings.filter((m) => m.status === "scheduled").length;
    const avgPerMeeting = filteredMeetings.length > 0 ? (totalAttendees / filteredMeetings.length).toFixed(1) : "0";

    // For rates and donut distribution:
    // Total pool = total checked in + total absent across the selected meetings
    const totalPool = totalMembersPresent + totalGuests + totalMembersAbsent;
    const memberPresentRate = totalPool > 0 ? Math.round((totalMembersPresent / totalPool) * 100) : 0;
    const guestRate = totalPool > 0 ? Math.round((totalGuests / totalPool) * 100) : 0;
    const absentRate = totalPool > 0 ? Math.max(0, 100 - memberPresentRate - guestRate) : 0;

    return {
      totalMeetings: filteredMeetings.length,
      completedCount,
      liveCount,
      scheduledCount,
      totalAttendees,
      totalMembersPresent,
      totalMembersAbsent,
      totalGuests,
      memberPresentRate,
      guestRate,
      absentRate,
      avgPerMeeting,
    };
  }, [filteredMeetings, totalChapterMembersCount]);

  const resetFilters = () => {
    setSelectedMeetingId("all");
    setSearchQuery("");
    setSelectedDate("");
    setQuickFilter("all");
    setStatusFilter("all");
    setAttendeeRoleFilter("all");
    setAttendeeSearch("");
  };

  const hasActiveFilters =
    selectedMeetingId !== "all" ||
    searchQuery.trim() !== "" ||
    selectedDate !== "" ||
    quickFilter !== "all" ||
    statusFilter !== "all";

  // Selected single meeting object
  const activeSingleMeeting = useMemo(() => {
    if (selectedMeetingId !== "all") {
      return meetings.find((m) => m._id === selectedMeetingId) || null;
    }
    return null;
  }, [selectedMeetingId, meetings]);

  // Absent members list for active single meeting
  const singleMeetingAbsentMembers = useMemo(() => {
    if (!activeSingleMeeting) return [];
    const presentUserIds = new Set<string>();
    const presentNames = new Set<string>();

    (activeSingleMeeting.speakers || []).forEach((s) => {
      if (s.userId) presentUserIds.add(String(s.userId));
      if (s.name) presentNames.add(s.name.trim().toLowerCase());
    });

    return chapterMembers.filter((m) => {
      const uid = String(m.uid || (m as any)._id || "");
      const name = (m.displayName || "").trim().toLowerCase();
      if (presentUserIds.has(uid)) return false;
      if (name && presentNames.has(name)) return false;
      return true;
    });
  }, [activeSingleMeeting, chapterMembers]);

  // Attendees list for selected meeting (combined present + absent when viewing single meeting)
  const singleMeetingAttendees = useMemo(() => {
    if (!activeSingleMeeting) return [];

    const presentList: Array<ExtendedSpeaker & { isAbsent?: boolean }> = (activeSingleMeeting.speakers || []).map((s: any) => ({
      ...s,
      isMember: Boolean(s.userId),
      company: s.company || s.slideProfile?.company || "",
      industry: s.industry || s.slideProfile?.industry || "",
      phone: s.phone || s.slideProfile?.phone || "",
      isAbsent: false,
    }));

    const absentList: Array<ExtendedSpeaker & { isAbsent?: boolean }> = singleMeetingAbsentMembers.map((u) => ({
      id: u.uid || `absent-${Math.random()}`,
      userId: u.uid,
      name: u.displayName || u.email?.split("@")[0] || "Thành viên",
      email: u.email,
      phone: u.phone || "",
      company: u.companyName || "",
      industry: u.industry || "",
      photoURL: u.photoURL,
      checkedInAt: "",
      seconds: 0,
      isMember: true,
      isAbsent: true,
    }));

    let combined = [...presentList];
    if (attendeeRoleFilter === "absent") {
      combined = absentList;
    } else if (attendeeRoleFilter === "all") {
      combined = [...presentList, ...absentList];
    } else if (attendeeRoleFilter === "present") {
      combined = presentList.filter((p) => p.isMember);
    } else if (attendeeRoleFilter === "guest") {
      combined = presentList.filter((p) => !p.isMember);
    }

    if (attendeeSearch.trim()) {
      const q = attendeeSearch.toLowerCase().trim();
      combined = combined.filter((item) => {
        const matchName = item.name?.toLowerCase().includes(q);
        const matchCompany = item.company?.toLowerCase().includes(q);
        const matchIndustry = item.industry?.toLowerCase().includes(q);
        return matchName || matchCompany || matchIndustry;
      });
    }

    return combined;
  }, [activeSingleMeeting, singleMeetingAbsentMembers, attendeeRoleFilter, attendeeSearch]);

  // Prepare chart series (last 8 meetings)
  const chartMeetings = useMemo(() => {
    const list = [...filteredMeetings].reverse().slice(-8);
    return list.map((m) => {
      const speakers = m.speakers || [];
      const membersPresent = speakers.filter((s) => Boolean(s.userId)).length;
      const guests = speakers.length - membersPresent;
      const membersAbsent = Math.max(0, totalChapterMembersCount - membersPresent);
      const dateStr = new Date(m.startsAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      });
      return {
        id: m._id,
        title: m.title,
        dateStr,
        totalCheckedIn: speakers.length,
        membersPresent,
        guests,
        membersAbsent,
        maxPool: Math.max(speakers.length, membersPresent + membersAbsent, 1),
      };
    });
  }, [filteredMeetings, totalChapterMembersCount]);

  const maxValInChart = Math.max(
    ...chartMeetings.map((c) => Math.max(c.totalCheckedIn, c.membersPresent + c.membersAbsent)),
    5
  );

  return (
    <div className="space-y-4 pb-8 text-slate-700">
      {/* 1. THANH ĐIỀU KHIỂN & BỘ LỌC GỌN GÀNG (Inline Compact Toolbar) */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Ô tìm kiếm tên cuộc họp */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên cuộc họp, địa điểm..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-7 text-xs font-normal text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-hidden"
            />
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Chọn buổi họp cụ thể */}
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <select
              aria-label="Chọn buổi họp"
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-3 pr-8 text-xs font-normal text-slate-700 focus:border-red-500 focus:bg-white focus:outline-hidden"
            >
              <option value="all">Tất cả cuộc họp ({meetings.length})</option>
              {meetings.map((m) => {
                const dateLabel = new Date(m.startsAt).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                });
                return (
                  <option key={m._id} value={m._id}>
                    {dateLabel} - {m.title}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Lọc ngày */}
          <div className="relative">
            <input
              type="date"
              aria-label="Lọc theo ngày"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                if (e.target.value) setQuickFilter("all");
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 px-2.5 text-xs font-normal text-slate-700 focus:border-red-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Nhóm nút thời gian */}
          <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs">
            {(
              [
                { key: "all", label: "Tất cả" },
                { key: "month", label: "Tháng này" },
                { key: "quarter", label: "Quý" },
                { key: "year", label: "Năm" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setQuickFilter(item.key);
                  setSelectedDate("");
                }}
                className={`rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                  quickFilter === item.key && !selectedDate
                    ? "bg-white font-medium text-slate-800 shadow-2xs"
                    : "font-normal text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Trạng thái */}
          <div className="relative">
            <select
              aria-label="Trạng thái"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-3 pr-7 text-xs font-normal text-slate-700 focus:border-red-500 focus:bg-white focus:outline-hidden"
            >
              <option value="all">Mọi trạng thái</option>
              <option value="ended">Đã kết thúc</option>
              <option value="live">Đang diễn ra</option>
              <option value="scheduled">Sắp tới</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Reset & Refresh */}
          <div className="flex items-center gap-1.5">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                title="Đặt lại bộ lọc"
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Đặt lại
              </button>
            )}
            <button
              onClick={fetchData}
              disabled={isLoading}
              title="Làm mới"
              className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 active:scale-95 cursor-pointer"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchData} className="underline hover:text-red-800">
            Thử lại
          </button>
        </div>
      )}

      {/* 2. CHỈ SỐ TỔNG QUAN GỌN GÀNG (5 Compact Metrics Cards với màu tươi sáng tương phản rõ) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Tổng số cuộc họp */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Tổng cuộc họp</span>
            <CalendarDays className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-slate-800">{metrics.totalMeetings}</span>
            <span className="text-xs text-slate-400">buổi</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span>Xong: {metrics.completedCount}</span>
            <span>•</span>
            <span>Sắp tới: {metrics.scheduledCount}</span>
            {metrics.liveCount > 0 && <span className="text-rose-600 font-medium">Live: {metrics.liveCount}</span>}
          </div>
        </div>

        {/* Tổng lượt tham dự */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Lượt tham dự</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-slate-800">{metrics.totalAttendees}</span>
            <span className="text-xs text-slate-400">lượt check-in</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            <span>TB: {metrics.avgPerMeeting} người/buổi</span>
          </div>
        </div>

        {/* Thành viên có mặt (Màu Đỏ tươi BNI #ef4444) */}
        <div className="rounded-2xl border border-rose-100 bg-rose-50/25 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 text-xs">
            <span>Thành viên có mặt</span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-rose-600">{metrics.totalMembersPresent}</span>
            <span className="text-xs text-rose-400">lượt</span>
            <span className="ml-auto text-xs font-medium text-rose-600">{metrics.memberPresentRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-rose-100 overflow-hidden">
            <div className="h-full rounded-full bg-rose-500 transition-all duration-300" style={{ width: `${metrics.memberPresentRate}%` }} />
          </div>
        </div>

        {/* Thành viên vắng mặt (Màu Cam cảnh báo #f97316) */}
        <div className="rounded-2xl border border-orange-100 bg-orange-50/25 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-orange-700 text-xs">
            <span>Thành viên vắng mặt</span>
            <span className="h-2 w-2 rounded-full bg-orange-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-orange-600">{metrics.totalMembersAbsent}</span>
            <span className="text-xs text-orange-400">lượt vắng</span>
            <span className="ml-auto text-xs font-medium text-orange-600">{metrics.absentRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
            <div className="h-full rounded-full bg-orange-500 transition-all duration-300" style={{ width: `${metrics.absentRate}%` }} />
          </div>
        </div>

        {/* Khách mời (Màu Xanh da trời tươi sáng #0ea5e9 tương phản hoàn hảo) */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/25 p-3.5 shadow-2xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-sky-700 text-xs">
            <span>Khách mời</span>
            <span className="h-2 w-2 rounded-full bg-sky-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-sky-600">{metrics.totalGuests}</span>
            <span className="text-xs text-sky-400">người</span>
            <span className="ml-auto text-xs font-medium text-sky-600">{metrics.guestRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-sky-100 overflow-hidden">
            <div className="h-full rounded-full bg-sky-500 transition-all duration-300" style={{ width: `${metrics.guestRate}%` }} />
          </div>
        </div>
      </div>

      {/* 3. BIỂU ĐỒ (Màu sắc tươi sáng, tương phản cao, thể hiện Thành viên có mặt, vắng mặt & khách mời) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Biểu đồ cột: Lượt tham dự theo từng cuộc họp */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800">
                Thống kê tham dự & vắng mặt theo từng cuộc họp
              </span>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-rose-500 inline-block" />
                  Có mặt ({metrics.totalMembersPresent})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-sky-500 inline-block" />
                  Khách mời ({metrics.totalGuests})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-orange-400 inline-block" />
                  Vắng mặt ({metrics.totalMembersAbsent})
                </span>
              </div>
            </div>

            {/* Cột hiển thị */}
            <div className="mt-4 min-h-[190px] flex flex-col justify-end">
              {chartMeetings.length === 0 ? (
                <div className="flex h-44 items-center justify-center text-xs text-slate-400">
                  Không có cuộc họp trong khoảng lọc này.
                </div>
              ) : (
                <div className="flex items-end justify-between gap-3 sm:gap-6 h-48 pt-4 px-1">
                  {chartMeetings.map((item) => {
                    const totalBarVal = item.membersPresent + item.guests + item.membersAbsent;
                    const totalH = Math.min(100, Math.round((totalBarVal / (maxValInChart || 1)) * 100));

                    const presentShare = totalBarVal > 0 ? (item.membersPresent / totalBarVal) * 100 : 0;
                    const guestShare = totalBarVal > 0 ? (item.guests / totalBarVal) * 100 : 0;
                    const absentShare = totalBarVal > 0 ? (item.membersAbsent / totalBarVal) * 100 : 0;

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedMeetingId(item.id)}
                        className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
                        title={`${item.title} (${item.dateStr}):\n• Thành viên có mặt: ${item.membersPresent}\n• Khách mời: ${item.guests}\n• Thành viên vắng: ${item.membersAbsent}\n• Tổng check-in: ${item.totalCheckedIn}`}
                      >
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 group-hover:text-rose-600 transition-colors">
                          <span className="text-slate-800">{item.totalCheckedIn}</span>
                          {item.membersAbsent > 0 && (
                            <span className="text-[10px] text-orange-500 font-normal">(-{item.membersAbsent})</span>
                          )}
                        </div>

                        {/* Stacked Bar with 3 contrasting colors */}
                        <div
                          className="w-full max-w-10 rounded-t-md overflow-hidden flex flex-col-reverse transition-all group-hover:brightness-95"
                          style={{ height: `${Math.max(totalH, 8)}%` }}
                        >
                          {/* Member Present: Vibrant Rose/Red */}
                          <div className="bg-rose-500 transition-all" style={{ height: `${presentShare}%` }} title={`Có mặt: ${item.membersPresent}`} />
                          {/* Guest: Bright Sky Blue */}
                          <div className="bg-sky-500 transition-all" style={{ height: `${guestShare}%` }} title={`Khách mời: ${item.guests}`} />
                          {/* Member Absent: Bright Coral/Orange */}
                          <div className="bg-orange-400 transition-all" style={{ height: `${absentShare}%` }} title={`Vắng mặt: ${item.membersAbsent}`} />
                        </div>

                        <span className="text-[11px] font-normal text-slate-500 group-hover:text-rose-600 transition-colors truncate max-w-full">
                          {item.dateStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Bấm vào cột để xem danh sách chi tiết có mặt & vắng mặt của buổi đó</span>
            <span>Hiển thị {chartMeetings.length} buổi gần nhất</span>
          </div>
        </div>

        {/* Biểu đồ Donut: Cơ cấu người tham dự & Vắng mặt */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800">
                Cơ cấu Thành viên & Khách mời
              </span>
            </div>

            <div className="flex flex-col items-center justify-center my-4">
              <div className="relative h-36 w-36">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 180 180" aria-label="Cơ cấu tham dự và vắng mặt">
                  <circle cx="90" cy="90" r="66" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                  {metrics.totalMembersPresent + metrics.totalGuests + metrics.totalMembersAbsent > 0 ? (
                    <>
                      {/* Segment 1: Thành viên có mặt (Rose/Red) */}
                      <circle
                        cx="90"
                        cy="90"
                        r="66"
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="20"
                        strokeDasharray={`${(metrics.memberPresentRate / 100) * 414.69} ${414.69}`}
                        strokeDashoffset="0"
                      />
                      {/* Segment 2: Khách mời (Sky Blue) */}
                      <circle
                        cx="90"
                        cy="90"
                        r="66"
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth="20"
                        strokeDasharray={`${(metrics.guestRate / 100) * 414.69} ${414.69}`}
                        strokeDashoffset={`-${(metrics.memberPresentRate / 100) * 414.69}`}
                      />
                      {/* Segment 3: Thành viên vắng mặt (Orange) */}
                      <circle
                        cx="90"
                        cy="90"
                        r="66"
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="20"
                        strokeDasharray={`${(metrics.absentRate / 100) * 414.69} ${414.69}`}
                        strokeDashoffset={`-${((metrics.memberPresentRate + metrics.guestRate) / 100) * 414.69}`}
                      />
                    </>
                  ) : (
                    <circle cx="90" cy="90" r="66" fill="none" stroke="#e2e8f0" strokeWidth="20" />
                  )}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">Tổng lượt</span>
                  <span className="text-xl font-semibold text-slate-800">
                    {metrics.totalAttendees}
                  </span>
                  <span className="text-[10px] text-slate-400">check-in</span>
                </div>
              </div>

              {/* Chú thích 3 màu tương phản rõ rệt */}
              <div className="w-full space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Thành viên có mặt
                  </span>
                  <span className="font-medium text-slate-800">
                    {metrics.totalMembersPresent} ({metrics.memberPresentRate}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Khách mời
                  </span>
                  <span className="font-medium text-slate-800">
                    {metrics.totalGuests} ({metrics.guestRate}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    Thành viên vắng mặt
                  </span>
                  <span className="font-medium text-slate-800">
                    {metrics.totalMembersAbsent} ({metrics.absentRate}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            {metrics.totalMembersAbsent === 0
              ? "100% thành viên tham gia đầy đủ"
              : `Tỷ lệ vắng mặt: ${metrics.absentRate}%`}
          </div>
        </div>
      </div>

      {/* 4. DANH SÁCH CHI TIẾT */}
      {activeSingleMeeting ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => setSelectedMeetingId("all")}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  ← Tất cả cuộc họp
                </button>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">
                  {new Date(activeSingleMeeting.startsAt).toLocaleDateString("vi-VN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
                <span className="text-slate-300">•</span>
                {activeSingleMeeting.status === "live" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-300 px-2 py-0.5 text-[10px] font-bold text-green-700 shadow-2xs">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-80" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                    <span className="animate-pulse">Đang diễn ra {getLiveElapsedMinutes(activeSingleMeeting.startsAt)} phút</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    {activeSingleMeeting.status === "ended" ? "Đã kết thúc" : "Đã lên lịch"}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{activeSingleMeeting.title}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Lọc vai trò người tham dự + vắng mặt */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setAttendeeRoleFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    attendeeRoleFilter === "all" ? "bg-white text-slate-800 font-medium shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Tất cả ({activeSingleMeeting.speakers?.length || 0 + singleMeetingAbsentMembers.length})
                </button>
                <button
                  onClick={() => setAttendeeRoleFilter("present")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    attendeeRoleFilter === "present" ? "bg-white text-rose-600 font-medium shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Có mặt ({(activeSingleMeeting.speakers || []).filter((s) => Boolean(s.userId)).length})
                </button>
                <button
                  onClick={() => setAttendeeRoleFilter("guest")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    attendeeRoleFilter === "guest" ? "bg-white text-sky-600 font-medium shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Khách mời ({(activeSingleMeeting.speakers || []).filter((s) => !s.userId).length})
                </button>
                <button
                  onClick={() => setAttendeeRoleFilter("absent")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    attendeeRoleFilter === "absent" ? "bg-white text-orange-600 font-medium shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Vắng mặt ({singleMeetingAbsentMembers.length})
                </button>
              </div>

              {/* Tìm người */}
              <input
                type="text"
                value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
                placeholder="Tìm tên, công ty..."
                className="w-36 sm:w-44 rounded-lg border border-slate-200 bg-slate-50/50 py-1 px-2.5 text-xs text-slate-700 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {singleMeetingAttendees.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Không có người nào phù hợp với bộ lọc này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10">STT</th>
                    <th className="py-2.5 px-3">Họ tên</th>
                    <th className="py-2.5 px-3">Trạng thái / Vai trò</th>
                    <th className="py-2.5 px-3">Doanh nghiệp / Ngành nghề</th>
                    <th className="py-2.5 px-3">Giờ check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {singleMeetingAttendees.map((att, idx) => (
                    <tr key={att.id || idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-800 block">{att.name}</span>
                        {att.phone && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {att.phone}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {att.isAbsent ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                            <UserX className="h-3 w-3" />
                            Vắng mặt
                          </span>
                        ) : att.isMember ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                            <UserCheck className="h-3 w-3" />
                            Thành viên có mặt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                            <UserPlus className="h-3 w-3" />
                            Khách mời
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {att.company || att.industry ? (
                          <span>
                            {att.company}
                            {att.company && att.industry && " — "}
                            {att.industry}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {att.checkedInAt
                          ? new Date(att.checkedInAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : att.isAbsent
                          ? "Chưa check-in"
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-800">
              Danh sách cuộc họp ({filteredMeetings.length})
            </span>
            <span className="text-[11px] text-slate-400">Bấm vào hàng để xem danh sách có mặt & vắng mặt</span>
          </div>

          {filteredMeetings.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Không tìm thấy cuộc họp nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Tên cuộc họp</th>
                    <th className="py-2.5 px-3">Ngày diễn ra</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3 text-center">Thành viên có mặt</th>
                    <th className="py-2.5 px-3 text-center">Thành viên vắng</th>
                    <th className="py-2.5 px-3 text-center">Khách mời</th>
                    <th className="py-2.5 px-3 text-center">Tổng tham dự</th>
                    <th className="py-2.5 px-3 text-center">Tỷ lệ khách</th>
                    <th className="py-2.5 px-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMeetings.map((m) => {
                    const speakers = m.speakers || [];
                    const memberCount = speakers.filter((s) => Boolean(s.userId)).length;
                    const guestCount = speakers.length - memberCount;
                    const absentCount = Math.max(0, totalChapterMembersCount - memberCount);
                    const guestRatio = speakers.length > 0 ? Math.round((guestCount / speakers.length) * 100) : 0;

                    return (
                      <tr
                        key={m._id}
                        onClick={() => setSelectedMeetingId(m._id)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-medium text-slate-800">{m.title}</td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {new Date(m.startsAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {m.status === "live" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 border border-green-300 px-2 py-0.5 text-[10px] font-bold text-green-700 shadow-2xs">
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-80" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                              </span>
                              <span className="animate-pulse">
                                Đang diễn ra {getLiveElapsedMinutes(m.startsAt)} phút
                              </span>
                            </span>
                          ) : (
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${
                                m.status === "ended"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-sky-50 text-sky-600"
                              }`}
                            >
                              {m.status === "ended" ? "Đã kết thúc" : "Đã lên lịch"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-600 font-medium">
                          {memberCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          {absentCount > 0 ? (
                            <span className="text-orange-600">{absentCount}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-sky-600 font-medium">{guestCount}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-800">{speakers.length}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{guestRatio}%</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMeetingId(m._id);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer"
                          >
                            <span>Xem</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
