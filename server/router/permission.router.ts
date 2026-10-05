import { Router } from "express";
import Joi from "joi";
import { permissionController } from "../controller/permission.controller";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

export const permissionRouter = Router();

const createPermissionSchema = {
  body: Joi.object({
    code: Joi.string().required().messages({
      "any.required": "Mã quyền là bắt buộc.",
      "string.empty": "Mã quyền không được để trống.",
    }),
    name: Joi.string().required().messages({
      "any.required": "Tên mã quyền là bắt buộc.",
      "string.empty": "Tên mã quyền không được để trống.",
    }),
    module: Joi.string().required().messages({
      "any.required": "Phân hệ của quyền là bắt buộc.",
      "string.empty": "Phân hệ của quyền không được để trống.",
    }),
    description: Joi.string().optional().allow(""),
  }),
};

const updatePermissionSchema = {
  params: Joi.object({
    code: Joi.string().required().messages({
      "any.required": "Mã quyền trong params là bắt buộc.",
    }),
  }),
  body: Joi.object({
    name: Joi.string().optional().messages({
      "string.empty": "Tên mã quyền không được để trống.",
    }),
    module: Joi.string().optional().messages({
      "string.empty": "Phân hệ của quyền không được để trống.",
    }),
    description: Joi.string().optional().allow(""),
  }),
};

const permissionCodeParamsSchema = {
  params: Joi.object({
    code: Joi.string().required().messages({
      "any.required": "Mã quyền trong params là bắt buộc.",
    }),
  }),
};

const getPermissionsQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    module: Joi.string().optional(),
    search: Joi.string().optional().allow(""),
  }),
};

// 1. Tạo mới mã quyền (chỉ dành cho admin)
permissionRouter.post(
  "/",
  requireAuth,
  requireRole(["admin"]),
  requirePermission("access:manage"),
  validateRequest(createPermissionSchema),
  permissionController.create
);

// 2. Lấy danh sách mã quyền (yêu cầu đã đăng nhập)
permissionRouter.get(
  "/",
  requireAuth,
  validateRequest(getPermissionsQuerySchema),
  permissionController.getList
);

// 3. Lấy chi tiết một mã quyền (yêu cầu đã đăng nhập)
permissionRouter.get(
  "/:code",
  requireAuth,
  validateRequest(permissionCodeParamsSchema),
  permissionController.getDetail
);

// 4. Cập nhật mã quyền (chỉ dành cho admin)
permissionRouter.patch(
  "/:code",
  requireAuth,
  requireRole(["admin"]),
  requirePermission("access:manage"),
  validateRequest(updatePermissionSchema),
  permissionController.update
);

// 5. Xóa mã quyền (chỉ dành cho admin)
permissionRouter.delete(
  "/:code",
  requireAuth,
  requireRole(["admin"]),
  requirePermission("access:manage"),
  validateRequest(permissionCodeParamsSchema),
  permissionController.delete
);
