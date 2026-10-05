import { VIETNAMESE_HOLIDAY_RULES } from "../../src/utils/vietnameseHolidays";
import { Router } from "express";
import Joi from "joi";
import { requireAuth, requirePermission } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";
import { CelebrationDeliveryModel } from "../model/celebration-delivery.model";
import { companyEmailService } from "../service/company-email.service";
import { renderCelebrationTemplate } from "../service/company-celebration";
import { sourceUploadFinalizer } from "../service/source-upload-finalizer.service";

export const companyEmailRouter = Router();
companyEmailRouter.use(requireAuth);
const companyCode = (req: import("express").Request) => String(req.user?.companyCode || "").toUpperCase();
const smtpSchema = Joi.object({ host: Joi.string().trim().required(), port: Joi.number().integer().min(1).max(65535).required(), secure: Joi.boolean().required(), user: Joi.string().trim().required(), password: Joi.string().allow("").optional(), fromEmail: Joi.string().email().required(), fromName: Joi.string().trim().required() });
export const normalizeSmtpPayload = (body: Record<string, unknown>) => {
  let payload = body;
  while (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) && !payload.host) payload = payload.data as Record<string, unknown>;
  const { host, port, secure, user, password, fromEmail, fromName } = payload || {};
  return { host, port, secure, user, password, fromEmail, fromName };
};
export const celebrationSchema = Joi.object({ vietnameseHolidaysEnabled: Joi.boolean().default(true), disabledVietnameseHolidays: Joi.array().items(Joi.string().valid(...VIETNAMESE_HOLIDAY_RULES.map((holiday) => holiday.id))).unique().default([]), birthdayEnabled: Joi.boolean().required(), holidayEnabled: Joi.boolean().required(), sendTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(), birthdayTemplate: Joi.object({ subject: Joi.string().max(300).required(), html: Joi.string().max(50000).required() }).required(), holidayTemplate: Joi.object({ subject: Joi.string().max(300).required(), html: Joi.string().max(50000).required() }).required(), holidayOverrides: Joi.array().items(Joi.object({ _id: Joi.any().strip(), name: Joi.string().trim().max(150).required(), date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : helpers.error("any.invalid");
}).required(), enabled: Joi.boolean().required(), subject: Joi.string().max(300).allow("").optional(), html: Joi.string().max(50000).allow("").optional() })).unique("date").default([]), uploadTokens: Joi.array().items(Joi.string().trim()).default([]) });

companyEmailRouter.use("/smtp", requirePermission("settings:manage"));
companyEmailRouter.get("/smtp", async (req, res) => res.json({ data: await companyEmailService.getSmtp(companyCode(req)) }));
companyEmailRouter.put("/smtp", async (req, res) => { const { error, value } = smtpSchema.validate(normalizeSmtpPayload(req.body)); if (error) return res.status(400).json({ message: error.message }); try { return res.json({ data: await companyEmailService.saveSmtp(companyCode(req), value) }); } catch (e) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.post("/smtp/verify", async (req, res) => { try { return res.json(await companyEmailService.verify(companyCode(req))); } catch (e) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.post("/smtp/test", async (req, res) => { try { return res.json(await companyEmailService.send(companyCode(req), { to: req.user.email, subject: "Kiểm tra SMTP công ty", html: "<p>Kết nối SMTP hoạt động.</p>" })); } catch (e) { return res.status(400).json({ message: e.message }); } });

companyEmailRouter.use("/celebration", requirePermission("settings:manage"));
companyEmailRouter.get("/celebration", async (req, res) => { const company = await CompanyModel.findOne({ code: companyCode(req) }).select("celebrationConfig").lean(); return res.json({ data: company?.celebrationConfig }); });
companyEmailRouter.put("/celebration", async (req, res) => { const { error, value } = celebrationSchema.validate(req.body); if (error) return res.status(400).json({ message: error.message }); try { const { uploadTokens, ...config } = value; renderCelebrationTemplate(config.birthdayTemplate.subject + config.birthdayTemplate.html + config.holidayTemplate.subject + config.holidayTemplate.html, { employeeName: "A", companyName: "C", holidayName: "H" }); for (const holiday of config.holidayOverrides) renderCelebrationTemplate((holiday.subject || "") + (holiday.html || ""), { employeeName: "A", companyName: "C", holidayName: holiday.name }); await CompanyModel.updateOne({ code: companyCode(req) }, { $set: { celebrationConfig: config } }); await sourceUploadFinalizer.finalize({ companyCode: companyCode(req), branchId: req.user.branchId, actorId: req.user.id, actorName: req.user.email }, { entityType: "company", entityId: companyCode(req), entityLabel: req.user.companyName || companyCode(req), sourceRecordId: "celebration-config", uploads: uploadTokens.map((uploadToken: string, index: number) => ({ uploadToken, sourceField: `images.${index}` })) }); return res.json({ data: config }); } catch (e) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.post("/celebration/preview", async (req, res) => { try { return res.json({ data: { subject: renderCelebrationTemplate(req.body.subject || "", { employeeName: req.user.displayName || "Nhân viên", companyName: req.user.companyName || "Công ty", holidayName: req.body.holidayName || "Ngày lễ" }, false), html: renderCelebrationTemplate(req.body.html || "", { employeeName: req.user.displayName || "Nhân viên", companyName: req.user.companyName || "Công ty", holidayName: req.body.holidayName || "Ngày lễ" }) } }); } catch (e) { return res.status(400).json({ message: e.message }); } });
companyEmailRouter.get("/celebration/history", async (req, res) => res.json({ data: await CelebrationDeliveryModel.find({ companyCode: companyCode(req) }).sort({ createdAt: -1 }).limit(200).lean() }));
