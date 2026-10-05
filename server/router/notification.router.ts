import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { notificationController } from "../controller/notification.controller";
import {
  getNotificationsSchema,
  createNotificationSchema,
  notificationIdParamsSchema,
} from "../validation/notification.validation";

export const notificationRouter = Router();

// Lấy danh sách thông báo phân trang của user
notificationRouter.get(
  "/",
  requireAuth,
  validateRequest(getNotificationsSchema),
  notificationController.getList
);

// Tạo thông báo mới (Test/System)
notificationRouter.post(
  "/",
  requireAuth,
  requirePermission("chat:manage"),
  validateRequest(createNotificationSchema),
  notificationController.create
);

// Các thao tác hộp thư cá nhân được giới hạn theo recipientUid trong service.
// Đánh dấu đọc tất cả thông báo
notificationRouter.patch(
  "/read-all",
  requireAuth,
  notificationController.markAllRead
);

// Đánh dấu đọc một thông báo
notificationRouter.patch(
  "/:id/read",
  requireAuth,
  validateRequest(notificationIdParamsSchema),
  notificationController.markRead
);

// Xóa thông báo
notificationRouter.delete(
  "/:id",
  requireAuth,
  validateRequest(notificationIdParamsSchema),
  notificationController.delete
);
export default notificationRouter;
