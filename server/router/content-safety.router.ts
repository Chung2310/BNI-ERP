import { Router, type Response } from "express";
import Joi from "joi";
import rateLimit from "express-rate-limit";
import { requireAuth, requirePermission, getEffectivePermissions, type AuthenticatedRequest } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { contentSafetyService } from "../service/content-safety.service";

export const contentSafetyRouter = Router();
contentSafetyRouter.use(requireAuth);
const id = Joi.string().hex().length(24).required();
const handle = (action: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response) => {
  try { res.json({ data: await action(req) }); }
  catch (cause) { res.status(400).json({ message: cause instanceof Error ? cause.message : "Không thể xử lý yêu cầu." }); }
};
contentSafetyRouter.post("/reports",
  rateLimit({ windowMs: 60000, limit: 10, keyGenerator: (req: AuthenticatedRequest) => req.user!.id, standardHeaders: true, legacyHeaders: false }),
  validateRequest({ body: Joi.object({ targetType: Joi.string().valid("profile", "resource").required(), targetId: id,
    reason: Joi.string().valid("harassment", "sexual", "violence", "spam", "other").required(), details: Joi.string().allow("").max(2000).default("") }) }),
  handle(async req => contentSafetyService.report({ userId: req.user!.id, companyCode: req.user!.companyCode || "SYSTEM", role: req.user!.role,
    branchId: req.user!.branchId, permissions: await getEffectivePermissions(req.user!.id, req.user!.role, req.user!.companyCode) },
    req.body.targetType, req.body.targetId, req.body.reason, req.body.details).then(report => ({ id: report._id }))));
contentSafetyRouter.get("/moderation", requirePermission("chat:manage"), handle(req => contentSafetyService.moderation(req.user!.companyCode || "SYSTEM")));
contentSafetyRouter.patch("/moderation/:id", requirePermission("chat:manage"), validateRequest({ params: Joi.object({ id }),
  body: Joi.object({ action: Joi.string().valid("approve", "remove", "suspend", "dismiss").required() }) }),
  handle(req => contentSafetyService.resolve(req.user!.companyCode || "SYSTEM", req.params.id, req.user!.id, req.body.action)));
