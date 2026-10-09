import { Router } from "express";
import mongoose from "mongoose";
import { authRouter } from "./auth.router";
import { chapterRouter } from "./chapter.router";
import { permissionRouter } from "./permission.router";
import { rolePermissionRouter } from "./role-permission.router";
import { crudRouter } from "./crud.router";
import { googleDriveRouter } from "./google-drive.router";
import { chatRouter } from "./chat.router";
import { chatbotRouter } from "./chatbot.router";
import { resourceRouter } from "./resource.router";
import { analyticsRouter } from "./analytics.router";
import { pushRouter } from "./push.router";
import { mediaRouter } from "./media.router";
import { notificationRouter } from "./notification.router";
import { requireAuth } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";
import { companyEmailRouter } from "./company-email.router";
import { companyPaymentRouter } from "./company-payment.router";
import { webhookRouter } from "./webhook.router";
import { meetingRouter } from "../modules/meetings/meeting.router";
import { meetingCheckInRouter } from "../modules/meetings/meeting-checkin.router";
import { meetingInteractionPublicRouter } from "../modules/meetings/meeting-interaction.router";

import { memberFeeRouter } from "../modules/member-fees/member-fee.router";

export const apiRouter = Router();
apiRouter.use("/member-fees", memberFeeRouter);

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
apiRouter.use("/resources", requireAuth, requireModule("resource"), resourceRouter);

// Gắn kết router phụ của Xác thực JWT
apiRouter.use("/auth", authRouter);
apiRouter.use("/chapters", chapterRouter);

// Gắn kết router phụ của Quản lý mã quyền hệ thống
apiRouter.use("/permissions", permissionRouter);

// Gắn kết router phụ của Cấu hình gán quyền cho Role theo doanh nghiệp
apiRouter.use("/role-permissions", rolePermissionRouter);

// Gắn kết router CRUD đa năng (MongoDB)
apiRouter.use("/crud", crudRouter);

apiRouter.use("/meetings", meetingRouter);
apiRouter.use("/meeting-checkin", meetingCheckInRouter);
apiRouter.use("/meeting-interaction", meetingInteractionPublicRouter);

apiRouter.use("/company-email", companyEmailRouter);
apiRouter.use("/company-payment", companyPaymentRouter);


// Phân tích & báo cáo
apiRouter.use("/analytics", analyticsRouter);

// Upload/download file qua Cloudinary
apiRouter.use("/media", expensiveApiRateLimiter, mediaRouter);

// Gắn kết router Web Push
apiRouter.use("/push", pushRouter);

// Gắn kết router thông báo web
apiRouter.use("/notifications", notificationRouter);

// Gắn kết router chat nội bộ
apiRouter.use("/chat", requireAuth, requireModule("chat"), chatRouter);

// Trợ lý ảo AI — chatbot ngữ cảnh dữ liệu doanh nghiệp
apiRouter.use("/chatbot", expensiveApiRateLimiter, requireAuth, requireModule("chat"), chatbotRouter);

// Quản lý cuộc họp & Quay thưởng (Meetings & Lucky Draw)
apiRouter.use("/meetings", meetingRouter);
