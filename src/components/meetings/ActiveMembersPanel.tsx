import React, { useMemo } from "react";
import { Crown, Medal, Star, Trophy } from "lucide-react";

type FlowSpeaker = { id: string; userId?: string; name: string; email?: string; photoURL?: string; checkedInAt?: string };
type FlowMeeting = { _id: string; status: string; startsAt: string; speakers: FlowSpeaker[] };

type Props = { meeting: FlowMeeting; meetings: FlowMeeting[]; limit?: number };

type Row = { userId: string; name: string; email?: string; photoURL?: string; attended: number; presentToday: boolean };

/**
 * Xếp hạng thành viên tích cực theo số buổi họp đã check-in
 * (tính trên các buổi đã/đang diễn ra tới thời điểm buổi họp hiện tại).
 */
export function rankActiveMembers(meeting: FlowMeeting, meetings: FlowMeeting[]) {
  const until = new Date(meeting.startsAt).getTime();
  const held = meetings.filter(m =>
    m._id === meeting._id || (["live", "paused", "ended"].includes(m.status) && new Date(m.startsAt).getTime() <= until),
  );
  const rows = new Map<string, Row>();
  for (const m of held) {
    const seen = new Set<string>();
    for (const s of m.speakers) {
      if (!s.userId || seen.has(s.userId)) continue;
      seen.add(s.userId);
      const row = rows.get(s.userId) || { userId: s.userId, name: s.name, email: s.email, photoURL: s.photoURL, attended: 0, presentToday: false };
      row.attended += 1;
      if (m._id === meeting._id) {
        row.presentToday = true;
        row.name = s.name;
        row.photoURL = s.photoURL || row.photoURL;
      }
      rows.set(s.userId, row);
    }
  }
  const list = [...rows.values()].sort((a, b) =>
    b.attended - a.attended || Number(b.presentToday) - Number(a.presentToday) || a.name.localeCompare(b.name, "vi"),
  );
  return { totalMeetings: held.length, list };
}

const podium = [
  { icon: Crown, ring: "ring-amber-400", chip: "bg-amber-400 text-slate-900", card: "from-amber-50 to-white border-amber-200" },
  { icon: Medal, ring: "ring-slate-300", chip: "bg-slate-300 text-slate-800", card: "from-slate-50 to-white border-slate-200" },
  { icon: Medal, ring: "ring-orange-300", chip: "bg-orange-300 text-orange-950", card: "from-orange-50 to-white border-orange-200" },
];

function Avatar({ row, className }: { row: Row; className: string }) {
  return row.photoURL
    ? <img src={row.photoURL} alt={row.name} className={`${className} object-cover`} />
    : <span className={`${className} grid place-items-center bg-cyan-50 font-semibold text-cyan-700`}>{row.name.slice(0, 1).toUpperCase()}</span>;
}

export function ActiveMembersPanel({ meeting, meetings, limit = 20 }: Props) {
  const { totalMeetings, list } = useMemo(() => rankActiveMembers(meeting, meetings), [meeting, meetings]);
  const top = list.slice(0, limit);
  const rate = (n: number) => (totalMeetings ? Math.round((n / totalMeetings) * 100) : 0);

  if (!top.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center text-sm text-slate-400">
        <Star className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        Chưa có dữ liệu check-in của thành viên.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800"><Trophy className="h-5 w-5 text-amber-500" /> Thành viên tích cực</h3>
          <p className="text-xs text-slate-500">Xếp hạng theo số buổi check-in trên {totalMeetings} buổi họp đã diễn ra.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {top.slice(0, 3).map((row, i) => {
          const style = podium[i];
          const Icon = style.icon;
          return (
            <div key={row.userId} className={`relative rounded-2xl border bg-gradient-to-b ${style.card} p-5 text-center shadow-xs`}>
              <span className={`absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${style.chip}`}>{i + 1}</span>
              <Icon className="absolute right-3 top-3 h-5 w-5 text-amber-500" />
              <Avatar row={row} className={`mx-auto h-20 w-20 rounded-full ring-4 ${style.ring}`} />
              <h4 className="mt-3 truncate font-semibold text-slate-800">{row.name}</h4>
              <p className="text-xs text-slate-500">{row.attended}/{totalMeetings} buổi · {rate(row.attended)}%</p>
            </div>
          );
        })}
      </div>

      {top.length > 3 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
          <ol className="divide-y divide-slate-100">
            {top.slice(3).map((row, i) => (
              <li key={row.userId} className="flex items-center gap-3 px-2 py-2.5">
                <span className="w-6 text-center font-mono text-xs font-semibold text-slate-400">{i + 4}</span>
                <Avatar row={row} className="h-9 w-9 rounded-full ring-1 ring-slate-200" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">{row.name}</p>
                  <div className="mt-1 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width: `${rate(row.attended)}%` }} />
                  </div>
                </div>
                {!row.presentToday && <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">Vắng hôm nay</span>}
                <span className="text-xs font-semibold text-slate-700">{row.attended}/{totalMeetings}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
