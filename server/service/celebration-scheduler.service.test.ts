import { beforeEach, expect, it, vi } from "vitest";
import { runCelebrationScan } from "./celebration-scheduler.service";
import { CompanyModel } from "../model/company.model";
const mocks = vi.hoisted(() => ({ companies: vi.fn(), users: vi.fn(), create: vi.fn(), update: vi.fn(), send: vi.fn() }));
vi.mock("../model/user.model", () => ({ UserModel: { find: () => ({ select: () => ({ lean: mocks.users }) }) } }));
vi.mock("../model/celebration-delivery.model", () => ({ CelebrationDeliveryModel: { create: mocks.create, updateOne: mocks.update } }));
vi.mock("./company-email.service", () => ({ companyEmailService: { send: mocks.send } }));
const holiday = { name: "National Day", date: "2027-09-02", enabled: true };
const config = { birthdayEnabled: false, holidayEnabled: true, sendTime: "08:00", holidayTemplate: { subject: "Happy {{holidayName}}", html: "<p>{{employeeName}}: {{holidayName}}</p>" }, holidayOverrides: [holiday] };
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(CompanyModel, "find").mockReturnValue(({ lean: mocks.companies } as unknown as Parameters<((value: ReturnType<typeof CompanyModel.find>) => void)>[0]));
  mocks.companies.mockResolvedValue([{ code: "ACME", name: "Acme", celebrationConfig: config }]);
  mocks.users.mockResolvedValue([{ _id: "member1", displayName: "An", email: "an@example.com" }]);
  mocks.create.mockResolvedValue({ _id: "delivery" });
  mocks.send.mockResolvedValue({ messageId: "message" });
});
it("persists holiday names in the company model and sends at Vietnam local time", async () => {
  const company = new CompanyModel({ celebrationConfig: config });
  expect(company.toObject().celebrationConfig?.holidayOverrides?.[0].name).toBe("National Day");
  expect(await runCelebrationScan(new Date("2027-09-02T01:00:00Z"))).toEqual({ queued: 1 });
  expect(mocks.send).toHaveBeenCalledWith("ACME", { to: "an@example.com", subject: "Happy National Day", html: "<p>An: National Day</p>" });
});
it.each(["2027-09-03T01:00:00Z", "2027-09-02T00:59:00Z"])("does not send outside the configured date/time: %s", async (time) => {
  await runCelebrationScan(new Date(time));
  expect(mocks.send).not.toHaveBeenCalled();
});
it("respects global and individual holiday toggles", async () => {
  for (const disabled of [{ ...config, holidayEnabled: false }, { ...config, holidayOverrides: [{ ...holiday, enabled: false }] }]) {
    mocks.companies.mockResolvedValue([{ code: "ACME", celebrationConfig: disabled }]);
    await runCelebrationScan(new Date("2027-09-02T01:00:00Z"));
  }
  expect(mocks.send).not.toHaveBeenCalled();
});
it("does not resend a holiday already claimed by the delivery log", async () => {
  mocks.create.mockRejectedValue({ code: 11000 });
  await runCelebrationScan(new Date("2027-09-02T01:00:00Z"));
  expect(mocks.send).not.toHaveBeenCalled();
});

it.each([["2026-02-17", "Tết Nguyên đán"], ["2027-02-06", "Tết Nguyên đán"], ["2026-09-02", "Quốc khánh"]])("sends automatic holidays on %s without yearly configuration", async (date, name) => {
  mocks.companies.mockResolvedValue([{ code: "ACME", name: "Acme", celebrationConfig: { ...config, holidayOverrides: [] } }]);
  await runCelebrationScan(new Date(date + "T01:00:00Z"));
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.send).toHaveBeenCalledWith("ACME", expect.objectContaining({ subject: "Happy " + name }));
});
it("respects recurring exclusions and disabling the automatic calendar", async () => {
  for (const settings of [{ disabledVietnameseHolidays: ["tet"] }, { vietnameseHolidaysEnabled: false }]) {
    mocks.companies.mockResolvedValue([{ code: "ACME", celebrationConfig: { ...config, ...settings, holidayOverrides: [] } }]);
    await runCelebrationScan(new Date("2026-02-17T01:00:00Z"));
  }
  expect(mocks.send).not.toHaveBeenCalled();
});
