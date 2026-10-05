import { useMemo } from "react";
import { Crown, Trophy, Users } from "lucide-react";
import type { UserProfile } from "../../types/common";
import type { Meeting } from "../../services/meetingService";

export function ActiveMemberLeaderboard({ members: chapterMembers, meetings: filteredMeetings, loading }: {
  members: UserProfile[];
  meetings: Meeting[];
  loading: boolean;
}) {
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
    chapterMembers.filter(member => member.role !== "admin" && member.isActive !== false).forEach((u: UserProfile & { _id?: string; id?: string; fullName?: string }) => {
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
        const entry = memberMap.get(uid);
        // Only rank eligible members from the roster; history may include admins or removed accounts.
        if (!entry) return;

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
        </div>
      </div>

      {loading ? (
        <p role="status" className="py-10 text-center text-xs text-slate-500">Đang tải bảng xếp hạng…</p>
      ) : memberRankings.length === 0 || topFiveMembers.every((m) => m.attendedCount === 0) ? (
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
                        className={`text-[11px] font-normal px-2 py-0.5 rounded-full ${m.avgEarlyMinutes > 0
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
  );
}
