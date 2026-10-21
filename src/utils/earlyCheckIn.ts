const vietnamTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const DEFAULT_DRAW_CUTOFF_TIME = "07:00";

export function validDrawCutoffTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function checkedInByCutoff(value?: string | Date | null, cutoffTime = DEFAULT_DRAW_CUTOFF_TIME): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const limit = validDrawCutoffTime(cutoffTime) ? cutoffTime : DEFAULT_DRAW_CUTOFF_TIME;
  const parts = vietnamTime.formatToParts(date);
  const hour = Number(parts.find(part => part.type === "hour")?.value);
  const minute = Number(parts.find(part => part.type === "minute")?.value);
  return hour * 60 + minute <= Number(limit.slice(0, 2)) * 60 + Number(limit.slice(3, 5));
}
