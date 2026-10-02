declare module "amlich.js" {
  export function computeDateFromLunarDate(day: number, month: number, year: number, leap: boolean, timezone: number): { day: number; month: number; year: number };
}
