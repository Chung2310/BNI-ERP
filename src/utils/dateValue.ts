export type DateValue = string | number | Date | { toDate(): Date } | { seconds: number };

export function parseDateValue(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  if (value && typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") return parseDateValue(value.toDate());
    if ("seconds" in value && typeof value.seconds === "number") return new Date(value.seconds * 1000);
  }
  return new Date(NaN);
}
