import { Router } from "express";
import Joi from "joi";
import { crudController } from "../controller/crud.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";

export const crudRouter = Router();
export const SUPPORTED_CRUD_MODELS = ["users"] as const;
export const CRUD_MODEL_PERMISSION_POLICY = { users: { read: "access:read" } };
export const crudReadPermissionGuard = (req: any, res: any, next: any) => {
  if (req.params.modelName !== "users") return res.status(404).json({ status: "error", message: "Tài nguyên không còn được hỗ trợ." });
  return requirePermission("access:read")(req, res, next);
};
const modelName = Joi.string().valid(...SUPPORTED_CRUD_MODELS).required();
const listSchema = {
  params: Joi.object({ modelName }),
  query: Joi.object({ page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1), sort: Joi.string(), search: Joi.string().allow("") }).unknown(true),
};
const detailSchema = { params: Joi.object({ modelName, id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required() }) };
crudRouter.get("/:modelName", requireAuth as any, crudReadPermissionGuard, validateRequest(listSchema), crudController.getList as any);
crudRouter.get("/:modelName/:id", requireAuth as any, crudReadPermissionGuard, validateRequest(detailSchema), crudController.getById as any);
