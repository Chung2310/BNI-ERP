import { computeDateFromLunarDate } from "amlich.js";

export const VIETNAMESE_HOLIDAY_RULES = [
  { id: "new-year", name: "Tết Dương lịch", day: 1, month: 1, lunar: false },
  { id: "tet", name: "Tết Nguyên đán", day: 1, month: 1, lunar: true },
  { id: "womens-day", name: "Ngày Quốc tế Phụ nữ", day: 8, month: 3, lunar: false },
  { id: "hung-kings", name: "Giỗ Tổ Hùng Vương", day: 10, month: 3, lunar: true },
  { id: "reunification", name: "Ngày Giải phóng miền Nam, thống nhất đất nước", day: 30, month: 4, lunar: false },
  { id: "labour-day", name: "Ngày Quốc tế Lao động", day: 1, month: 5, lunar: false },
  { id: "national-day", name: "Quốc khánh", day: 2, month: 9, lunar: false },
  { id: "mid-autumn", name: "Tết Trung thu", day: 15, month: 8, lunar: true },
  { id: "vietnam-womens-day", name: "Ngày Phụ nữ Việt Nam", day: 20, month: 10, lunar: false },
  { id: "teachers-day", name: "Ngày Nhà giáo Việt Nam", day: 20, month: 11, lunar: false },
] as const;

export type HolidayOverride = { date: string; name?: string; enabled: boolean; subject?: string; html?: string };
export type VietnameseHolidayConfig = {
  vietnameseHolidaysEnabled?: boolean;
  disabledVietnameseHolidays?: string[];
  holidayOverrides?: HolidayOverride[];
};

const pad = (value: number) => String(value).padStart(2, "0");

export function getVietnameseHolidays(year: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new Error("Năm không hợp lệ.");
  return VIETNAMESE_HOLIDAY_RULES.map((rule) => {
    // amlich.js returns a zero-based solar month. Always calculate in Vietnam (UTC+7).
    const solar = rule.lunar ? computeDateFromLunarDate(rule.day, rule.month, year, false, 7) : null;
    const date = solar
      ? [solar.year, pad(solar.month + 1), pad(solar.day)].join("-")
      : [year, pad(rule.month), pad(rule.day)].join("-");
    return { ...rule, date };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// Recurring rules are resolved at send time, so no yearly import or database seeding is needed.
// Keep one event per date, preserving the existing delivery log's date-based deduplication key.
export function resolveCelebrationHolidays(year: number, config: VietnameseHolidayConfig): HolidayOverride[] {
  const byDate = new Map<string, HolidayOverride>();
  if (config.vietnameseHolidaysEnabled !== false) {
    for (const holiday of getVietnameseHolidays(year)) {
      if (config.disabledVietnameseHolidays?.includes(holiday.id)) continue;
      const existing = byDate.get(holiday.date);
      byDate.set(holiday.date, {
        date: holiday.date, enabled: true,
        name: existing ? existing.name + " / " + holiday.name : holiday.name,
      });
    }
  }
  for (const holiday of config.holidayOverrides || []) {
    if (holiday.date.startsWith(year + "-")) byDate.set(holiday.date, holiday);
  }
  return [...byDate.values()].filter((holiday) => holiday.enabled !== false).sort((a, b) => a.date.localeCompare(b.date));
}
