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
  Gift,
  Trophy,
  Award,
  Ticket,
  Crown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import { meetingService, Meeting, Speaker } from "../../services/meetingService";
import { socketService } from "../../services/socketService";
import { UserProfile } from "../../types/common";
import { VietnameseDatePicker } from "../common/VietnameseDatePicker";

type QuickTimeFilter = "all" | "month" | "quarter" | "year";
type StatusFilter = "all" | "ended" | "live" | "scheduled";

export const drawSourceLabels = { wheel: "Vòng quay may mắn", bingo: "Lồng cầu bingo", draw: "Bốc thăm" };

export interface LuckyDrawWinnerRecord {
  source: keyof typeof drawSourceLabels;
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  ticketNumber?: number;
  verificationHash?: string;
  wonAt?: string;
  drawnBy?: string;
  prizeId: string;
  prizeName: string;
  reward?: string;
  color?: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
}

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

export const extractLuckyWinners = (meeting: Meeting): LuckyDrawWinnerRecord[] => {
  const result: LuckyDrawWinnerRecord[] = [];
  const prizes = meeting.luckyDraw?.prizes || [];
  prizes.forEach((p) => {
    (p.winners || []).forEach((w) => {
      result.push({
        source: w.source || "draw",
        id: w.id || `${p.id}-${w.name}-${w.wonAt || Math.random()}`,
        name: w.name,
        email: w.email,
        photoURL: w.photoURL,
        ticketNumber: w.ticketNumber,
        verificationHash: w.verificationHash,
        wonAt: w.wonAt,
        drawnBy: w.drawnBy,
        prizeId: p.id,
        prizeName: p.name,
        reward: p.reward,
        color: p.color,
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        meetingDate: meeting.startsAt ? new Date(meeting.startsAt).toISOString() : "",
      });
    });
  });
  for (const w of meeting.gameWinners || []) {
    result.push({ ...w, source: w.source || "draw", meetingId: meeting._id,
      meetingTitle: meeting.title, meetingDate: meeting.startsAt ? new Date(meeting.startsAt).toISOString() : "" });
  }
  return result;
};

