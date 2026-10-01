export function toVietnamDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export interface AttendanceLogCandidate {
  date?: string;
  checkOut?: unknown;
  scheduledEndAt?: Date | string | null;
}

export function isAttendanceLogActiveOnDate(
  log: AttendanceLogCandidate | null | undefined,
  currentWorkDate: string,
): boolean {
  if (!log || log.checkOut) return false;
  if (log.date === currentWorkDate) return true;
  if (!log.scheduledEndAt) return false;

  const scheduledEndAt = new Date(log.scheduledEndAt);
  if (Number.isNaN(scheduledEndAt.getTime())) return false;
  return toVietnamDate(scheduledEndAt) === currentWorkDate;
}
