import { Router } from "express";
import mongoose from "mongoose";
import { authRouter } from "./auth.router";
import { permissionRouter } from "./permission.router";
import { rolePermissionRouter } from "./role-permission.router";
import { crudRouter } from "./crud.router";
import { googleDriveRouter } from "./google-drive.router";
import { chatRouter } from "./chat.router";
import { chatbotRouter } from "./chatbot.router";
import { resourceRouter } from "./resource.router";
import { timekeepingRouter } from "./timekeeping.router";
import { dashboardRouter } from "./dashboard.router";
import { analyticsRouter } from "./analytics.router";
import { pushRouter } from "./push.router";
import { mediaRouter } from "./media.router";
import { notificationRouter } from "./notification.router";
import { requireAuth } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";
import { faceManagementRouter } from "./face-management.router";
import { leaveRouter } from "./leave.router";
import { companyEmailRouter } from "./company-email.router";
import { companyPaymentRouter } from "./company-payment.router";
import { webhookRouter } from "./webhook.router";
import { meetingRouter } from "../modules/meetings/meeting.router";
import { meetingCheckInRouter } from "../modules/meetings/meeting-checkin.router";

export const apiRouter = Router();

// Webhooks
apiRouter.use("/webhook", webhookRouter);

/**
 * GET /api/v1/health
 * Health Check API để giám sát trạng thái của hệ thống
 */
apiRouter.get("/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      server: "up",
      database: isDbConnected ? "online (connected via MongoDB)" : "offline",
    },
  });
});

// Gắn kết router phụ của Google Drive Tích hợp cá nhân
apiRouter.use("/integrations/google-drive", googleDriveRouter);

// Quản lý tài nguyên — file explorer nội bộ + tài liệu Google Drive
apiRouter.use("/resources", requireAuth as any, requireModule("resource"), resourceRouter);

// Gắn kết router phụ của Xác thực JWT
apiRouter.use("/auth", authRouter);

// Gắn kết router phụ của Quản lý mã quyền hệ thống
apiRouter.use("/permissions", permissionRouter);

// Gắn kết router phụ của Cấu hình gán quyền cho Role theo doanh nghiệp
apiRouter.use("/role-permissions", rolePermissionRouter);
apiRouter.use("/face-management", faceManagementRouter);

// Gắn kết router CRUD đa năng (MongoDB)
apiRouter.use("/crud", crudRouter);

apiRouter.use("/meetings", meetingRouter);
apiRouter.use("/meeting-checkin", meetingCheckInRouter);

// Gắn kết router chấm công (GPS Timekeeping)
apiRouter.use("/timekeeping", requireAuth as any, requireModule("hr"), timekeepingRouter);
apiRouter.use("/leave", leaveRouter);
apiRouter.use("/company-email", companyEmailRouter);
apiRouter.use("/company-payment", companyPaymentRouter);

// Gắn kết router tổng hợp số liệu trang tổng quan
apiRouter.use("/dashboard", dashboardRouter);

// Phân tích & báo cáo
apiRouter.use("/analytics", analyticsRouter);

// Upload/download file qua Cloudinary
apiRouter.use("/media", expensiveApiRateLimiter, mediaRouter);

// Gắn kết router Web Push
apiRouter.use("/push", pushRouter);

// Gắn kết router thông báo web
apiRouter.use("/notifications", notificationRouter);

// Gắn kết router chat nội bộ
apiRouter.use("/chat", requireAuth as any, requireModule("chat"), chatRouter);

// Trợ lý ảo AI — chatbot ngữ cảnh dữ liệu doanh nghiệp
apiRouter.use("/chatbot", expensiveApiRateLimiter, requireAuth as any, requireModule("chat"), chatbotRouter);

// Quản lý cuộc họp & Quay thưởng (Meetings & Lucky Draw)
apiRouter.use("/meetings", meetingRouter);
