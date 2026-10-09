import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { getJwtAccessSecret } from "../config/env";
import { expandEffectivePermissions, normalizeStoredPermissions } from "../config/permission-catalog";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyCode?: string;
    branchId?: string;
    sessionId?: string;
    authLevel?: string;
    displayName?: string;
    companyName?: string;
  };
  resource?: Record<string, unknown>; // Để đính kèm tài nguyên sau khi qua requireCompanyAccess
}

function shouldSkipRoutineAuthLog(method: string, url: string) {
  const normalizedMethod = String(method || "").toUpperCase();
  const normalizedUrl = String(url || "");

  if (normalizedMethod !== "GET" && normalizedMethod !== "POST") {
    return false;
  }

  const noisyPrefixes = [
    "/api/v1/crud/marketing-contents",
    "/api/v1/crud/crm-tickets",
    "/api/v1/crud/products",
    "/api/v1/wallet/balance",
    "/api/v1/gemini/media-history",
  ];

  return noisyPrefixes.some((prefix) => normalizedUrl.startsWith(prefix));
}

/**
 * Danh sách mã quyền mặc định của hệ thống cho từng vai trò
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: [],
  admin: ["dashboard:manage", "people:manage", "relationship:manage", "hr:manage", "meetings:manage", "resource:manage", "chat:manage", "settings:manage", "access:manage"],
  manager: [
    "dashboard:read", "access:read",
    "hr:read", "people:read", "meetings:read", "chat:read", "resource:read", "settings:manage"
  ],
  user: [
    "access:read", "hr:read", "people:read", "meetings:read", "chat:read", "resource:read"
  ],
  teacher: ["people:manage"]
};

/**
 * Cấp bậc mặc định của các vai trò hệ thống (Số nhỏ hơn = cấp cao hơn)
 */
export const DEFAULT_ROLE_LEVELS: Record<string, number> = {
  superadmin: 0,
  admin: 1,
  manager: 2,
  user: 3,
  teacher: 3
};

/**
 * Middleware yêu cầu đăng nhập bằng Access Token
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = "";
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    console.warn(`[requireAuth] Từ chối truy cập ${req.method} ${req.originalUrl}: Không tìm thấy Access Token.`);
    return res.status(401).json({
      status: "error",
      message: "Yêu cầu đăng nhập. Không tìm thấy mã xác thực.",
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtAccessSecret());
      if (typeof decoded === "string") throw new Error("Invalid token payload");

    const userDoc = await UserModel.findById(decoded.id).select("branchId displayName role companyCode email disabledAt").lean();
    if (!userDoc) {
      return res.status(401).json({ status: "error", message: "Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại." });
    }
    if (userDoc.disabledAt) return res.status(401).json({ status: "error", message: "Tài khoản đã bị vô hiệu hóa." });

    const currentRole = String(userDoc.role || "user");
    const currentCompanyCode = userDoc.companyCode ? String(userDoc.companyCode) : undefined;
    const path = req.originalUrl.split("?")[0];
    const accountOnlyPaths = new Set([
      "/api/v1/auth/me", "/api/v1/auth/profile", "/api/v1/auth/logout",
      "/api/v1/auth/change-password",
      "/api/v1/auth/profile/avatar",
    ]);
    const superadminCompanyCreation = currentRole === "superadmin" && path === "/api/v1/auth/register-company";
    if (!currentCompanyCode && !accountOnlyPaths.has(path) && !path.startsWith("/api/v1/chapters") && !superadminCompanyCreation) {
      return res.status(403).json({ status: "error", message: "Tài khoản chưa là thành viên chapter. Vui lòng nộp đơn và chờ duyệt." });
    }

    let branchId = userDoc?.branchId ? String(userDoc.branchId) : undefined;
    const requestedBranchId = typeof req.headers["x-branch-id"] === "string" ? req.headers["x-branch-id"] : "";
    if (currentRole === "admin" && requestedBranchId && currentCompanyCode) {
      const selectedBranch = await BranchModel.findOne({ _id: requestedBranchId, companyCode: currentCompanyCode.toUpperCase(), isActive: true }).select("_id").lean();
      if (!selectedBranch) return res.status(403).json({ status: "error", message: "Chi nhánh không thuộc công ty hoặc đã ngừng hoạt động." });
      branchId = String(selectedBranch._id);
    }
    req.user = {
      id: decoded.id,
      email: String(userDoc.email || decoded.email),
      role: currentRole,
      companyCode: currentCompanyCode,
      branchId,
      sessionId: decoded.sid,
      authLevel: decoded.authLevel,
      displayName: String(userDoc.displayName || "").trim() || undefined,
    };

    // console.log(`[requireAuth] Xác thực thành công: ${req.method} ${req.originalUrl} - User: ${decoded.email} (${decoded.role}), ID: ${decoded.id}`);
    return next();
  } catch (error) {
    if (!shouldSkipRoutineAuthLog(req.method, req.originalUrl)) {
      console.warn(`[requireAuth] JWT không hợp lệ hoặc hết hạn cho ${req.method} ${req.originalUrl}:`, (error as Error).message);
    }
    return res.status(401).json({
      status: "error",
      message: "Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
    });
  }
}

/**
 * Middleware yêu cầu người dùng phải có vai trò phù hợp (RBAC tĩnh)
 */
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền truy cập tài nguyên này.",
      });
    }
    next();
  };
}

