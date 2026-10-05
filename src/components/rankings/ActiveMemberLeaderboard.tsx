import { MEMBER_RANKING_PODIUM } from "../../config/memberRankingPodium";
import { useMemo } from "react";
import { Crown, Trophy, Users } from "lucide-react";
import type { UserProfile } from "../../types/common";
import type { Meeting } from "../../services/meetingService";
import { UserAvatar } from "../meetings/SpeakerAvatar";

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
  const topTenMembers = useMemo(() => memberRankings.slice(0, 10), [memberRankings]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
      <header className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3.5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-800">BẢNG XẾP HẠNG THÀNH VIÊN TÍCH CỰC</h3>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">Top {Math.min(10, memberRankings.length)}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">Xếp hạng theo số buổi điểm danh tham gia và thói quen đến sớm chuẩn giờ</p>
        </div>
      </header>

      {loading ? (
        <p role="status" className="py-10 text-center text-xs text-slate-500">Đang tải bảng xếp hạng…</p>
      ) : memberRankings.length === 0 || topFiveMembers.every(member => member.attendedCount === 0) ? (
        <div className="py-10 text-center text-xs text-slate-400">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>Chưa có dữ liệu điểm danh thành viên trong khoảng thời gian đã chọn.</p>
        </div>
      ) : (
        <div className="pt-6">
          <div className="grid min-h-[300px] grid-cols-5 items-end gap-2 border-b border-slate-100 px-1 pb-2 sm:min-h-[340px] sm:gap-4 sm:px-4">
            {MEMBER_RANKING_PODIUM.map(slot => {
              const member = topFiveMembers[slot.rankIndex];
              return (
                <div key={slot.rankNum} className="flex h-full flex-col items-center justify-end">
                  <div className="mb-2.5 flex w-full flex-col items-center">
                    {member ? (
                      <>
                        {slot.isTop1 && <Crown className="-mb-0.5 h-4 w-4 fill-sky-300 text-sky-500" />}
                        <div className="relative mb-1.5">
                          {member.photoURL ? (
                            <img src={member.photoURL} alt={member.name} className={`h-10 w-10 rounded-full object-cover sm:h-12 sm:w-12 ${slot.ringColor}`} onError={event => { (event.target as HTMLElement).style.display = "none"; }} />
                          ) : (
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-xs font-medium text-sky-700 sm:h-12 sm:w-12 sm:text-sm ${slot.ringColor}`}>{(member.name || "?").trim().charAt(0).toUpperCase()}</div>
                          )}
                          <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] sm:h-5 sm:w-5 sm:text-xs ${slot.badgeColor}`}>#{slot.rankNum}</span>
                        </div>
                        <p className="max-w-[70px] truncate text-center text-xs font-medium text-slate-700 sm:max-w-[120px]" title={member.name}>{member.name}</p>
                        {member.companyName && <p className="max-w-[70px] truncate text-center text-[10px] text-slate-400 sm:max-w-[120px]" title={member.companyName}>{member.companyName}</p>}
                      </>
                    ) : (
                      <>
                        <div className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 sm:h-12 sm:w-12">#{slot.rankNum}</div>
                        <p className="text-center text-xs text-slate-400">Chờ thành viên</p>
                        <p className="text-center text-[10px] text-slate-300">-</p>
                      </>
                    )}
                  </div>
                  <div className={`flex w-full max-w-[70px] flex-col items-center justify-between rounded-t-xl border px-1 py-2.5 transition-all sm:max-w-[110px] sm:rounded-t-2xl sm:py-3 ${slot.heightClass} ${member ? `${slot.bgColor} ${slot.borderColor} ${slot.textColor}` : "border-dashed border-slate-200 bg-slate-50/50 text-slate-300"}`}>
                    {member ? (
                      <>
                        <div className="text-center">
                          <span className="block text-xs font-medium tracking-normal sm:text-sm">{member.attendedCount} buổi</span>
                          <span className="mt-0.5 block text-[10px]">{member.attendanceRate}%</span>
                        </div>
                        <div className={`w-full border-t pt-1.5 text-center text-[10px] ${slot.dividerColor}`}>
                          {member.avgEarlyMinutes > 0 ? `Sớm +${member.avgEarlyMinutes}p` : member.attendedCount > 0 ? "Đúng giờ" : "Chưa họp"}
                        </div>
                      </>
                    ) : <span className="text-xs">#{slot.rankNum}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-3">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600"><Users className="h-3.5 w-3.5 text-sky-500" />TOP 10</p>
              <span className="text-[11px] text-slate-400">Hiển thị {topTenMembers.length} thành viên</span>
            </div>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
              {topTenMembers.map((member, index) => (
                <div key={member.id} className="flex items-center justify-between gap-3 p-2.5 text-xs transition-colors hover:bg-sky-50/50 sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-50 font-mono text-xs font-medium text-sky-700">#{index + 1}</span>
                    {member.photoURL ? <img src={member.photoURL} alt={member.name} className="h-8 w-8 shrink-0 rounded-full border border-sky-100 object-cover" onError={event => { (event.target as HTMLElement).style.display = "none"; }} /> : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-medium text-cyan-700">{(member.name || "?").trim().charAt(0).toUpperCase()}</div>}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{member.name}</p>
                      {member.companyName && <p className="truncate text-[10px] text-slate-400">{member.companyName}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-right sm:gap-6">
                    <div><span className="font-medium text-slate-700">{member.attendedCount}</span><span className="ml-1 text-slate-400">buổi ({member.attendanceRate}%)</span></div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${member.avgEarlyMinutes > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : member.attendedCount > 0 ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                      {member.avgEarlyMinutes > 0 ? `Sớm +${member.avgEarlyMinutes}p` : member.attendedCount > 0 ? "Đúng giờ" : "Chưa họp"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}