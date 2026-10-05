import { normalizeLoginIdentifier } from "../../src/utils/loginIdentifier";
import { Router } from "express";
import Joi from "joi";
import { authController } from "../controller/auth.controller";
import { requireAuth, requireRole, requirePermission, requireCompanyAccess, requireHierarchyAccess } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { authRateLimiter, loginAccountRateLimiter, refreshTokenRateLimiter } from "../middleware/rate-limit";
import { UserModel } from "../model/user.model";
import { isIP } from "node:net";
import { branchController } from "../controller/branch.controller";

import { importUsers, UserImportError } from "../service/user-import.service";

export const authRouter = Router();

authRouter.post("/users/import", requireAuth, requireRole(["admin"]), requirePermission("access:manage"), async (req, res) => {
  try { res.json({ data: await importUsers(req.body, req.user) }); }
  catch (error) { res.status(error instanceof UserImportError ? error.status : 500).json({ message: error instanceof UserImportError ? error.message : "Không thể nhập tài khoản. Vui lòng thử lại." }); }
});

// Định nghĩa regex cho email và số điện thoại Việt Nam
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const vnPhoneRegex = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;

export const allowedPublicIpSchema = Joi.string().trim().custom((value, helpers) => {
  if (isIP(value) !== 0) return value;
  const cidr = value.match(/^(.+)\/(\d+)$/);
  if (cidr && isIP(cidr[1]) === 6 && cidr[2] === "64") return value;
  return helpers.error("string.ip");
}, "IPv4, IPv6 or IPv6 /64 network");

const branchFields = {
  code: Joi.string().trim().min(1).max(32).pattern(/^[A-Za-z0-9_-]+$/).required(),
  name: Joi.string().trim().min(1).max(120).required(),
  address: Joi.string().trim().max(255).allow("").optional(),
  phone: Joi.string().trim().max(32).allow("").optional(),
  managerId: Joi.string().trim().max(64).allow("").optional(),
  locationConfig: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    allowedRadius: Joi.number().min(1).required(),
    allowedPublicIps: Joi.array().items(allowedPublicIpSchema).min(1).unique().required(),
  }).unknown(false).optional(),
  isActive: Joi.boolean().optional(),
};
const createBranchSchema = { body: Joi.object(branchFields).unknown(false) };
const updateBranchSchema = { body: Joi.object({ ...branchFields, code: branchFields.code.optional(), name: branchFields.name.optional() }).min(1).unknown(false) };
export const createBranchOwnerSchema = { body: Joi.object({
  displayName: Joi.string().trim().min(1).max(120).required(),
  email: Joi.string().pattern(emailRegex).required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().trim().max(32).allow("").optional(),
  birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow(""),
}).unknown(false) };

