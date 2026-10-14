import { Router, type Response } from "express";
import Joi from "joi";
import rateLimit from "express-rate-limit";
import { type AuthenticatedRequest, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { ChatUserBlockModel, ChatReportModel } from "../model/chat-safety.model";
import { chatSafetyService } from "../service/chat-safety.service";

export const chatSafetyRouter = Router();
const id = Joi.string().hex().length(24).required();
const company = (req: AuthenticatedRequest) => req.user!.companyCode || "SYSTEM";
const handle = (fn: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response) => {
  try { return res.json({ status: "success", data: await fn(req) }); }
  catch (error) { return res.status(400).json({ status: "error", message: error instanceof Error ? error.message : "Không thể xử lý yêu cầu." }); }
};

chatSafetyRouter.get("/blocks", handle(req => ChatUserBlockModel.find({ companyCode: company(req), userId: req.user!.id }).populate("blockedUserId", "displayName").lean()));
chatSafetyRouter.patch("/blocks/:userId", validateRequest({ params: Joi.object({ userId: id }), body: Joi.object({ blocked: Joi.boolean().required() }) }), handle(req => chatSafetyService.setBlock(req.user!.id, company(req), req.params.userId, req.body.blocked).then(() => ({ updated: true }))));
chatSafetyRouter.post("/rooms/:roomId/messages/:messageId/report",
  rateLimit({ windowMs: 60000, limit: 10, keyGenerator: (req: AuthenticatedRequest) => req.user!.id, standardHeaders: true, legacyHeaders: false }),
  validateRequest({ params: Joi.object({ roomId: id, messageId: id }), body: Joi.object({ reason: Joi.string().valid("harassment", "sexual", "violence", "spam", "other").required(), details: Joi.string().allow("").max(2000).default("") }) }),
  handle(req => chatSafetyService.report(req.user!.id, company(req), req.params.roomId, req.params.messageId, req.body.reason, req.body.details).then(row => ({ id: row?._id, state: row?.state }))));

chatSafetyRouter.get("/moderation", requirePermission("chat:manage"), handle(req => ChatReportModel.find({ companyCode: company(req), state: "pending" }).sort({ createdAt: 1 }).limit(100).populate("messageId", "content attachments senderName awaitingReview isDeleted").populate("reporterId", "displayName").lean()));
chatSafetyRouter.patch("/moderation/:reportId", requirePermission("chat:manage"), validateRequest({ params: Joi.object({ reportId: id }), body: Joi.object({ action: Joi.string().valid("approve", "remove", "suspend", "dismiss").required() }) }), handle(req => chatSafetyService.resolve(company(req), req.params.reportId, req.user!.id, req.body.action)));
