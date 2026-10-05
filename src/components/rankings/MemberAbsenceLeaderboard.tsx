import { useNow } from "../../hooks/useNow";
import { useMemo, useState } from "react";
import { UserX } from "lucide-react";
import type { UserProfile } from "../../types/common";
import type { Meeting } from "../../services/meetingService";
import { buildMemberAbsenceRanking } from "./memberAbsenceRanking";

export function MemberAbsenceLeaderboard({ members, meetings, loading }: { members: UserProfile[]; meetings: Meeting[]; loading: boolean }) {
  const now = useNow();
  const rankings = useMemo(() => buildMemberAbsenceRanking(members, meetings, now), [members, meetings, now]);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const query = search.trim().toLocaleLowerCase("vi");
  const matches = rankings.filter(member => !query || [member.name, member.email, member.companyName].some(value => value?.toLocaleLowerCase("vi").includes(query)));
  const completedCount = meetings.filter(meeting => meeting.status === "ended" && new Date(meeting.startsAt).getTime() <= now).length;
  return <section aria-label="BXH thành viên lười nhất" className="rounded-2xl border border-orange-200/80 bg-white p-4 sm:p-5 shadow-2xs">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
      <div><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><UserX aria-hidden="true" className="h-4 w-4 text-orange-600" />BXH thành viên “lười” nhất</h3>
        <p className="mt-1 text-xs text-slate-500">Vắng nhiều nhất → nhiều lần check-in muộn nhất → tổng số phút muộn nhiều nhất.</p>
      </div>
      <input aria-label="Tìm thành viên trong BXH lười" value={search} onChange={event => { setSearch(event.target.value); setLimit(10); }} placeholder="Tìm tên, email, công ty…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs sm:w-60" />
    </div>
    {loading ? <p role="status" className="py-8 text-center text-xs text-slate-500">Đang tải bảng xếp hạng…</p> : !members.some(member => member.role !== "admin" && member.isActive !== false) ? <p className="py-8 text-center text-xs text-slate-500">Chưa có dữ liệu thành viên để xếp hạng.</p> : !completedCount ? <p className="py-8 text-center text-xs text-slate-500">Chưa có cuộc họp đã kết thúc trong bộ lọc hiện tại.</p> : !matches.length ? <p className="py-8 text-center text-xs text-slate-500">Không có thành viên phù hợp.</p> : <>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-slate-100 text-slate-500"><tr>
        <th className="px-2 py-3">Hạng</th><th className="px-2 py-3">Thành viên</th><th className="px-2 py-3 text-center">Số buổi xét</th><th className="px-2 py-3 text-center">Vắng mặt</th><th className="px-2 py-3 text-center">Có mặt</th><th className="px-2 py-3 text-center">Check-in muộn</th><th className="px-2 py-3 text-right">Tổng phút muộn</th>
      </tr></thead><tbody className="divide-y divide-slate-100">{matches.slice(0, limit).map(member => <tr key={member.id} className="hover:bg-orange-50/40">
        <td className="px-2 py-3 font-semibold text-orange-700">#{member.rank}</td>
        <td className="px-2 py-3"><div className="flex items-center gap-2.5">{member.photoURL ? <img src={member.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-50 text-orange-700">{member.name.charAt(0).toUpperCase()}</span>}<div><p className="font-medium text-slate-800">{member.name}</p>{member.companyName && <p className="mt-0.5 text-[11px] text-slate-400">{member.companyName}</p>}</div></div></td>
        <td className="px-2 py-3 text-center">{member.eligibleCount}</td><td className="px-2 py-3 text-center font-semibold text-orange-700">{member.absentCount} <span className="font-normal text-slate-400">({member.absentRate}%)</span></td>
        <td className="px-2 py-3 text-center">{member.attendedCount}</td><td className="px-2 py-3 text-center text-amber-700">{member.lateCount}</td>
        <td className="px-2 py-3 text-right">{member.totalLateMinutes > 0 && member.totalLateMinutes < 0.1 ? "<0,1" : member.totalLateMinutes.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</td>
      </tr>)}</tbody></table></div>
      {matches.length > limit && <button type="button" onClick={() => setLimit(value => value + 10)} className="mt-3 text-xs font-semibold text-orange-700">Xem thêm thành viên</button>}
    </>}
  </section>;
}
