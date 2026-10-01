import { describe, expect, it } from "vitest";
import { filterEnabledTabs, resolveEnabledTab } from "../config/modules";
import { APP_ROUTES } from "./route-config";

describe("core module routing", () => {
  it("resolves default active tab", () => {
    expect(resolveEnabledTab("TỔNG QUAN", ["hr", "chat", "resource"])).toBe("TỔNG QUAN");
  });

  it("filters enabled tabs correctly", () => {
    expect(filterEnabledTabs(["TỔNG QUAN", "NHÂN SỰ"], ["hr"])).toEqual(["TỔNG QUAN", "NHÂN SỰ"]);
  });

  it("registers core routes", () => {
    const tabs = APP_ROUTES.map((r) => r.tab);
    expect(tabs).toContain("TỔNG QUAN");
    expect(tabs).toContain("NHÂN SỰ");
    expect(tabs).toContain("QUẢN LÝ TÀI NGUYÊN");
    expect(tabs).toContain("TRÒ CHUYỆN");
  });
});
