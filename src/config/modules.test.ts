import { test, expect } from "vitest";
import type { TabType } from "../types";
import { filterEnabledTabs, MODULE_KEYS, MODULE_READ_PERMISSIONS, MODULE_TAB_MAP, resolveEnabledTab } from "./modules";

test("maps the hr module to its tab and permissions", () => {
  expect(MODULE_KEYS).toContain("hr");
  expect(MODULE_TAB_MAP.hr).toBe("NHÂN SỰ");
  expect(MODULE_READ_PERMISSIONS["NHÂN SỰ"]).toEqual(["hr:read", "access:read", "work:read", "timekeeping:read"]);
});

const tabs: TabType[] = [
  "TỔNG QUAN",
  "NHÂN SỰ",
  "TRÒ CHUYỆN",
  "CÀI ĐẶT",
];

test("filterEnabledTabs keeps permanent tabs and enabled tenant modules", () => {
  expect(filterEnabledTabs(tabs, ["hr", "chat"])).toEqual([
    "TỔNG QUAN",
    "NHÂN SỰ",
    "TRÒ CHUYỆN",
    "CÀI ĐẶT",
  ]);
});

test("resolveEnabledTab keeps enabled module", () => {
  expect(resolveEnabledTab("NHÂN SỰ", ["hr"])).toBe("NHÂN SỰ");
});
