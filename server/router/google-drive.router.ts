import { Router } from "express";
import { googleDriveController } from "../controller/google-drive.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";
import { requireModule } from "../middleware/require-module";

export const googleDriveRouter = Router();

// Route lấy danh sách tài nguyên cá nhân
googleDriveRouter.get("/resources", requireAuth, requireModule("resource"), requirePermission("resource:read"), googleDriveController.getResources);

// Route lấy danh sách tài nguyên nhóm
googleDriveRouter.get("/resources/group/:roomId", requireAuth, requireModule("resource"), requirePermission("resource:read"), googleDriveController.getGroupResources);

// Route upload tài nguyên cá nhân
googleDriveRouter.post("/upload", expensiveApiRateLimiter, requireAuth, requireModule("resource"), requirePermission("resource:manage"), googleDriveController.uploadResource);

// Route upload tài nguyên nhóm
googleDriveRouter.post("/upload/group/:roomId", expensiveApiRateLimiter, requireAuth, requireModule("resource"), requirePermission("resource:manage"), googleDriveController.uploadGroupResource);

// Route tạo tài liệu/thư mục mới trên Google Drive
googleDriveRouter.post("/create-file", requireAuth, requireModule("resource"), requirePermission("resource:manage"), googleDriveController.createFile);

// Route cập nhật quyền tải lên tài nguyên nhóm
googleDriveRouter.put("/groups/:roomId/permissions", requireAuth, requireModule("resource"), requirePermission("resource:manage"), googleDriveController.updateGroupPermissions);

// Route xóa tài nguyên
googleDriveRouter.delete("/resources/:id", requireAuth, requireModule("resource"), requirePermission("resource:manage"), googleDriveController.deleteResource);

// Route di chuyển tài nguyên
googleDriveRouter.post("/resources/move", requireAuth, requireModule("resource"), requirePermission("resource:manage"), googleDriveController.moveResource);

// Route đổi tên tài nguyên
googleDriveRouter.patch("/resources/:id/rename", requireAuth, requireModule("resource"), requirePermission("resource:manage"), googleDriveController.renameResource);
