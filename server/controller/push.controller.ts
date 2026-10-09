import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { pushService } from "../service/push.service";
import { mobilePushService } from "../service/mobile-push.service";

export const pushController = {
  async subscribeMobile(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { token, platform, deviceName } = req.body;
      await mobilePushService.saveToken({ uid, companyCode, token, platform, deviceName });
      return res.status(200).json({ status: "success", message: "Đã đăng ký thiết bị nhận thông báo." });
    } catch (error) {
      console.error("[pushController.subscribeMobile] Error:", error);
      const message = error instanceof Error ? error.message : "Không thể đăng ký thiết bị nhận thông báo.";
      return res.status(message.includes("không hợp lệ") ? 400 : 500).json({ status: "error", message });
    }
  },

  async unsubscribeMobile(req: AuthenticatedRequest, res: Response) {
    try {
      await mobilePushService.removeToken(req.user!.id, req.body.token);
      return res.status(200).json({ status: "success", message: "Đã hủy thông báo trên thiết bị." });
    } catch (error) {
      console.error("[pushController.unsubscribeMobile] Error:", error);
      return res.status(500).json({ status: "error", message: "Không thể hủy thông báo trên thiết bị." });
    }
  },

  /**
   * GET /api/v1/push/public-key
   */
  async getPublicKey(req: AuthenticatedRequest, res: Response) {
    try {
      const publicKey = pushService.getPublicKey();
      if (!publicKey) {
        return res.status(503).json({
          status: "error",
          message: "Web Push chưa được cấu hình trên máy chủ (thiếu VAPID keys).",
        });
      }
      return res.status(200).json({ status: "success", data: { publicKey } });
    } catch (error) {
      console.error("[pushController.getPublicKey] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi lấy khóa Web Push.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/push/subscribe
   */
  async subscribe(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { subscription, userAgent } = req.body;

      await pushService.saveSubscription(uid, companyCode, subscription, userAgent);
      return res.status(200).json({ status: "success", message: "Đã đăng ký nhận thông báo đẩy." });
    } catch (error) {
      console.error("[pushController.subscribe] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi đăng ký thông báo đẩy.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/push/unsubscribe
   */
  async unsubscribe(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user!.id;
      const { endpoint } = req.body;

      await pushService.removeSubscription(uid, endpoint);
      return res.status(200).json({ status: "success", message: "Đã hủy đăng ký thông báo đẩy." });
    } catch (error) {
      console.error("[pushController.unsubscribe] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi hủy đăng ký thông báo đẩy.",
        details: error.message,
      });
    }
  },
};
