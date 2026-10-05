import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trophy } from "lucide-react";
import { ActiveMemberLeaderboard } from "../components/rankings/ActiveMemberLeaderboard";
import { MemberAbsenceLeaderboard } from "../components/rankings/MemberAbsenceLeaderboard";
import { VietnameseDatePicker } from "../components/common/VietnameseDatePicker";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { meetingService, type Meeting } from "../services/meetingService";
import { socketService } from "../services/socketService";
import type { UserProfile } from "../types";

type QuickTimeFilter = "all" | "month" | "quarter" | "year";
type StatusFilter = "all" | "ended" | "live" | "scheduled";

export default function RankingsTab() {
  const { userProfile } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMeetingId, setSelectedMeetingId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickTimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const companyCode = userProfile?.companyCode;

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const fetchData = async () => {
      const currentRequest = ++requestId;
      setIsLoading(true);
      setError(null);
      try {
        const membersRequest = companyCode
          ? authService.getUsersByCompany(companyCode).catch(() => authService.getColleagues())
          : authService.getColleagues();
        const [meetingData, memberData] = await Promise.all([
          meetingService.listMeetings({ all: true }),
          membersRequest,
        ]);
        if (!active || currentRequest !== requestId) return;
        setMeetings(meetingData || []);
        setMembers(memberData || []);
      } catch (err) {
        if (!active || currentRequest !== requestId) return;
        setError(err instanceof Error ? err.message : "Không thể tải dữ liệu bảng xếp hạng.");
      } finally {
        if (active && currentRequest === requestId) setIsLoading(false);
      }
    };
    const refresh = () => { void fetchData(); };
    refresh();
    const offMeeting = socketService.on("meeting_updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      offMeeting();
      window.removeEventListener("focus", refresh);
    };
  }, [companyCode, userProfile?.uid, refreshKey]);

  const filteredMeetings = useMemo(() => {
    const now = new Date();
    const query = searchQuery.trim().toLocaleLowerCase("vi");
    return meetings.filter((meeting) => {
      if (selectedMeetingId !== "all" && meeting._id !== selectedMeetingId) return false;
      if (query && ![meeting.title, meeting.location].some(value => value?.toLocaleLowerCase("vi").includes(query))) return false;
      const date = new Date(meeting.startsAt);
      if (selectedDate) {
        const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
        if (localDate !== selectedDate) return false;
      }
      if (quickFilter !== "all") {
        if (date.getFullYear() !== now.getFullYear()) return false;
        if (quickFilter === "month" && date.getMonth() !== now.getMonth()) return false;
        if (quickFilter === "quarter" && Math.floor(date.getMonth() / 3) !== Math.floor(now.getMonth() / 3)) return false;
      }
      if (statusFilter === "live") return ["live", "paused"].includes(meeting.status);
      return statusFilter === "all" || meeting.status === statusFilter;
    });
  }, [meetings, selectedMeetingId, searchQuery, selectedDate, quickFilter, statusFilter]);

  const resetFilters = () => {
    setSelectedMeetingId("all");
    setSearchQuery("");
    setSelectedDate("");
    setQuickFilter("all");
    setStatusFilter("all");
  };
  const hasActiveFilters = selectedMeetingId !== "all" || searchQuery !== "" || selectedDate !== "" || quickFilter !== "all" || statusFilter !== "all";
  const inputClassName = "rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:border-red-500 focus:bg-white focus:outline-hidden";

  return (
    <div className="mx-auto max-h-[85vh] max-w-7xl space-y-4 overflow-y-auto px-0.5 pb-8 text-left sm:pr-2" id="rankings_tab_view">
      <div className="flex items-center gap-2.5 border-b border-slate-200/80 pb-3">
        <Trophy className="h-6 w-6 shrink-0 text-amber-500" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl">Bảng xếp hạng</h1>
          <p className="mt-1 text-xs text-slate-500">Theo dõi mức độ tham gia, vắng mặt và check-in muộn của thành viên.</p>
        </div>
      </div>

      <section aria-label="Bộ lọc bảng xếp hạng" className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
        <input
          aria-label="Tìm cuộc họp"
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
          placeholder="Tìm theo tên cuộc họp, địa điểm..."
          className={inputClassName + " min-w-[200px] flex-1"}
        />
        <select aria-label="Chọn buổi họp" value={selectedMeetingId} onChange={event => setSelectedMeetingId(event.target.value)} className={inputClassName + " w-full sm:w-64"}>
          <option value="all">Tất cả cuộc họp ({meetings.length})</option>
          {meetings.map(meeting => <option key={meeting._id} value={meeting._id}>
            {new Date(meeting.startsAt).toLocaleDateString("vi-VN")} - {meeting.title}
          </option>)}
        </select>
        <VietnameseDatePicker
          ariaLabel="Lọc theo ngày"
          value={selectedDate}
          onChange={value => { setSelectedDate(value); if (value) setQuickFilter("all"); }}
          placeholder="Lọc theo ngày..."
          className="w-36 sm:w-40"
        />
        <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs">
          {([
            { key: "all", label: "Tất cả" },
            { key: "month", label: "Tháng này" },
            { key: "quarter", label: "Quý" },
            { key: "year", label: "Năm" },
          ] as const).map(item => <button
            key={item.key}
            type="button"
            aria-pressed={quickFilter === item.key && !selectedDate}
            onClick={() => { setQuickFilter(item.key); setSelectedDate(""); }}
            className={"rounded-lg px-2.5 py-1 " + (quickFilter === item.key && !selectedDate ? "bg-white font-medium text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
          >{item.label}</button>)}
        </div>
        <select aria-label="Trạng thái" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} className={inputClassName}>
          <option value="all">Mọi trạng thái</option>
          <option value="ended">Đã kết thúc</option>
          <option value="live">Đang diễn ra</option>
          <option value="scheduled">Sắp tới</option>
        </select>
        {hasActiveFilters && <button type="button" onClick={resetFilters} className={inputClassName + " hover:bg-slate-100"}>Đặt lại</button>}
        <button type="button" aria-label="Làm mới bảng xếp hạng" title="Làm mới" disabled={isLoading} onClick={() => setRefreshKey(value => value + 1)} className={inputClassName + " hover:bg-slate-100 disabled:opacity-50"}>
          <RotateCcw className={"h-4 w-4" + (isLoading ? " animate-spin" : "")} />
        </button>
      </section>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => setRefreshKey(value => value + 1)} className="mt-2 font-semibold underline">Thử lại</button>
        </div>
      ) : (
        <>
          <ActiveMemberLeaderboard members={members} meetings={filteredMeetings} loading={isLoading} />
          <MemberAbsenceLeaderboard members={members} meetings={filteredMeetings} loading={isLoading} />
        </>
      )}
    </div>
  );
}