const registerSchema = {
  body: Joi.object({
    email: Joi.string().pattern(emailRegex).required().messages({
      "any.required": "Trường 'email' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'email' không được để trống.",
      "string.pattern.base": "Địa chỉ email không đúng định dạng.",
    }),
    password: Joi.string().min(6).required().messages({
      "any.required": "Trường 'password' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'password' không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
    displayName: Joi.string().required().messages({
      "any.required": "Trường 'displayName' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'displayName' không được để trống.",
    }),
    photoURL: Joi.string().uri().optional().allow("").messages({
      "string.uri": "photoURL phải là một đường dẫn URL hợp lệ.",
    }),
    // Lưu ý bảo mật: KHÔNG cho phép client tự đặt role/companyCode/parentId qua
    // endpoint đăng ký công khai này — các trường đó chỉ được gán qua
    // register-company/register-user (đã kiểm tra xác thực + phân quyền).
    companyName: Joi.string().optional().allow(""),
    branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(""),
    monthlySalary: Joi.number().min(0).optional(),
    phone: Joi.string().pattern(vnPhoneRegex).optional().allow("").messages({
      "string.pattern.base": "Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321).",
    }),
  }),
};

const loginIdentifierSchema = Joi.string().trim().max(254).custom((value, helpers) => normalizeLoginIdentifier(value) ? value : helpers.error("any.invalid"));
export const loginSchema = {
  body: Joi.object({
    identifier: loginIdentifierSchema,
    email: loginIdentifierSchema,
    password: Joi.string().required(),
  }).xor("identifier", "email"),
};

const updateProfileSchema = {
  body: Joi.object({
    displayName: Joi.string().optional().messages({
      "string.empty": "Tên hiển thị không được để trống.",
    }),
    photoURL: Joi.string().optional().allow("").messages({
      "string.uri": "Ảnh đại diện phải là một đường dẫn URL hợp lệ.",
    }),
    coverImage: Joi.string().optional().allow(""),
    industry: Joi.string().optional().allow(""),
    phone: Joi.string().pattern(vnPhoneRegex).optional().allow(""),
    birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow("", null),
    gender: Joi.string().valid("male", "female", "other").optional().allow(""),
    address: Joi.string().trim().max(300).optional().allow(""),
    targetMarket: Joi.string().trim().max(500).optional().allow(""),
    companyName: Joi.string().optional().allow(""),
    photoUploadToken: Joi.string().trim().optional(),
    coverUploadToken: Joi.string().trim().optional(),
  }),
};

// Đăng ký tài khoản mới: chặn brute-force theo từng email + backstop theo IP chống spray từ 1 IP.
authRouter.post("/register", loginAccountRateLimiter, authRateLimiter, validateRequest(registerSchema), authController.register);

// Đăng nhập: chặn brute-force theo từng tài khoản đích + backstop theo IP (không khoá oan văn phòng NAT).
authRouter.post("/login", loginAccountRateLimiter, authRateLimiter, validateRequest(loginSchema), authController.login);

// Làm mới Access Token bằng Refresh Token
authRouter.post("/refresh-token", refreshTokenRateLimiter, authController.refreshToken);

// Đăng xuất tài khoản (yêu cầu Access Token)
authRouter.post("/logout", requireAuth, authController.logout);

// Lấy thông tin tài khoản hiện tại (yêu cầu Access Token)
authRouter.get("/me", requireAuth, authController.getMe);
const deleteOwnAccountSchema = {
  body: Joi.object({
    password: Joi.string().max(1024).required(),
    confirmation: Joi.string().valid("XÓA TÀI KHOẢN").required(),
  }),
};
authRouter.delete("/me", requireAuth, authRateLimiter, validateRequest(deleteOwnAccountSchema), authController.deleteOwnAccount);


// Cập nhật thông tin tài khoản hiện tại (yêu cầu Access Token)
authRouter.patch("/profile", requireAuth, validateRequest(updateProfileSchema), authController.updateProfile);

const changePasswordSchema = {
  body: Joi.object({
    password: Joi.string().min(6).required().messages({
      "any.required": "Trường 'password' là bắt buộc.",
      "string.empty": "Trường 'password' không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
  }),
};

// Thay đổi mật khẩu người dùng hiện tại (yêu cầu Access Token)
authRouter.post("/change-password", authRateLimiter, requireAuth, validateRequest(changePasswordSchema), authController.changePassword);

const registerCompanySchema = {
  body: Joi.object({
    companyName: Joi.string().required().messages({
      "any.required": "Tên doanh nghiệp là bắt buộc.",
      "string.empty": "Tên doanh nghiệp không được để trống.",
    }),
    companyCode: Joi.string().required().messages({
      "any.required": "Mã doanh nghiệp là bắt buộc.",
      "string.empty": "Mã doanh nghiệp không được để trống.",
    }),
    ownerName: Joi.string().required().messages({
      "any.required": "Tên người đại diện là bắt buộc.",
      "string.empty": "Tên người đại diện không được để trống.",
    }),
    ownerEmail: Joi.string().pattern(emailRegex).required().messages({
      "any.required": "Email người đại diện là bắt buộc.",
      "string.empty": "Email không được để trống.",
      "string.pattern.base": "Email người đại diện không đúng định dạng.",
    }),
    ownerPassword: Joi.string().min(6).required().messages({
      "any.required": "Mật khẩu là bắt buộc.",
      "string.empty": "Mật khẩu không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
    enabledModules: Joi.array().items(Joi.string()).optional(),
    businessType: Joi.string().valid("education", "labor", "service", "recruitment", "general").optional(),
    entityPreset: Joi.string().valid("student", "worker", "customer", "candidate").optional(),
  }),
};

// Đăng ký doanh nghiệp và tài khoản Admin (yêu cầu Access Token và vai trò admin)
authRouter.post("/register-company", requireAuth, requireRole(["admin"]), validateRequest(registerCompanySchema), authController.registerCompany);

const registerUserSchema = {
  body: Joi.object({
    displayName: Joi.string().required().messages({
      "any.required": "Tên thành viên là bắt buộc.",
      "string.empty": "Tên thành viên không được để trống.",
    }),
    email: Joi.string().pattern(emailRegex).required().messages({
      "any.required": "Email thành viên là bắt buộc.",
      "string.empty": "Email không được để trống.",
      "string.pattern.base": "Email thành viên không đúng định dạng.",
    }),
    password: Joi.string().min(6).required().messages({
      "any.required": "Mật khẩu là bắt buộc.",
      "string.empty": "Mật khẩu không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
    role: Joi.string().required().messages({
      "any.required": "Vai trò thành viên là bắt buộc.",
    }),
    companyCode: Joi.string().optional().allow(""),
    companyName: Joi.string().optional().allow(""),
    industry: Joi.string().optional().allow(""),
    photoURL: Joi.string().optional().allow(""),
    coverImage: Joi.string().optional().allow(""),
    galleryImages: Joi.array().items(Joi.string().uri()).max(5).optional(),
    galleryUploadTokens: Joi.array().items(Joi.object({
      index: Joi.number().integer().min(0).max(4).required(),
      uploadToken: Joi.string().trim().required(),
    }).unknown(false)).max(5).optional(),
    parentId: Joi.string().optional().allow(""),
    monthlySalary: Joi.number().min(0).optional(),
    birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow("", null),
    gender: Joi.string().valid("male", "female", "other").optional().allow(""),
    address: Joi.string().trim().max(300).optional().allow(""),
    targetMarket: Joi.string().trim().max(500).optional().allow(""),
    phone: Joi.string().pattern(vnPhoneRegex).optional().allow("").messages({
      "string.pattern.base": "Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321).",
    }),
    branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow("", null),
    jobDescriptionLink: Joi.string().uri().optional().allow(""),
    jobDescriptionUploadToken: Joi.string().trim().optional(),
  }),
};

// Đăng ký thành viên mới của doanh nghiệp (yêu cầu Access Token và quyền access:manage)
authRouter.post("/register-user", requireAuth, requirePermission("access:manage"), validateRequest(registerUserSchema), authController.registerUser);

const getUsersSchema = {
  query: Joi.object({
    companyCode: Joi.string().optional().allow(""),
    branchId: Joi.string().optional().allow(""),
  }),
};

// Lấy danh sách thành viên cùng công ty cho tất cả user (để dùng trong tính năng chia sẻ tài nguyên, chat...)
authRouter.get("/users/colleagues", requireAuth, authController.getColleagues);

// Lấy danh sách thành viên doanh nghiệp (yêu cầu Access Token và quyền access:read)
// hr:read cũng được chấp nhận: xem danh sách nhân sự là một phần tự nhiên của "Xem nhân sự"
// (sơ đồ tổ chức, lịch, giao việc trong module HR đều cần roster này để hiển thị).
authRouter.get("/users", requireAuth, requirePermission(["access:read", "hr:read"]), validateRequest(getUsersSchema), authController.getUsers);
authRouter.get("/users/:id/activity", requireAuth, requireRole(["admin"]), async (_req, res) => {
  return res.json({ items: [], total: 0 });
});

authRouter.get("/current-ip", requireAuth, requirePermission("access:manage"), branchController.currentIp);
authRouter.get("/branches", requireAuth, requirePermission(["access:read", "hr:read"]), branchController.list);
authRouter.post("/branches", requireAuth, requirePermission("access:manage"), validateRequest(createBranchSchema), branchController.create);
authRouter.post("/branches/:id/owner", requireAuth, requirePermission("access:manage"), validateRequest(createBranchOwnerSchema), branchController.createOwner);
authRouter.delete("/branches/:id/pending", requireAuth, requirePermission("access:manage"), branchController.removePending);
authRouter.patch("/branches/:id", requireAuth, requirePermission("access:manage"), validateRequest(updateBranchSchema), branchController.update);

const companyCodeParamSchema = {
  params: Joi.object({
    code: Joi.string().min(1).required(),
  }),
};




// Google Drive per-company qua OAuth (Quản lý tài nguyên)
// Lưu ý: callback phải đặt TRƯỚC route "/companies/:code/drive" để không bị nuốt bởi ":code".
authRouter.get(
  "/companies/drive/oauth-callback",
  authController.driveOAuthCallback
);

authRouter.get(
  "/companies/:code/drive",
  requireAuth,
  validateRequest(companyCodeParamSchema),
  authController.getCompanyDriveConfig
);

authRouter.get(
  "/companies/:code/drive/oauth-url",
  requireAuth,
  requirePermission("resource:manage"),
  validateRequest(companyCodeParamSchema),
  authController.getDriveOAuthUrl
);

authRouter.post(
  "/companies/:code/drive/disconnect",
  requireAuth,
  requirePermission("resource:manage"),
  validateRequest(companyCodeParamSchema),
  authController.disconnectDrive
);


const bulkUpdateUsersSchema = {
  body: Joi.object({
    updates: Joi.array().items(
      Joi.object({
        id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
          "any.required": "Trường 'id' là bắt buộc đối với mỗi cập nhật.",
          "string.pattern.base": "ID người dùng không đúng định dạng.",
        }),
        parentId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null, ""),
        role: Joi.string().optional(),
      })
    ).required().messages({
      "any.required": "Danh sách 'updates' là bắt buộc.",
    }),
  }),
};

const updateUserSchema = {
  params: Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
      "any.required": "ID người dùng là bắt buộc.",
      "string.pattern.base": "ID người dùng không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    role: Joi.string().optional(),
    parentId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null, ""),
    displayName: Joi.string().optional().allow(""),
    email: Joi.string().pattern(emailRegex).optional(),
    password: Joi.string().min(6).optional().allow(""),
    companyCode: Joi.string().optional().allow(""),
    companyName: Joi.string().optional().allow(""),
    industry: Joi.string().optional().allow(""),
    photoURL: Joi.string().optional().allow(""),
    coverImage: Joi.string().optional().allow(""),
    galleryImages: Joi.array().items(Joi.string().uri()).max(5).optional(),
    galleryUploadTokens: Joi.array().items(Joi.object({
      index: Joi.number().integer().min(0).max(4).required(),
      uploadToken: Joi.string().trim().required(),
    }).unknown(false)).max(5).optional(),
    gender: Joi.string().valid("male", "female", "other").optional().allow(""),
    address: Joi.string().trim().max(300).optional().allow(""),
    targetMarket: Joi.string().trim().max(500).optional().allow(""),
    branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow("", null),
    monthlySalary: Joi.number().min(0).optional(),
    birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow("", null),
    phone: Joi.string().pattern(vnPhoneRegex).optional().allow("").messages({
      "string.pattern.base": "Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321).",
    }),
    jobDescriptionLink: Joi.string().uri().optional().allow(""),
    jobDescriptionUploadToken: Joi.string().trim().optional(),
  }),
};

const deleteUserSchema = {
  params: Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
      "any.required": "ID người dùng cần xóa là bắt buộc.",
      "string.pattern.base": "ID người dùng không đúng định dạng.",
    }),
  }),
};

// Cập nhật cấu trúc sơ đồ tổ chức hàng loạt (yêu cầu Access Token và quyền access:manage)
authRouter.patch("/users/bulk", requireAuth, requirePermission("access:manage"), validateRequest(bulkUpdateUsersSchema), authController.bulkUpdateUsers);

// Cập nhật chi tiết một thành viên (yêu cầu Access Token, quyền access:manage, thuộc cùng công ty và thuộc nhánh quản lý nếu là manager)
authRouter.patch("/users/:id", requireAuth, requirePermission("access:manage"), requireCompanyAccess(UserModel, "id"), requireHierarchyAccess("id"), validateRequest(updateUserSchema), authController.updateUser);

// Xóa thành viên và điều chuyển cấp dưới (yêu cầu Access Token, quyền access:manage, thuộc cùng công ty và thuộc nhánh quản lý nếu là manager)
authRouter.delete("/users/:id", requireAuth, requirePermission("access:manage"), requireCompanyAccess(UserModel, "id"), requireHierarchyAccess("id"), validateRequest(deleteUserSchema), authController.deleteUser);
