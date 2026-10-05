import { Router } from "express";
import Joi from "joi";
import { resourceController } from "../controller/resource.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";

export const resourceRouter = Router();

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

const listSchema = {
  query: Joi.object({
    section: Joi.string().valid("local", "drive").optional(),
    parentId: Joi.string().allow("", "root").optional(),
  }).unknown(true),
};

const folderSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200).required().messages({
      "any.required": "Tên thư mục là bắt buộc.",
      "string.empty": "Tên thư mục không được để trống.",
    }),
    parentId: Joi.string().allow(null, "", "root").optional(),
    section: Joi.string().valid("local", "drive").optional(),
    roomId: Joi.string().allow(null, "").optional(),
  }),
};

const fileSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(300).required(),
    fileUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).required().messages({
      "any.required": "Đường dẫn file là bắt buộc.",
      "string.uri": "Đường dẫn file phải là URL hợp lệ.",
    }),
    parentId: Joi.string().allow(null, "", "root").optional(),
    mimeType: Joi.string().allow("").optional(),
    size: Joi.number().min(0).optional(),
    roomId: Joi.string().allow(null, "").optional(),
  }),
};

const driveSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(300).required(),
    driveLink: Joi.string().trim().uri({ scheme: ["http", "https"] }).required().messages({
      "any.required": "Link Google Drive là bắt buộc.",
      "string.uri": "Link Google Drive phải là URL hợp lệ.",
    }),
    driveType: Joi.string()
      .valid("folder", "document", "spreadsheet", "presentation", "pdf", "file")
      .optional(),
  }),
};

const driveUploadSchema = {
  body: Joi.object({
    file: Joi.string().required().messages({ "any.required": "Thiếu dữ liệu file." }),
    name: Joi.string().trim().min(1).max(300).required(),
    mimeType: Joi.string().allow("").optional(),
  }),
};

const renameSchema = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({ name: Joi.string().trim().min(1).max(300).required() }),
};

const moveSchema = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    parentId: Joi.string().allow(null, "", "root").required().messages({
      "any.required": "Mã thư mục đích là bắt buộc.",
    }),
  }),
};

const idParamSchema = {
  params: Joi.object({ id: objectId.required() }),
};

const sharesSchema = {
  body: Joi.array().items(
    Joi.object({
      targetId: Joi.string().required(),
      targetType: Joi.string().valid("user", "room").required(),
      targetName: Joi.string().allow("").optional(),
    })
  ).required(),
};

// Google Drive dùng chung — đặt trước các route "/:id" để tránh trùng khớp
resourceRouter.get("/drive/files", requireAuth, requirePermission("resource:read"), resourceController.driveList);
resourceRouter.post("/drive/upload", expensiveApiRateLimiter, requireAuth, requirePermission("resource:manage"), validateRequest(driveUploadSchema), resourceController.driveUpload);
resourceRouter.delete("/drive/files/:fileId", requireAuth, requirePermission("resource:manage"), resourceController.driveDelete);

resourceRouter.get("/", requireAuth, requirePermission("resource:read"), validateRequest(listSchema), resourceController.list);
resourceRouter.get("/trash", requireAuth, requirePermission("resource:read"), resourceController.trashList);
resourceRouter.get("/breadcrumb/:id", requireAuth, requirePermission("resource:read"), resourceController.breadcrumb);
resourceRouter.get("/:id", requireAuth, requirePermission("resource:read"), validateRequest(idParamSchema), resourceController.getDetail);
resourceRouter.post("/folder", requireAuth, requirePermission("resource:manage"), validateRequest(folderSchema), resourceController.createFolder);
resourceRouter.post("/file", requireAuth, requirePermission("resource:manage"), validateRequest(fileSchema), resourceController.createFile);
resourceRouter.post("/drive", requireAuth, requirePermission("resource:manage"), validateRequest(driveSchema), resourceController.addDriveLink);
resourceRouter.get("/:id/shares", requireAuth, requirePermission("resource:read"), validateRequest(idParamSchema), resourceController.getShares);
resourceRouter.put("/:id/shares", requireAuth, requirePermission("resource:manage"), validateRequest(idParamSchema), validateRequest(sharesSchema), resourceController.updateShares);
resourceRouter.patch("/:id/rename", requireAuth, requirePermission("resource:manage"), validateRequest(renameSchema), resourceController.rename);
resourceRouter.patch("/:id/move", requireAuth, requirePermission("resource:manage"), validateRequest(moveSchema), resourceController.move);
resourceRouter.post("/:id/restore", requireAuth, requirePermission("resource:manage"), validateRequest(idParamSchema), resourceController.restore);
resourceRouter.delete("/:id", requireAuth, requirePermission("resource:manage"), validateRequest(idParamSchema), resourceController.remove);
resourceRouter.get("/:id/download-zip", requireAuth, requirePermission("resource:read"), resourceController.downloadZip);

