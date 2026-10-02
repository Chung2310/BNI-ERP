import { describe, expect, it } from "vitest";
import { celebrationSchema, normalizeSmtpPayload } from "./company-email.router";

const smtp = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  user: "sender@example.com",
  password: "app-password",
  fromEmail: "sender@example.com",
  fromName: "Example",
};

describe("normalizeSmtpPayload", () => {
  it("unwraps nested data envelopes before SMTP validation", () => {
    expect(normalizeSmtpPayload({ data: { data: smtp } })).toEqual(smtp);
  });
});

const celebration = {
  birthdayEnabled: false, holidayEnabled: true, sendTime: "08:00",
  birthdayTemplate: { subject: "Birthday", html: "<p>Hi</p>" },
  holidayTemplate: { subject: "Happy {{holidayName}}", html: "<p>{{holidayName}}</p>" },
};
const holiday = { name: "National Day", date: "2027-09-02", enabled: true };

describe("holiday configuration validation", () => {
  it("keeps the holiday name and strips legacy subdocument IDs", () => {
    const { error, value } = celebrationSchema.validate({ ...celebration, holidayOverrides: [{ ...holiday, _id: "legacy" }] });
    expect(error).toBeUndefined();
    expect(value.holidayOverrides).toEqual([holiday]);
  });
  it.each(["2027-02-29", "2027-02-30", "2027-13-01", "not-a-date"])("rejects invalid date %s", (date) => {
    expect(celebrationSchema.validate({ ...celebration, holidayOverrides: [{ ...holiday, date }] }).error).toBeDefined();
  });
  it("accepts leap days and rejects unnamed or duplicate holidays", () => {
    expect(celebrationSchema.validate({ ...celebration, holidayOverrides: [{ ...holiday, date: "2028-02-29" }] }).error).toBeUndefined();
    expect(celebrationSchema.validate({ ...celebration, holidayOverrides: [{ ...holiday, name: " " }] }).error).toBeDefined();
    expect(celebrationSchema.validate({ ...celebration, holidayOverrides: [holiday, holiday] }).error).toBeDefined();
  });
});

it("validates recurring holiday exclusions and defaults to the automatic calendar", () => {
  const result = celebrationSchema.validate({ ...celebration, disabledVietnameseHolidays: ["tet"] });
  expect(result.error).toBeUndefined();
  expect(result.value.vietnameseHolidaysEnabled).toBe(true);
  expect(result.value.disabledVietnameseHolidays).toEqual(["tet"]);
  expect(celebrationSchema.validate({ ...celebration, disabledVietnameseHolidays: ["unknown"] }).error).toBeDefined();
});
