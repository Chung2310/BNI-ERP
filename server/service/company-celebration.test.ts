import { describe, expect, it } from "vitest";
import { isCompanySendTime, renderCelebrationTemplate } from "./company-celebration";

describe("renderCelebrationTemplate", () => {
  it("renders supported variables and escapes employee data", () => {
    expect(renderCelebrationTemplate("Chao {{employeeName}} - {{companyName}}", {
      employeeName: "<Admin>", companyName: "iGen", holidayName: "",
    })).toBe("Chao &lt;Admin&gt; - iGen");
  });

  it("escapes holiday names in HTML while keeping subjects as plain text", () => {
    const variables = { employeeName: "An", companyName: "iGen", holidayName: "Lễ <b> & Tết" };
    expect(renderCelebrationTemplate("<p>{{holidayName}}</p>", variables)).toBe("<p>Lễ &lt;b&gt; &amp; Tết</p>");
    expect(renderCelebrationTemplate("{{holidayName}}", variables, false)).toBe("Lễ <b> & Tết");
  });

  it("rejects unsupported variables", () => {
    expect(() => renderCelebrationTemplate("{{password}}", {
      employeeName: "A", companyName: "iGen", holidayName: "",
    })).toThrow("Bien mau khong duoc ho tro");
  });
});

describe("isCompanySendTime", () => {
  it("uses Vietnam local time", () => {
    expect(isCompanySendTime(new Date("2026-07-28T01:00:30.000Z"), "08:00")).toBe(true);
    expect(isCompanySendTime(new Date("2026-07-28T00:59:30.000Z"), "08:00")).toBe(false);
  });
});
