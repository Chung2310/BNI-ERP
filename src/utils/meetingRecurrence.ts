export type MeetingRecurrence = { startDate: string; months: number; weekday: number; time: string; durationMinutes?: number };
const DAY = 86400000;
export function vietnamDateTime(value: string | Date): string {
  return new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16);
}
export function recurringMeetingDates(rule: MeetingRecurrence): Date[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.startDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time)
    || !Number.isInteger(rule.months) || rule.months < 1 || rule.months > 12
    || !Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) throw new Error("Chu kỳ họp không hợp lệ.");
  if (rule.durationMinutes !== undefined && (!Number.isInteger(rule.durationMinutes) || rule.durationMinutes < 1 || rule.durationMinutes > 1440)) throw new Error("Thời lượng không hợp lệ.");
  const start = new Date(rule.startDate + "T00:00:00Z");
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== rule.startDate) throw new Error("Ngày bắt đầu không hợp lệ.");
  const end = new Date(start);
  end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + rule.months);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  const dates: Date[] = [];
  for (let day = start.getTime() + ((rule.weekday - start.getUTCDay() + 7) % 7) * DAY; day < end.getTime(); day += 7 * DAY) {
    dates.push(new Date(new Date(day).toISOString().slice(0, 10) + "T" + rule.time + ":00+07:00"));
  }
  return dates;
}
export function meetingMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Tháng không hợp lệ.");
  const from = new Date(month + "-01T00:00:00+07:00");
  const next = new Date(month + "-01T00:00:00Z"); next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: new Date(next.getTime() - 7 * 3600000) };
}