function LuckyWinnersTable({
  winners,
  showMeetingInfo = false,
  onSelectMeeting,
}: {
  winners: LuckyDrawWinnerRecord[];
  showMeetingInfo?: boolean;
  onSelectMeeting?: (meetingId: string) => void;
}) {
  if (winners.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        <Gift className="h-8 w-8 mx-auto mb-2 text-slate-300" />
        Chưa có người trúng giải nào trong danh sách này.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
          <tr>
            <th className="py-2.5 px-3 w-10">STT</th>
            <th className="py-2.5 px-3">Người trúng thưởng</th>
            {showMeetingInfo && <th className="py-2.5 px-3">Cuộc họp</th>}
            <th className="py-2.5 px-3">Loại hình</th>
            <th className="py-2.5 px-3">Giải thưởng</th>
            <th className="py-2.5 px-3">Phần quà / Giá trị</th>
            <th className="py-2.5 px-3 text-center">Số vé</th>
            <th className="py-2.5 px-3">Thời gian</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {winners.map((w, idx) => {
            const initial = (w.name || "?").trim().charAt(0).toUpperCase();
            return (
              <tr key={`${w.meetingId}-${w.source}-${w.id || idx}`} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2.5">
                    {w.photoURL ? (
                      <img
                        src={w.photoURL}
                        alt={w.name}
                        className="h-8 w-8 rounded-full object-cover border border-slate-200 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 font-semibold text-amber-700 text-xs">
                        {initial}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-slate-800 block">{w.name}</span>
                      {w.email && <span className="text-[11px] text-slate-400 block">{w.email}</span>}
                    </div>
                  </div>
                </td>
                {showMeetingInfo && (
                  <td className="py-2.5 px-3">
                    {onSelectMeeting ? (
                      <button
                        onClick={() => onSelectMeeting(w.meetingId)}
                        className="text-left font-medium text-rose-600 hover:underline max-w-[200px] truncate block cursor-pointer"
                        title={w.meetingTitle}
                      >
                        {w.meetingTitle}
                      </button>
                    ) : (
                      <span className="font-medium text-slate-700 max-w-[200px] truncate block" title={w.meetingTitle}>
                        {w.meetingTitle}
                      </span>
                    )}
                    {w.meetingDate && (
                      <span className="text-[11px] text-slate-400">
                        {new Date(w.meetingDate).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </td>
                )}
                <td className="py-2.5 px-3 whitespace-nowrap">{drawSourceLabels[w.source]}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border shadow-2xs"
                    style={{
                      backgroundColor: w.color ? `${w.color}15` : "#fef3c7",
                      borderColor: w.color ? `${w.color}40` : "#fde68a",
                      color: w.color || "#b45309",
                    }}
                  >
                    <Award className="h-3 w-3" />
                    {w.prizeName}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-medium text-slate-700">
                  {w.reward ? (
                    <span className="inline-flex items-center gap-1">
                      <Gift className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>{w.reward}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Theo quy định BTC</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  {w.ticketNumber !== undefined ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                      <Ticket className="h-3 w-3 text-slate-400" />#{w.ticketNumber}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                  {w.wonAt ? (
                    <div>
                      <span className="block font-medium text-slate-700">
                        {new Date(w.wonAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(w.wonAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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

  // Tab switch in "all meetings" mode: "meetings" list or "winners" list
  const [allMeetingsTab, setAllMeetingsTab] = useState<"meetings" | "winners">("meetings");
  const [winnerSearch, setWinnerSearch] = useState("");

  // Sub-filter for single meeting attendee list
  const [attendeeRoleFilter, setAttendeeRoleFilter] = useState<"all" | "present" | "absent" | "guest" | "lucky">("all");
  const [attendeeSearch, setAttendeeSearch] = useState("");

  // Animation & Interactive Hover States
  const [isAnimated, setIsAnimated] = useState(false);
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<"present" | "guest" | "absent" | null>(null);

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
    const refreshWinners = () => { void meetingService.listMeetings().then(setMeetings).catch(console.error); };
    const off = socketService.on("lucky_draw_spun", refreshWinners);
    window.addEventListener("focus", refreshWinners);
    return () => { off(); window.removeEventListener("focus", refreshWinners); };
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

  useEffect(() => {
    setIsAnimated(false);
    const timer = setTimeout(() => setIsAnimated(true), 60);
    return () => clearTimeout(timer);
  }, [filteredMeetings, selectedMeetingId]);

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

    // Lucky draw winners across filtered meetings
    let totalLuckyWinners = 0;
    filteredMeetings.forEach((m) => {
      totalLuckyWinners += extractLuckyWinners(m).length;
    });

    const completedCount = filteredMeetings.filter((m) => m.status === "ended").length;
    const liveCount = filteredMeetings.filter((m) => ["live", "paused"].includes(m.status)).length;
    const scheduledCount = filteredMeetings.filter((m) => m.status === "scheduled").length;
    const avgPerMeeting = filteredMeetings.length > 0 ? Math.ceil(totalAttendees / filteredMeetings.length) : 0;

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
      totalWinners: totalLuckyWinners,
      memberPresentRate,
      guestRate,
      absentRate,
      avgPerMeeting,
    };
  }, [filteredMeetings, totalChapterMembersCount]);

  // Aggregate lucky draw winners for all filtered meetings
  const allFilteredLuckyWinners = useMemo(() => {
    const list: LuckyDrawWinnerRecord[] = [];
    filteredMeetings.forEach((m) => {
      list.push(...extractLuckyWinners(m));
    });
    return list.sort((a, b) => {
      const timeA = a.wonAt ? new Date(a.wonAt).getTime() : new Date(a.meetingDate).getTime();
      const timeB = b.wonAt ? new Date(b.wonAt).getTime() : new Date(b.meetingDate).getTime();
      return timeB - timeA;
    });
  }, [filteredMeetings]);

  // Lucky winners list with search filter
  const displayedFilteredLuckyWinners = useMemo(() => {
    if (!winnerSearch.trim()) return allFilteredLuckyWinners;
    const q = winnerSearch.toLowerCase().trim();
    return allFilteredLuckyWinners.filter((w) => {
      const matchName = w.name?.toLowerCase().includes(q);
      const matchPrize = w.prizeName?.toLowerCase().includes(q);
      const matchReward = w.reward?.toLowerCase().includes(q);
      const matchMeeting = w.meetingTitle?.toLowerCase().includes(q);
      return matchName || matchPrize || matchReward || matchMeeting || drawSourceLabels[w.source].toLowerCase().includes(q);
    });
  }, [allFilteredLuckyWinners, winnerSearch]);

  const resetFilters = () => {
    setSelectedMeetingId("all");
    setSearchQuery("");
    setSelectedDate("");
    setQuickFilter("all");
    setStatusFilter("all");
    setAllMeetingsTab("meetings");
    setWinnerSearch("");
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

  // Lucky winners for single meeting
  const singleMeetingWinners = useMemo(() => {
    if (!activeSingleMeeting) return [];
    return extractLuckyWinners(activeSingleMeeting).sort((a, b) => {
      const timeA = a.wonAt ? new Date(a.wonAt).getTime() : 0;
      const timeB = b.wonAt ? new Date(b.wonAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [activeSingleMeeting]);

  const displayedSingleMeetingWinners = useMemo(() => {
    if (!attendeeSearch.trim()) return singleMeetingWinners;
    const q = attendeeSearch.toLowerCase().trim();
    return singleMeetingWinners.filter((w) => {
      const matchName = w.name?.toLowerCase().includes(q);
      const matchPrize = w.prizeName?.toLowerCase().includes(q);
      const matchReward = w.reward?.toLowerCase().includes(q);
      return matchName || matchPrize || matchReward;
    });
  }, [singleMeetingWinners, attendeeSearch]);

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

  // Ranking calculation for active members
  const memberRankings = useMemo(() => {
    const memberMap = new Map<
      string,
      {
        id: string;
        name: string;
        email?: string;
        photoURL?: string;
        companyName?: string;
        industry?: string;
        attendedCount: number;
        earlyCount: number;
        totalEarlyMinutes: number;
      }
    >();

    // Seed from chapterMembers
    chapterMembers.forEach((u: any) => {
      const uid = String(u.uid || u._id || u.id || "");
      if (!uid) return;
      memberMap.set(uid, {
        id: uid,
        name: u.displayName || u.fullName || u.email?.split("@")[0] || "Thành viên",
        email: u.email,
        photoURL: u.photoURL,
        companyName: u.companyName,
        industry: u.industry,
        attendedCount: 0,
        earlyCount: 0,
        totalEarlyMinutes: 0,
      });
    });

    // Aggregate attendance and early arrival across filteredMeetings
    filteredMeetings.forEach((m) => {
      const startsAtTime = new Date(m.startsAt).getTime();
      const speakers = m.speakers || [];
      speakers.forEach((s) => {
        if (!s.userId) return; // Skip guests
        const uid = String(s.userId);
        let entry = memberMap.get(uid);
        if (!entry) {
          entry = {
            id: uid,
            name: s.name || s.email || "Thành viên",
            email: s.email,
            photoURL: s.photoURL,
            companyName: "",
            industry: "",
            attendedCount: 0,
            earlyCount: 0,
            totalEarlyMinutes: 0,
          };
          memberMap.set(uid, entry);
        }

        entry.attendedCount += 1;
        if (s.checkedInAt) {
          const checkedInTime = new Date(s.checkedInAt).getTime();
          if (!isNaN(checkedInTime) && !isNaN(startsAtTime)) {
            const diffMinutes = Math.round((startsAtTime - checkedInTime) / 60000);
            const clamped = Math.max(-30, Math.min(90, diffMinutes));
            entry.totalEarlyMinutes += clamped;
            if (diffMinutes >= 5) {
              entry.earlyCount += 1;
            }
          }
        }
      });
    });

    const totalEligibleMeetings = filteredMeetings.length || 1;

    const list = Array.from(memberMap.values()).map((mem) => {
      const avgEarlyMinutes =
        mem.attendedCount > 0 ? Math.round(mem.totalEarlyMinutes / mem.attendedCount) : 0;
      const attendanceRate = Math.round((mem.attendedCount / totalEligibleMeetings) * 100);

      // Score: attendance (max 60) + punctuality (max 40)
      const attendanceScore = attendanceRate * 0.6;
      const punctualityScore = Math.min(
        40,
        Math.max(0, avgEarlyMinutes * 1.5) + mem.earlyCount * 2
      );
      const score = Math.round(attendanceScore + punctualityScore);

      return {
        ...mem,
        avgEarlyMinutes,
        attendanceRate,
        score,
      };
    });

    // Sort descending by: attendedCount -> avgEarlyMinutes -> score
    list.sort((a, b) => {
      if (b.attendedCount !== a.attendedCount) return b.attendedCount - a.attendedCount;
      if (b.avgEarlyMinutes !== a.avgEarlyMinutes) return b.avgEarlyMinutes - a.avgEarlyMinutes;
      return b.score - a.score;
    });

    return list;
  }, [chapterMembers, filteredMeetings]);

  const topFiveMembers = useMemo(() => memberRankings.slice(0, 5), [memberRankings]);
  const nextFiveMembers = useMemo(() => memberRankings.slice(5, 10), [memberRankings]);

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

          {/* Lọc ngày (Việt hóa) */}
          <VietnameseDatePicker
            ariaLabel="Lọc theo ngày"
            value={selectedDate}
            onChange={(val) => {
              setSelectedDate(val);
              if (val) setQuickFilter("all");
            }}
            placeholder="Lọc theo ngày..."
            className="w-36 sm:w-40"
          />

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

      {/* 2. CHỈ SỐ TỔNG QUAN GỌN GÀNG (6 Compact Metrics Cards với animation & hover mượt mà) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Tổng số cuộc họp */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Tổng cuộc họp</span>
            <CalendarDays className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-800">{metrics.totalMeetings}</span>
            <span className="text-xs text-slate-400">buổi</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span>Xong: {metrics.completedCount}</span>
            <span>•</span>
            <span>Sắp tới: {metrics.scheduledCount}</span>
            {metrics.liveCount > 0 && <span className="text-rose-600 font-medium animate-pulse">Live: {metrics.liveCount}</span>}
          </div>
        </div>

        {/* Tổng lượt tham dự */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Lượt tham dự</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-800">{metrics.totalAttendees}</span>
            <span className="text-xs text-slate-400">lượt</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            <span>TB: {metrics.avgPerMeeting} người/buổi</span>
          </div>
        </div>

        {/* Thành viên có mặt (Màu Đỏ tươi BNI #ef4444) */}
        <div className="rounded-2xl border border-rose-100 bg-rose-50/25 p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between text-rose-700 text-xs">
            <span>Thành viên có mặt</span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-rose-600">{metrics.totalMembersPresent}</span>
            <span className="text-xs text-rose-400">lượt</span>
            <span className="ml-auto text-xs font-semibold text-rose-600">{metrics.memberPresentRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-rose-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-1000 ease-out"
              style={{ width: isAnimated ? `${metrics.memberPresentRate}%` : "0%" }}
            />
          </div>
        </div>

        {/* Thành viên vắng mặt (Màu Cam cảnh báo #f97316) */}
        <div className="rounded-2xl border border-orange-100 bg-orange-50/25 p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between text-orange-700 text-xs">
            <span>Thành viên vắng mặt</span>
            <span className="h-2 w-2 rounded-full bg-orange-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-orange-600">{metrics.totalMembersAbsent}</span>
            <span className="text-xs text-orange-400">lượt</span>
            <span className="ml-auto text-xs font-semibold text-orange-600">{metrics.absentRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1000 ease-out"
              style={{ width: isAnimated ? `${metrics.absentRate}%` : "0%" }}
            />
          </div>
        </div>

        {/* Khách mời (Màu Xanh da trời tươi sáng #0ea5e9 tương phản hoàn hảo) */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/25 p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between text-sky-700 text-xs">
            <span>Khách mời</span>
            <span className="h-2 w-2 rounded-full bg-sky-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-sky-600">{metrics.totalGuests}</span>
            <span className="text-xs text-sky-400">người</span>
            <span className="ml-auto text-xs font-semibold text-sky-600">{metrics.guestRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-sky-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500 transition-all duration-1000 ease-out"
              style={{ width: isAnimated ? `${metrics.guestRate}%` : "0%" }}
            />
          </div>
        </div>

        {/* Người trúng giải quay thưởng (Màu Vàng Amber sang trọng #f59e0b) */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between text-amber-700 text-xs">
            <span>Trúng giải quay</span>
            <Gift className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-amber-600">{metrics.totalWinners}</span>
            <span className="text-xs text-amber-500/80">lượt</span>
          </div>
        </div>
      </div>

      {/* 3. BIỂU ĐỒ (Màu sắc tươi sáng, tương phản cao, hoạt ảnh mọc cột & tương tác 2 chiều) */}
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

            {/* Cột hiển thị với Animation & Gridlines */}
            <div className="mt-4 min-h-[200px] relative flex flex-col justify-end">
              {/* Gridlines mờ phía sau */}
              <div className="absolute inset-x-0 bottom-6 top-2 flex flex-col justify-between pointer-events-none px-2 z-0">
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-slate-200/60 w-full" />
              </div>

              {chartMeetings.length === 0 ? (
                <div className="flex h-44 items-center justify-center text-xs text-slate-400 z-10">
                  Không có cuộc họp trong khoảng lọc này.
                </div>
              ) : (
                <div className="flex items-end justify-between gap-3 sm:gap-6 h-48 pt-4 px-2 z-10">
                  {chartMeetings.map((item, idx) => {
                    const totalBarVal = item.membersPresent + item.guests + item.membersAbsent;
                    const totalH = Math.min(100, Math.round((totalBarVal / (maxValInChart || 1)) * 100));

                    const presentShare = totalBarVal > 0 ? (item.membersPresent / totalBarVal) * 100 : 0;
                    const guestShare = totalBarVal > 0 ? (item.guests / totalBarVal) * 100 : 0;
                    const absentShare = totalBarVal > 0 ? (item.membersAbsent / totalBarVal) * 100 : 0;

                    const isHovered = hoveredBarId === item.id;
                    const isOtherHovered = hoveredBarId !== null && !isHovered;

                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setHoveredBarId(item.id)}
                        onMouseLeave={() => setHoveredBarId(null)}
                        onClick={() => setSelectedMeetingId(item.id)}
                        className={`flex flex-1 flex-col items-center gap-1.5 h-full justify-end group cursor-pointer transition-all duration-300 ${
                          isOtherHovered ? "opacity-45 scale-95" : isHovered ? "scale-105" : "opacity-100"
                        }`}
                        title={`${item.title} (${item.dateStr}):\n• Thành viên có mặt: ${item.membersPresent}\n• Khách mời: ${item.guests}\n• Thành viên vắng: ${item.membersAbsent}\n• Tổng check-in: ${item.totalCheckedIn}`}
                      >
                        {/* Tooltip / Badge số nổi lên khi hover */}
                        <div
                          className={`flex items-center gap-1 text-[11px] font-medium transition-all duration-300 rounded-full px-1.5 py-0.5 ${
                            isHovered
                              ? "bg-slate-900 text-white shadow-md -translate-y-1 scale-110"
                              : "text-slate-600 group-hover:text-rose-600"
                          }`}
                        >
                          <span className={isHovered ? "font-bold text-white" : "text-slate-800"}>
                            {item.totalCheckedIn}
                          </span>
                          {item.membersAbsent > 0 && (
                            <span className={isHovered ? "text-orange-300 text-[10px]" : "text-[10px] text-orange-500 font-normal"}>
                              (-{item.membersAbsent})
                            </span>
                          )}
                        </div>

                        {/* Stacked Bar with 3 contrasting vibrant colors & smooth growth animation */}
                        <div
                          className="w-full max-w-10 rounded-t-md overflow-hidden flex flex-col-reverse shadow-xs transition-all duration-700 ease-out group-hover:shadow-md"
                          style={{
                            height: isAnimated ? `${Math.max(totalH, 8)}%` : "0%",
                            transitionDelay: `${idx * 60}ms`,
                          }}
                        >
                          {/* Member Present: Vibrant Rose Gradient */}
                          <div
                            className="bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-500"
                            style={{ height: `${presentShare}%` }}
                            title={`Có mặt: ${item.membersPresent}`}
                          />
                          {/* Guest: Bright Sky Blue Gradient */}
                          <div
                            className="bg-gradient-to-t from-sky-600 to-sky-400 transition-all duration-500"
                            style={{ height: `${guestShare}%` }}
                            title={`Khách mời: ${item.guests}`}
                          />
                          {/* Member Absent: Bright Coral/Amber Gradient */}
                          <div
                            className="bg-gradient-to-t from-orange-500 to-amber-400 transition-all duration-500"
                            style={{ height: `${absentShare}%` }}
                            title={`Vắng mặt: ${item.membersAbsent}`}
                          />
                        </div>

                        <span
                          className={`text-[11px] font-normal transition-all duration-200 truncate max-w-full ${
                            isHovered ? "font-bold text-rose-600 scale-105" : "text-slate-500 group-hover:text-rose-600"
                          }`}
                        >
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

        {/* Biểu đồ Donut: Cơ cấu người tham dự & Vắng mặt với tương tác 2 chiều */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800">
                Cơ cấu Thành viên & Khách mời
              </span>
            </div>

            <div className="flex flex-col items-center justify-center my-4">
              <div className="relative h-40 w-40">
                <svg className="h-full w-full -rotate-90 overflow-visible" viewBox="0 0 180 180" aria-label="Cơ cấu tham dự và vắng mặt">
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
                        strokeWidth={hoveredSegment === "present" ? 25 : 20}
                        opacity={hoveredSegment && hoveredSegment !== "present" ? 0.4 : 1}
                        strokeDasharray={
                          isAnimated
                            ? `${(metrics.memberPresentRate / 100) * 414.69} ${414.69}`
                            : `0 ${414.69}`
                        }
                        strokeDashoffset="0"
                        className="transition-all duration-700 ease-out cursor-pointer"
                        onMouseEnter={() => setHoveredSegment("present")}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                      {/* Segment 2: Khách mời (Sky Blue) */}
                      <circle
                        cx="90"
                        cy="90"
                        r="66"
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth={hoveredSegment === "guest" ? 25 : 20}
                        opacity={hoveredSegment && hoveredSegment !== "guest" ? 0.4 : 1}
                        strokeDasharray={
                          isAnimated
                            ? `${(metrics.guestRate / 100) * 414.69} ${414.69}`
                            : `0 ${414.69}`
                        }
                        strokeDashoffset={`-${(metrics.memberPresentRate / 100) * 414.69}`}
                        className="transition-all duration-700 ease-out cursor-pointer"
                        onMouseEnter={() => setHoveredSegment("guest")}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                      {/* Segment 3: Thành viên vắng mặt (Orange) */}
                      <circle
                        cx="90"
                        cy="90"
                        r="66"
                        fill="none"
                        stroke="#f97316"
                        strokeWidth={hoveredSegment === "absent" ? 25 : 20}
                        opacity={hoveredSegment && hoveredSegment !== "absent" ? 0.4 : 1}
                        strokeDasharray={
                          isAnimated
                            ? `${(metrics.absentRate / 100) * 414.69} ${414.69}`
                            : `0 ${414.69}`
                        }
                        strokeDashoffset={`-${((metrics.memberPresentRate + metrics.guestRate) / 100) * 414.69}`}
                        className="transition-all duration-700 ease-out cursor-pointer"
                        onMouseEnter={() => setHoveredSegment("absent")}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                    </>
                  ) : (
                    <circle cx="90" cy="90" r="66" fill="none" stroke="#e2e8f0" strokeWidth="20" />
                  )}
                </svg>

                {/* Tâm Donut: Hiển thị thông số động khi hover */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none transition-all duration-300">
                  {hoveredSegment === "present" ? (
                    <div className="animate-fadeIn">
                      <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wide">Có mặt</span>
                      <span className="text-2xl font-extrabold text-rose-600 block">{metrics.totalMembersPresent}</span>
                      <span className="text-[10px] text-rose-500 font-medium">{metrics.memberPresentRate}% tổng lượt</span>
                    </div>
                  ) : hoveredSegment === "guest" ? (
                    <div className="animate-fadeIn">
                      <span className="text-[10px] text-sky-500 font-bold uppercase tracking-wide">Khách mời</span>
                      <span className="text-2xl font-extrabold text-sky-600 block">{metrics.totalGuests}</span>
                      <span className="text-[10px] text-sky-500 font-medium">{metrics.guestRate}% tổng lượt</span>
                    </div>
                  ) : hoveredSegment === "absent" ? (
                    <div className="animate-fadeIn">
                      <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wide">Vắng mặt</span>
                      <span className="text-2xl font-extrabold text-orange-600 block">{metrics.totalMembersAbsent}</span>
                      <span className="text-[10px] text-orange-500 font-medium">{metrics.absentRate}% tổng lượt</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Tổng lượt</span>
                      <span className="text-2xl font-extrabold text-slate-800 block">
                        {metrics.totalAttendees}
                      </span>
                      <span className="text-[10px] text-slate-400">check-in</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chú thích 3 màu tương phản rõ rệt - Hover kích hoạt tương tác Donut */}
              <div className="w-full space-y-1.5 pt-2">
                <div
                  onMouseEnter={() => setHoveredSegment("present")}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className={`flex items-center justify-between text-xs p-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    hoveredSegment === "present" ? "bg-rose-50/80 shadow-2xs scale-[1.02]" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Thành viên có mặt
                  </span>
                  <span className={`font-semibold ${hoveredSegment === "present" ? "text-rose-600" : "text-slate-800"}`}>
                    {metrics.totalMembersPresent} ({metrics.memberPresentRate}%)
                  </span>
                </div>

                <div
                  onMouseEnter={() => setHoveredSegment("guest")}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className={`flex items-center justify-between text-xs p-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    hoveredSegment === "guest" ? "bg-sky-50/80 shadow-2xs scale-[1.02]" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Khách mời
                  </span>
                  <span className={`font-semibold ${hoveredSegment === "guest" ? "text-sky-600" : "text-slate-800"}`}>
                    {metrics.totalGuests} ({metrics.guestRate}%)
                  </span>
                </div>

                <div
                  onMouseEnter={() => setHoveredSegment("absent")}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className={`flex items-center justify-between text-xs p-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    hoveredSegment === "absent" ? "bg-orange-50/80 shadow-2xs scale-[1.02]" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    Thành viên vắng mặt
                  </span>
                  <span className={`font-semibold ${hoveredSegment === "absent" ? "text-orange-600" : "text-slate-800"}`}>
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

      {/* 4. BẢNG XẾP HẠNG THÀNH VIÊN TÍCH CỰC (Top 5 bục podium cao thấp, Top 1 ở giữa, Top 6-10 danh sách) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
                Bảng xếp hạng thành viên tích cực
              </h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Top {Math.min(10, memberRankings.length)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Xếp hạng theo số buổi điểm danh tham gia và thói quen đến sớm chuẩn giờ
            </p>
          </div>
        </div>

        {memberRankings.length === 0 || topFiveMembers.every((m) => m.attendedCount === 0) ? (
          <div className="py-10 text-center text-xs text-slate-400">
            <Trophy className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p>Chưa có dữ liệu điểm danh thành viên trong khoảng thời gian đã chọn.</p>
          </div>
        ) : (
          <div className="pt-6">
            {/* Top 5 - Bục Podium 5 cột cao thấp, Top 1 ở chính giữa (#4 - #2 - #1 - #3 - #5) */}
            {(() => {
              const PODIUM_SLOTS = [
                {
                  rankIndex: 3, // #4 (ngoài cùng bên trái)
                  rankNum: 4,
                  heightClass: "h-28 sm:h-36",
                  bgColor: "bg-blue-500",
                  textColor: "text-white",
                  dividerColor: "border-white/20",
                  borderColor: "border-blue-400/50",
                  badgeColor: "bg-blue-500 text-white font-semibold ring-2 ring-white shadow-2xs",
                  ringColor: "ring-2 ring-blue-400",
                },
                {
                  rankIndex: 1, // #2 (trái giữa)
                  rankNum: 2,
                  heightClass: "h-44 sm:h-52",
                  bgColor: "bg-red-500",
                  textColor: "text-white",
                  dividerColor: "border-white/20",
                  borderColor: "border-red-400/50",
                  badgeColor: "bg-red-500 text-white font-semibold ring-2 ring-white shadow-2xs",
                  ringColor: "ring-2 ring-red-400",
                },
                {
                  rankIndex: 0, // #1 (CHÍNH GIỮA - TOP 1 QUÁN QUÂN)
                  rankNum: 1,
                  heightClass: "h-56 sm:h-64",
                  bgColor: "bg-yellow-400",
                  textColor: "text-slate-900",
                  dividerColor: "border-slate-900/15",
                  borderColor: "border-yellow-400 shadow-sm",
                  badgeColor: "bg-amber-500 text-white font-semibold ring-2 ring-white shadow-2xs",
                  ringColor: "ring-2 ring-yellow-400",
                  isTop1: true,
                },
                {
                  rankIndex: 2, // #3 (phải giữa)
                  rankNum: 3,
                  heightClass: "h-36 sm:h-44",
                  bgColor: "bg-green-500",
                  textColor: "text-white",
                  dividerColor: "border-white/20",
                  borderColor: "border-green-400/50",
                  badgeColor: "bg-green-500 text-white font-semibold ring-2 ring-white shadow-2xs",
                  ringColor: "ring-2 ring-green-400",
                },
                {
                  rankIndex: 4, // #5 (ngoài cùng bên phải)
                  rankNum: 5,
                  heightClass: "h-22 sm:h-28",
                  bgColor: "bg-orange-500",
                  textColor: "text-white",
                  dividerColor: "border-white/20",
                  borderColor: "border-orange-400/50",
                  badgeColor: "bg-orange-500 text-white font-semibold ring-2 ring-white shadow-2xs",
                  ringColor: "ring-2 ring-orange-400",
                },
              ];

              return (
                <div className="grid grid-cols-5 gap-2 sm:gap-4 items-end min-h-[300px] sm:min-h-[340px] px-1 sm:px-4 pb-2 border-b border-slate-100">
                  {PODIUM_SLOTS.map((slot) => {
                    const m = topFiveMembers[slot.rankIndex];

                    if (!m) {
                      return (
                        <div key={`empty-${slot.rankNum}`} className="flex flex-col items-center justify-end h-full opacity-40">
                          <div className="flex flex-col items-center mb-2.5 w-full">
                            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 text-xs font-medium mb-1.5 bg-slate-50/50">
                              #{slot.rankNum}
                            </div>
                            <p className="text-xs text-slate-400 text-center font-normal">Chờ thành viên</p>
                            <p className="text-[10px] text-slate-300 text-center">-</p>
                          </div>
                          <div
                            className={`w-full max-w-[70px] sm:max-w-[110px] rounded-t-xl sm:rounded-t-2xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center py-2 px-1 text-slate-400 ${slot.heightClass}`}
                          >
                            <span className="text-xs font-normal text-slate-300">#{slot.rankNum}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={m.id || `rank-${slot.rankNum}`} className="flex flex-col items-center justify-end h-full group">
                        {/* Header info above column: Avatar & Name */}
                        <div className="flex flex-col items-center mb-2.5 w-full">
                          {slot.isTop1 && (
                            <Crown className="h-4 w-4 text-amber-500 fill-amber-400 drop-shadow-xs -mb-0.5" />
                          )}
                          <div className="relative mb-1.5">
                            {m.photoURL ? (
                              <img
                                src={m.photoURL}
                                alt={m.name}
                                className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover shadow-2xs ${slot.ringColor}`}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div
                                className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600 text-xs sm:text-sm shadow-2xs ${slot.ringColor}`}
                              >
                                {(m.name || "?").trim().charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span
                              className={`absolute -bottom-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full text-[10px] sm:text-xs ${slot.badgeColor}`}
                            >
                              #{slot.rankNum}
                            </span>
                          </div>

                          <p
                            className="text-xs font-medium text-slate-700 text-center truncate max-w-[70px] sm:max-w-[120px]"
                            title={m.name}
                          >
                            {m.name}
                          </p>
                          {m.companyName && (
                            <p
                              className="text-[10px] text-slate-400 text-center truncate max-w-[70px] sm:max-w-[120px]"
                              title={m.companyName}
                            >
                              {m.companyName}
                            </p>
                          )}
                        </div>

                        {/* The Pillar / Column bar */}
                        <div
                          className={`w-full max-w-[70px] sm:max-w-[110px] rounded-t-xl sm:rounded-t-2xl border flex flex-col items-center justify-between py-2.5 sm:py-3 px-1 transition-all duration-300 ease-out group-hover:scale-[1.02] ${slot.heightClass} ${slot.bgColor} ${slot.borderColor} ${slot.textColor}`}
                        >
                          <div className="text-center">
                            <span className="block text-xs sm:text-sm font-semibold tracking-normal">
                              {m.attendedCount} buổi
                            </span>
                            <span className="block text-[10px] font-normal opacity-90 mt-0.5">
                              {m.attendanceRate}%
                            </span>
                          </div>

                          <div className={`text-center border-t ${slot.dividerColor} pt-1.5 w-full`}>
                            <span className="block text-[10px] font-medium opacity-90 truncate">
                              {m.avgEarlyMinutes > 0
                                ? `Sớm +${m.avgEarlyMinutes}p`
                                : m.attendedCount > 0
                                ? "Đúng giờ"
                                : "Chưa họp"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Top 6 to 10 - Danh sách dạng bảng gọn gàng */}
            {nextFiveMembers.length > 0 && (
              <div className="mt-5 pt-3">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    Thành viên tiếp theo (Hạng 6 - 10)
                  </p>
                  <span className="text-[11px] text-slate-400">
                    Hiển thị {nextFiveMembers.length} thành viên
                  </span>
                </div>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
                  {nextFiveMembers.map((m, idx) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 sm:px-4 hover:bg-slate-50/80 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 font-mono font-medium text-slate-500 text-xs">
                          #{idx + 6}
                        </span>
                        {m.photoURL ? (
                          <img
                            src={m.photoURL}
                            alt={m.name}
                            className="h-8 w-8 rounded-full object-cover border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-medium text-slate-600 text-xs shrink-0">
                            {(m.name || "?").trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{m.name}</p>
                          {m.companyName && (
                            <p className="text-[10px] text-slate-400 truncate">{m.companyName}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-6 text-right shrink-0">
                        <div>
                          <span className="font-semibold text-slate-700">{m.attendedCount}</span>
                          <span className="text-slate-400 ml-1">buổi ({m.attendanceRate}%)</span>
                        </div>
                        <span
                          className={`text-[11px] font-normal px-2 py-0.5 rounded-full ${
                            m.avgEarlyMinutes > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : m.attendedCount > 0
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {m.avgEarlyMinutes > 0
                            ? `Sớm +${m.avgEarlyMinutes}p`
                            : m.attendedCount > 0
                            ? "Đúng giờ"
                            : "Chưa họp"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
              {/* Lọc vai trò người tham dự + vắng mặt + trúng giải */}
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
                <button
                  onClick={() => setAttendeeRoleFilter("lucky")}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                    attendeeRoleFilter === "lucky" ? "bg-white text-amber-700 font-medium shadow-2xs" : "text-slate-500"
                  }`}
                >
                  <Gift className="h-3 w-3 text-amber-500" />
                  Trúng giải ({singleMeetingWinners.length})
                </button>
              </div>

              {/* Tìm người */}
              <input
                type="text"
                value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
                placeholder={attendeeRoleFilter === "lucky" ? "Tìm tên, giải, quà..." : "Tìm tên, công ty..."}
                className="w-36 sm:w-48 rounded-lg border border-slate-200 bg-slate-50/50 py-1 px-2.5 text-xs text-slate-700 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {attendeeRoleFilter === "lucky" ? (
            <LuckyWinnersTable winners={displayedSingleMeetingWinners} />
          ) : singleMeetingAttendees.length === 0 ? (
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setAllMeetingsTab("meetings")}
                  className={`px-3 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                    allMeetingsTab === "meetings"
                      ? "bg-white text-slate-800 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Danh sách cuộc họp ({filteredMeetings.length})
                </button>
                <button
                  onClick={() => setAllMeetingsTab("winners")}
                  className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
                    allMeetingsTab === "winners"
                      ? "bg-white text-amber-700 shadow-2xs"
                      : "text-slate-500 hover:text-amber-700"
                  }`}
                >
                  <Gift className="h-3.5 w-3.5 text-amber-500" />
                  Người trúng giải ({allFilteredLuckyWinners.length})
                </button>
              </div>
            </div>

            {allMeetingsTab === "meetings" ? (
              <span className="text-[11px] text-slate-400">
                Bấm vào hàng để xem danh sách có mặt, vắng mặt & trúng giải
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={winnerSearch}
                  onChange={(e) => setWinnerSearch(e.target.value)}
                  placeholder="Tìm người trúng, quà, cuộc họp..."
                  className="w-48 sm:w-60 rounded-lg border border-slate-200 bg-slate-50/50 py-1 px-2.5 text-xs text-slate-700 focus:bg-white focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {allMeetingsTab === "winners" ? (
            <LuckyWinnersTable
              winners={displayedFilteredLuckyWinners}
              showMeetingInfo={true}
              onSelectMeeting={(meetingId) => setSelectedMeetingId(meetingId)}
            />
          ) : filteredMeetings.length === 0 ? (
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
                    <th className="py-2.5 px-3 text-center">Trúng giải</th>
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
                    const luckyCount = extractLuckyWinners(m).length;

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
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {luckyCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              <Gift className="h-3 w-3 text-amber-500" />
                              {luckyCount} giải
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
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
