import { expect, it } from 'vitest';
import { buildMemberAbsenceRanking } from './memberAbsenceRanking';
const members = ['absent', 'late', 'less-late', 'on-time'].map(uid => ({ uid, displayName: uid, createdAt: '2020-01-01' }));
const meeting = (id: string, speakers: { userId?: string; checkedInAt?: string; name?: string; email?: string }[] = [], status = 'ended') => ({ _id: id, startsAt: '2025-01-01T08:00:00Z', status, speakers });
const arrival = (userId: string, minutes: number) => ({ userId, checkedInAt: new Date(Date.parse('2025-01-01T08:00:00Z') + minutes * 60000).toISOString() });
it('prioritizes absences before late attendance, then late count and total minutes', () => {
  const meetings = [meeting('1', [arrival('late', 30), arrival('less-late', 5), arrival('on-time', 0)]), meeting('2', [arrival('late', 10), arrival('less-late', 5), arrival('on-time', -5)])];
  const rank = buildMemberAbsenceRanking(members, meetings);
  expect(rank.map(m => m.id)).toEqual(['absent', 'late', 'less-late', 'on-time']);
  expect(rank[0]).toMatchObject({ absentCount: 2, attendedCount: 0, lateCount: 0, absentRate: 100 });
  expect(rank[1]).toMatchObject({ absentCount: 0, lateCount: 2, totalLateMinutes: 40 });
  const changed = buildMemberAbsenceRanking(members, [meeting('1', [arrival('late', 1), arrival('less-late', 100)]), meeting('2', [arrival('late', 1), arrival('less-late', 0)])]);
  expect(changed.find(m => m.id === 'late')!.rank).toBeLessThan(changed.find(m => m.id === 'less-late')!.rank);
});
it('ignores scheduled, live, paused, cancelled, invalid and future meetings', () => {
  const ignored = ['scheduled', 'live', 'paused', 'cancelled'].map(status => meeting(status, [], status));
  expect(buildMemberAbsenceRanking(members, [...ignored, { ...meeting('future'), startsAt: '2099-01-01' }, { ...meeting('bad'), startsAt: 'bad' }])).toEqual([]);
});
it('excludes meetings before account creation, inactive members, guests and ineligible new members', () => {
  const roster = [...members, { uid: 'new', createdAt: '2025-01-02' }, { uid: 'inactive', isActive: false }, { uid: 'joining', createdAt: '2025-01-01T08:00:00Z' }];
  const rank = buildMemberAbsenceRanking(roster, [meeting('1', [{ name: 'Guest', email: 'absent@example.com' }])]);
  expect(rank.some(m => ['new', 'inactive'].includes(m.id))).toBe(false);
  expect(rank.find(m => m.id === 'joining')?.absentCount).toBe(1);
  expect(rank.find(m => m.id === 'absent')?.absentCount).toBe(1);
});
it('deduplicates meetings, roster and attendance, and uses earliest check-in without turning invalid time into absence', () => {
  const item = meeting('1', [arrival('late', 30), arrival('late', 5), { userId: 'on-time', checkedInAt: 'bad' }]);
  const rank = buildMemberAbsenceRanking([...members, members[0]], [item, item]);
  expect(rank).toHaveLength(4);
  expect(rank.find(m => m.id === 'late')).toMatchObject({ eligibleCount: 1, attendedCount: 1, lateCount: 1, totalLateMinutes: 5 });
  expect(rank.find(m => m.id === 'on-time')).toMatchObject({ attendedCount: 1, absentCount: 0, lateCount: 0 });
});
it('counts one second after start as late and supports legacy accounts without a creation date', () => {
  const rank = buildMemberAbsenceRanking([{ uid: 'legacy' }], [meeting('1', [arrival('legacy', 1 / 60)])]);
  expect(rank[0].lateCount).toBe(1);
  expect(rank[0].totalLateMinutes).toBeCloseTo(1 / 60);
});

it("excludes admins with or without check-ins and keeps member ranks contiguous", () => {
  const roster = [
    { uid: "admin-absent", role: "admin" },
    { uid: "admin-present", role: "admin" },
    { uid: "member", role: "user" },
    { uid: "manager", role: "manager" },
  ];
  const rank = buildMemberAbsenceRanking(roster, [meeting("1", [arrival("admin-present", 30), arrival("manager", 0)])]);
  expect(rank.map(member => member.id)).toEqual(["member", "manager"]);
  expect(rank.map(member => member.rank)).toEqual([1, 2]);
});