/**
 * Tính tập hợp mã quyền hiệu lực (permissions custom của user + RolePermission
 * của company/role, fallback DEFAULT_ROLE_PERMISSIONS nếu công ty chưa cấu hình).
 * Nguồn dùng chung cho requirePermission (middleware) và mọi nơi khác cần biết
 * quyền thật của user (vd: lọc dữ liệu tổng quan theo permission trong
 * dashboard.service.ts), để tránh hai nơi tự tính khác nhau và lệch pha.
 */
export async function getEffectivePermissions(
  userId: string,
  role: string,
  companyCode?: string
): Promise<Set<string>> {

  const userDoc = userId
    ? await UserModel.findById(userId).select("permissions").lean()
    : null;
  const customPermissions = userDoc?.permissions || [];

  let rolePermissions: string[] = [];
  if (companyCode) {
    const rolePermissionDoc = await RolePermissionModel.findOne({
      companyCode,
      role,
    }).lean();

    if (rolePermissionDoc) {
      rolePermissions = rolePermissionDoc.permissions || [];
    } else {
      // Fallback về quyền hệ thống mặc định nếu chưa cấu hình trong DB
      rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
    }
  } else {
    rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  return expandEffectivePermissions(normalizeStoredPermissions([...customPermissions, ...rolePermissions]));
}

export function hasAnyPermission(allPermissions: ReadonlySet<string>, requiredPermissions: readonly string[]) {
  return allPermissions.has("*") || requiredPermissions.some((permission) => allPermissions.has(permission));
}

export const requireAnyPermission = (permissions: string[]) => requirePermission(permissions);

/**
 * Middleware yêu cầu mã quyền động (PBAC)
 * Kiểm tra kết hợp quyền tùy chỉnh của user và cấu hình RolePermission trong database của doanh nghiệp.
 * Truyền một mảng để yêu cầu "có ít nhất một trong các mã quyền" (OR), ví dụ khi hai nhóm quyền
 * khác nhau trên UI cùng cấp quyền truy cập một tài nguyên dùng chung (vd: hr:read và access:read
 * cùng cho phép xem danh sách nhân sự).
 */
export function requirePermission(requiredPermission: string | string[]) {
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const { id: userId, role, companyCode } = req.user;
      const allPermissions = await getEffectivePermissions(userId, role, companyCode);

      if (hasAnyPermission(allPermissions, requiredPermissions)) {
        return next();
      }

      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền thực hiện thao tác này.",
      });
    } catch (error) {
      console.error("[requirePermission] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Có lỗi xảy ra khi xác thực quyền hạn.",
        details: error.message,
      });
    }
  };
}

/**
 * Middleware bảo vệ tài nguyên theo doanh nghiệp (Tenant isolation ở cấp độ Object-level)
 */
export function requireCompanyAccess<T>(model: mongoose.Model<T>, idParamName: string = "id") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const resourceId = req.params[idParamName];
      if (!resourceId) {
        return next();
      }

      // Kiểm tra xem ID có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        return res.status(400).json({
          status: "error",
          message: "Định dạng ID tài nguyên không hợp lệ.",
        });
      }

      const resource = await model.findById(resourceId).lean<Record<string, unknown>>();
      if (!resource) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy tài nguyên yêu cầu.",
        });
      }

      // Kiểm tra trường companyCode của tài nguyên
      if (resource.companyCode !== req.user.companyCode) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền truy cập hoặc chỉnh sửa tài nguyên của doanh nghiệp khác.",
        });
      }

      // Đính kèm tài nguyên vào request để sử dụng ở Controller mà không cần query lại
      req.resource = resource;
      return next();
    } catch (error) {
      console.error("[requireCompanyAccess] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Có lỗi xảy ra khi kiểm tra quyền hạn doanh nghiệp.",
        details: error.message,
      });
    }
  };
}

/**
 * Đệ quy kiểm tra xem employeeId có thuộc cấp dưới trực thuộc hoặc gián tiếp của managerId hay không
 */
async function isSubordinate(managerId: string, employeeId: string): Promise<boolean> {
  let currentId = employeeId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === managerId) {
      return true;
    }
    if (visited.has(currentId)) {
      break; // Chống lặp vòng lặp
    }
    visited.add(currentId);

    const user = await UserModel.findById(currentId).select("parentId").lean();
    if (!user || !user.parentId) {
      break;
    }
    currentId = user.parentId.toString();
  }

  return false;
}

/**
 * Middleware kiểm tra phân cấp quản trị sơ đồ nhân sự (Hierarchy Access)
 * Cản manager hoặc user truy cập / thay đổi trái phép cấp trên hoặc người ngoài nhánh của mình.
 */
export function requireHierarchyAccess(idParamName: string = "id") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const targetUserId = req.params[idParamName];
      if (!targetUserId) {
        return next();
      }

      const { id: callerId, role } = req.user;

      // 1. Admin được toàn quyền quản trị
      if (role === "admin") {
        return next();
      }

      // 2. Thao tác trên chính mình -> Cho phép
      if (callerId === targetUserId) {
        return next();
      }

      // 3. Manager chỉ được xem/sửa nhân sự trực thuộc nhánh con của mình
      if (role === "manager") {
        const isSub = await isSubordinate(callerId, targetUserId);
        if (isSub) {
          return next();
        }
        return res.status(403).json({
          status: "error",
          message: "Bạn chỉ được thao tác trên hồ sơ nhân sự trực thuộc nhánh quản lý của mình.",
        });
      }

      // 4. User thường không có quyền thao tác trên người khác
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền thao tác trên hồ sơ nhân sự của người khác.",
      });
    } catch (error) {
      console.error("[requireHierarchyAccess] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Có lỗi xảy ra khi xác thực phân cấp nhân sự.",
        details: error.message,
      });
    }
  };
}
