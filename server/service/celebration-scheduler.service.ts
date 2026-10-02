import { resolveCelebrationHolidays } from "../../src/utils/vietnameseHolidays";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { CelebrationDeliveryModel } from "../model/celebration-delivery.model";
import { companyEmailService } from "./company-email.service";
import { isCompanySendTime, renderCelebrationTemplate, vietnamDateParts } from "./company-celebration";

async function deliver(company: any, eventType: "birthday" | "holiday", eventDate: string, eventKey: string, user: any, template: any, holidayName = "") {
  const variables = { employeeName: user.displayName || user.email, companyName: company.name, holidayName };
  const subject = renderCelebrationTemplate(template.subject, variables, false);
  const html = renderCelebrationTemplate(template.html, variables);
  let row: any;
  try {
    row = await CelebrationDeliveryModel.create({ companyCode: company.code, eventType, eventDate, eventKey, recipientUserId: String(user._id), recipientEmail: user.email, subject, status: "sending", attempts: 1 });
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
  try {
    const result = await companyEmailService.send(company.code, { to: user.email, subject, html });
    await CelebrationDeliveryModel.updateOne({ _id: row._id }, { status: "sent", sentAt: new Date(), messageId: result.messageId });
  } catch (error: any) {
    await CelebrationDeliveryModel.updateOne({ _id: row._id }, { status: "failed", error: String(error?.message || error).slice(0, 500) });
  }
  return true;
}

export async function runCelebrationScan(now = new Date()) {
  const local = vietnamDateParts(now);
  const companies: any[] = await CompanyModel.find({ lifecycleStatus: "active" }).lean();
  let queued = 0;
  for (const company of companies) {
    const config = company.celebrationConfig;
    if (!config || !isCompanySendTime(now, config.sendTime || "08:00")) continue;
    const users: any[] = await UserModel.find({ companyCode: company.code, isActive: { $ne: false }, disabledAt: { $in: [null, undefined] }, email: { $ne: "" } }).select("_id email displayName birthDate").lean();
    if (config.birthdayEnabled) {
      for (const user of users) {
        if (!user.birthDate) continue;
        const month = String(user.birthDate.getUTCMonth() + 1).padStart(2, "0");
        const day = String(user.birthDate.getUTCDate()).padStart(2, "0");
        if (month === local.month && day === local.day && await deliver(company, "birthday", local.date, `birthday:${user._id}`, user, config.birthdayTemplate)) queued++;
      }
    }
    if (config.holidayEnabled) {
      const override = resolveCelebrationHolidays(Number(local.date.slice(0, 4)), config).find((item) => item.date === local.date);
      if (override) {
        const template = { subject: override.subject || config.holidayTemplate?.subject, html: override.html || config.holidayTemplate?.html };
        for (const user of users) if (await deliver(company, "holiday", local.date, override.date, user, template, override.name || "Ngày lễ")) queued++;
      }
    }
  }
  return { queued };
}

export function startCelebrationScheduler() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await runCelebrationScan(); } catch (error) { console.error("[CelebrationScheduler]", error); } finally { running = false; }
  }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
