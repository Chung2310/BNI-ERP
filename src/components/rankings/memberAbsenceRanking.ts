type RankingMember = {
  uid?: string; _id?: string; id?: string; displayName?: string; email?: string;
  photoURL?: string; companyName?: string; createdAt?: unknown; isActive?: boolean; role?: string;
};
type RankingMeeting = {
  _id: string; status: string; startsAt: string;
  speakers?: { userId?: string; checkedInAt?: string }[];
};

function timestamp(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") value = value.toDate();
  return value ? new Date(value as string).getTime() : NaN;
}

export function buildMemberAbsenceRanking(members: RankingMember[], meetings: RankingMeeting[], now = Date.now()) {
  const completed = [...new Map(meetings.filter(m => m.status === "ended" && timestamp(m.startsAt) <= now).map(m => [m._id, m])).values()];
  const roster = [...new Map(members.filter(u => u.role !== "admin" && u.isActive !== false).map(u => [String(u.uid || u._id || u.id || ""), u])).entries()];
  const rankings = roster.filter(([id]) => id).map(([id, member]) => {
    const joinedAt = timestamp(member.createdAt);
    let eligibleCount = 0, attendedCount = 0, absentCount = 0, lateCount = 0, totalLateMs = 0;
    for (const meeting of completed) {
      const startsAt = timestamp(meeting.startsAt);
      if (Number.isFinite(joinedAt) && joinedAt > startsAt) continue;
      eligibleCount++;
      const attendance = (meeting.speakers || []).filter(s => s.userId && String(s.userId) === id);
      if (!attendance.length) { absentCount++; continue; }
      attendedCount++;
      // Duplicate attendance records count as one visit; use the earliest valid check-in.
      const validTimes = attendance.map(s => timestamp(s.checkedInAt)).filter(Number.isFinite);
      const arrival = validTimes.length ? Math.min(...validTimes) : NaN;
      if (arrival > startsAt) { lateCount++; totalLateMs += arrival - startsAt; }
    }
    return { id, name: member.displayName || member.email || "Thành viên", email: member.email,
      photoURL: member.photoURL, companyName: member.companyName, eligibleCount, attendedCount,
      absentCount, lateCount, totalLateMinutes: totalLateMs / 60000,
      absentRate: eligibleCount ? Math.round(absentCount * 100 / eligibleCount) : 0 };
  }).filter(member => member.eligibleCount > 0);
  return rankings.sort((a, b) => b.absentCount - a.absentCount || b.lateCount - a.lateCount
    || b.totalLateMinutes - a.totalLateMinutes || a.name.localeCompare(b.name, "vi") || a.id.localeCompare(b.id))
    .map((member, index) => ({ ...member, rank: index + 1 }));
}
