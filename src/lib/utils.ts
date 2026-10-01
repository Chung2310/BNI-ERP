import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for combining Tailwind classes with merging support.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number | string): string {
  const num = typeof amount === "string" ? parseInt(amount.replace(/\D/g, ""), 10) : amount;
  if (isNaN(num as number) || num === null) return "";
  return num.toLocaleString("vi-VN");
}

export function parseVND(formattedValue: string): string {
  return formattedValue.replace(/\D/g, "");
}
