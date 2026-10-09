import { Router } from "express";
import Joi from "joi";
import { pushController } from "../controller/push.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

export const pushRouter = Router();

const subscribeSchema = {
  body: Joi.object({
    subscription: Joi.object({
      endpoint: Joi.string().uri().required().messages({
        "any.required": "Thiếu endpoint của subscription.",
        "string.uri": "Endpoint subscription không hợp lệ.",
      }),
      expirationTime: Joi.any().optional(),
      keys: Joi.object({
        p256dh: Joi.string().required(),
        auth: Joi.string().required(),
      })
        .required()
        .unknown(true),
    })
      .required()
      .unknown(true),
    userAgent: Joi.string().optional().allow(""),
  }),
};

const unsubscribeSchema = {
  body: Joi.object({
    endpoint: Joi.string().uri().required().messages({
      "any.required": "Thiếu endpoint cần hủy đăng ký.",
      "string.uri": "Endpoint không hợp lệ.",
    }),
  }),
};

const mobileSubscribeSchema = {
  body: Joi.object({
    token: Joi.string().trim().min(20).max(4096).pattern(/^\S+$/).required(),
    platform: Joi.string().valid("android", "ios").required(),
    provider: Joi.string().valid("fcm").optional(),
    deviceName: Joi.string().max(160).optional().allow(""),
  }),
};

const mobileUnsubscribeSchema = {
  body: Joi.object({
    token: Joi.string().trim().min(20).max(4096).pattern(/^\S+$/).required(),
  }),
};

// Lấy VAPID public key để frontend đăng ký push
pushRouter.get("/public-key", requireAuth, pushController.getPublicKey);

// Đăng ký nhận thông báo đẩy cho thiết bị hiện tại
pushRouter.post(
  "/subscribe",
  requireAuth,
  requirePermission("people:manage"),
  validateRequest(subscribeSchema),
  pushController.subscribe
);

// Hủy đăng ký thông báo đẩy
pushRouter.post(
  "/unsubscribe",
  requireAuth,
  requirePermission("people:manage"),
  validateRequest(unsubscribeSchema),
  pushController.unsubscribe
);

// Mobile push là đăng ký cá nhân, mọi tài khoản đã xác thực đều được quản lý thiết bị của chính mình.
pushRouter.post(
  "/mobile/subscribe",
  requireAuth,
  validateRequest(mobileSubscribeSchema),
  pushController.subscribeMobile,
);

pushRouter.post(
  "/mobile/unsubscribe",
  requireAuth,
  validateRequest(mobileUnsubscribeSchema),
  pushController.unsubscribeMobile,
);
