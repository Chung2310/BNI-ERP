import { describe, expect, it } from "vitest";
import { getVietnameseHolidays, resolveCelebrationHolidays } from "./vietnameseHolidays";

describe("Vietnamese celebration calendar", () => {
  // Reference dates: chinhphu.vn's 2026 Tet and Hung Kings holiday announcements.
  it("converts the 2026 lunar holidays in Vietnam time", () => {
    const days = getVietnameseHolidays(2026);
    expect(days.find((day) => day.id === "tet")?.date).toBe("2026-02-17");
    expect(days.find((day) => day.id === "hung-kings")?.date).toBe("2026-04-26");
    expect(days.find((day) => day.id === "mid-autumn")?.date).toBe("2026-09-25");
    expect(days.find((day) => day.id === "national-day")?.date).toBe("2026-09-02");
  });
  it("recalculates lunar dates for the next year without saved dates", () => {
    expect(getVietnameseHolidays(2027).find((day) => day.id === "tet")?.date).toBe("2027-02-06");
    expect(resolveCelebrationHolidays(2027, {}).length).toBe(10);
  });
  it("keeps disabled events disabled across years", () => {
    for (const year of [2026, 2027]) {
      const tet = getVietnameseHolidays(year).find((day) => day.id === "tet")!;
      expect(resolveCelebrationHolidays(year, { disabledVietnameseHolidays: ["tet"] }).some((day) => day.date === tet.date)).toBe(false);
    }
  });
  it("lets custom holidays replace or disable a built-in date without duplicates", () => {
    const custom = { date: "2026-09-02", name: "Company celebration", enabled: true, subject: "Custom" };
    const events = resolveCelebrationHolidays(2026, { holidayOverrides: [custom] });
    expect(events.filter((day) => day.date === custom.date)).toEqual([custom]);
    expect(resolveCelebrationHolidays(2026, { holidayOverrides: [{ ...custom, enabled: false }] }).some((day) => day.date === custom.date)).toBe(false);
  });
  it("preserves custom events when the automatic calendar is disabled", () => {
    const custom = { date: "2026-10-15", name: "Company anniversary", enabled: true };
    expect(resolveCelebrationHolidays(2026, { vietnameseHolidaysEnabled: false, holidayOverrides: [custom] })).toEqual([custom]);
    expect(resolveCelebrationHolidays(2027, { vietnameseHolidaysEnabled: false, holidayOverrides: [custom] })).toEqual([]);
  });
});
