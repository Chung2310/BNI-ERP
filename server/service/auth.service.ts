import { findLoginAccount } from "../utils/login-account";
import { stripLegacyUserFields } from "../utils/legacy-user-fields";
import { verifySelfAccountDeletion } from "./self-account-deletion";
import { PushSubscriptionModel } from "../model/push-subscription.model";
import { MobilePushTokenModel } from "../model/mobile-push-token.model";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { UserModel } from "../model/user.model";
import { normalizeBirthDate } from "./birth-date";
import { CompanyModel } from "../model/company.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { DEFAULT_ROLE_LEVELS } from "../middleware/auth";
import { IUser } from "../interface/user.interface";
import { ICompany } from "../interface/company.interface";
import { pickSelfServiceProfileUpdate } from "../utils/self-service-profile-update";
import { filterModulesForBusinessType, resolveBusinessType } from "../config/business-types";
import { resolveCompanyModuleUpdate } from "./auth-company-modules";
import { clearModuleCache } from "../middleware/require-module";
import { createCompanyAdminUser } from "../utils/company-admin-user";
import { ConflictError } from "../errors/app-error";

import { getJwtAccessSecret, getJwtRefreshSecret } from "../config/env";
/**
 * Chặn đăng nhập/làm mới token cho tài khoản bị vô hiệu hoá hoặc thuộc doanh nghiệp không còn active.
 */
async function assertAccountUsable(user: IUser): Promise<void> {
  if (user.disabledAt) {
    throw new Error("Tài khoản của bạn đã bị vô hiệu hoá.");
  }
  if (user.companyCode && user.companyCode !== "SYSTEM") {
    const company = await CompanyModel.findOne({ code: user.companyCode }).select("lifecycleStatus").lean<{ lifecycleStatus?: string } | null>();
    if (!company || (company.lifecycleStatus && company.lifecycleStatus !== "active")) {
      throw new Error("Doanh nghiệp của bạn đang tạm ngưng hoạt động.");
    }
  }
}

export const authService = {
  async deleteOwnAccount(userId: string, password: string, confirmation: string): Promise<void> {
    const user = await UserModel.findById(userId);
    await verifySelfAccountDeletion(user, password, confirmation);
    const { disconnectUserSockets } = await import("../socket");
    await authService.deleteUser(userId, user!.companyCode!, user!.role);
    // The user record no longer exists, so existing access/refresh tokens cannot authenticate.
    try { disconnectUserSockets(userId); } catch (error) { console.error("[deleteOwnAccount] Socket cleanup failed", error); }
    const cleanup = await Promise.allSettled([
      PushSubscriptionModel.deleteMany({ uid: userId }),
      MobilePushTokenModel.deleteMany({ uid: userId }),
    ]);
    if (cleanup.some((result) => result.status === "rejected")) {
      console.error("[deleteOwnAccount] Some account notification records could not be removed", userId);
    }
  },
  /**
   * Tạo bộ đôi Access Token và Refresh Token
   */
  generateTokens(user: IUser, sessionId?: string) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      companyCode: user.companyCode,
      ...(sessionId ? { sid: sessionId } : {}),
    };

    const accessToken = jwt.sign(payload, getJwtAccessSecret(), { expiresIn: "15m" });
    const refreshToken = jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: "7d" });

    return { accessToken, refreshToken };
  },

  /**
   * Đăng ký tài khoản người dùng mới
   */
  async register(data: Partial<IUser>): Promise<IUser> {
    const emailLower = data.email.toLowerCase().trim();
    const existingUser = await UserModel.findOne({ email: emailLower });

    if (existingUser) {
      throw new Error("Email này đã được đăng ký sử dụng.");
    }

    let hashedPassword = undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    // Đăng ký công khai (không xác thực): chỉ nhận các trường hồ sơ cơ bản,
    // TUYỆT ĐỐI không cho client tự đặt role/companyCode/parentId —
    // các trường này chỉ được gán qua register-company/register-user (đã kiểm tra phân quyền).
    const newUser = new UserModel({
      email: emailLower,
      password: hashedPassword,
      displayName: data.displayName,
      photoURL: data.photoURL,
      phone: data.phone,
      role: "user",
    });

    return await newUser.save();
  },

  /**
   * Đăng nhập tài khoản
   */
  async login(identifier: string, password?: string) {
    const user = await findLoginAccount(identifier);

    if (!user || !user.password) {
      throw new Error("Tài khoản hoặc mật khẩu không chính xác.");
    }

    if (user.password && password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error("Tài khoản hoặc mật khẩu không chính xác.");
      }
    } else if (user.password && !password) {
      throw new Error("Yêu cầu mật khẩu để đăng nhập.");
    }

    await assertAccountUsable(user);

    // Each device gets its own token pair without replacing other devices' sessions.
    const tokens = this.generateTokens(user, crypto.randomUUID());
    return { kind: "authenticated" as const, user, ...tokens };
  },

  /**
   * Làm mới Access Token từ Refresh Token
   */
  async refresh(token: string) {
    try {
      const decoded = jwt.verify(token, getJwtRefreshSecret());
      if (typeof decoded === "string") throw new Error("Invalid token payload");
      const user = await UserModel.findById(decoded.id);

      if (!user) {
        throw new Error("Không tìm thấy thông tin tài khoản.");
      }

      await assertAccountUsable(user);

      const payload = {
        id: user._id,
        email: user.email,
        role: user.role,
        companyCode: user.companyCode,
        ...(decoded.sid ? { sid: decoded.sid, authLevel: decoded.authLevel } : {}),
      };

      const accessToken = jwt.sign(payload, getJwtAccessSecret(), { expiresIn: "15m" });
      return { accessToken };
    } catch  {
      throw new Error("Mã làm mới (Refresh Token) đã hết hạn hoặc không hợp lệ.");
    }
  },

  /**
   * Lấy thông tin tài khoản hiện tại
   */
  async getMe(id: string): Promise<IUser | null> {
    return await UserModel.findById(id).select("-password");
  },

  /**
   * Cập nhật thông tin tài khoản người dùng (tự phục vụ - self-service).
   * Chỉ cho phép cập nhật các trường hồ sơ cá nhân, KHÔNG bao giờ cho phép
   * client tự đổi role/companyCode/parentId qua endpoint này (chặn leo thang đặc quyền).
   */
  async updateProfile(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    const safeUpdateData = pickSelfServiceProfileUpdate(updateData);
    if (typeof safeUpdateData.email === "string") {
      const normalizedEmail = safeUpdateData.email.trim().toLowerCase();
      const existingUser = await UserModel.exists({ email: normalizedEmail, _id: { $ne: id } });
      if (existingUser) {
        throw new ConflictError("CONFLICT", "Địa chỉ email này đã được sử dụng cho một tài khoản khác.");
      }
      safeUpdateData.email = normalizedEmail;
    }
    if (safeUpdateData.birthDate !== undefined) {
      safeUpdateData.birthDate = normalizeBirthDate(safeUpdateData.birthDate);
    }
    safeUpdateData.updatedAt = new Date();
    return await UserModel.findByIdAndUpdate(id, { $set: safeUpdateData }, { returnDocument: 'after' }).select("-password");
  },

  /**
   * Thay đổi mật khẩu người dùng
   */
  async changePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserModel.findByIdAndUpdate(id, { $set: { password: hashedPassword } });
  },

  /**
   * Đăng ký doanh nghiệp mới và tài khoản admin tương ứng
   */
  async registerCompanyAndAdmin(data: { companyName: string; companyCode: string; ownerName: string; ownerEmail: string; ownerPassword: string; enabledModules?: string[]; businessType?: string; entityPreset?: string }) {
    const { companyName, companyCode, ownerName, ownerEmail, ownerPassword, enabledModules, businessType: businessTypeInput, entityPreset } = data;
    const normalizedCode = companyCode.toUpperCase().trim();
    const emailLower = ownerEmail.toLowerCase().trim();

    // 1. Kiểm tra mã doanh nghiệp
    const existingCompany = await CompanyModel.findOne({ code: normalizedCode });
    if (existingCompany) {
      throw new Error(`Mã doanh nghiệp "${normalizedCode}" đã tồn tại trên hệ thống.`);
    }

    // 2. Kiểm tra email admin
    const existingUser = await UserModel.findOne({ email: emailLower });
    if (existingUser) {
      throw new Error(`Địa chỉ email "${emailLower}" đã được sử dụng cho một tài khoản khác.`);
    }

    // 3. Tạo doanh nghiệp
    const businessType = resolveBusinessType(businessTypeInput, entityPreset);
    const newCompany = new CompanyModel({
      code: normalizedCode,
      name: companyName.trim(),
      ownerEmail: emailLower,
      businessType,
      enabledModules: filterModulesForBusinessType(enabledModules, businessType),
      createdAt: new Date(),
    });
    await newCompany.save();

    // 4. Tạo tài khoản admin của doanh nghiệp đó
    const adminUser = await createCompanyAdminUser({
      companyCode: normalizedCode,
      companyName,
      ownerName,
      ownerEmail: emailLower,
      ownerPassword,
    });
    return { company: newCompany, admin: adminUser };
  },

  /**
   * Lấy danh sách thành viên theo bộ lọc
   */
  async getUsers(filter: { companyCode?: string } = {}): Promise<IUser[]> {
    const users = await UserModel.find(filter).select("-password").sort({ createdAt: -1 });

    return users;
  },

  /**
   * Lấy danh sách tất cả doanh nghiệp
   */
  async getAllCompanies(): Promise<ICompany[]> {
    return await CompanyModel.find({}).sort({ createdAt: -1 });
  },

  /**
   * Cập nhật thông tin doanh nghiệp (Admin)
   */
  async updateCompany(companyId: string, updateData: { name?: string; code?: string; ownerEmail?: string; enabledModules?: string[] }): Promise<ICompany> {
    const company = await CompanyModel.findById(companyId);
    if (!company) {
      throw new Error("Không tìm thấy doanh nghiệp trên hệ thống.");
    }

    const oldCode = company.code;
    const oldName = company.name;

    const newCode = updateData.code ? updateData.code.toUpperCase().trim() : undefined;
    const newName = updateData.name ? updateData.name.trim() : undefined;
    const newOwnerEmail = updateData.ownerEmail ? updateData.ownerEmail.toLowerCase().trim() : undefined;
    const legacyEntityPreset = undefined;
    const businessType = resolveBusinessType(company.businessType, legacyEntityPreset);
    const newEnabledModules = resolveCompanyModuleUpdate({
      ...updateData,
      businessType: company.businessType,
      legacyEntityPreset,
    });

    // 1. Nếu có thay đổi mã doanh nghiệp, kiểm tra tính duy nhất
    if (newCode && newCode !== oldCode) {
      const existingCompany = await CompanyModel.findOne({ code: newCode });
      if (existingCompany) {
        throw new Error(`Mã doanh nghiệp "${newCode}" đã tồn tại trên hệ thống.`);
      }
    }

    // 2. Cập nhật cơ sở dữ liệu cascade nếu thay đổi mã hoặc tên doanh nghiệp
    if ((newCode && newCode !== oldCode) || (newName && newName !== oldName)) {
      
      const nameToUse = newName || oldName;

      // Cập nhật Users
      if (newCode && newCode !== oldCode) {
        await UserModel.updateMany({ companyCode: oldCode }, { $set: { companyCode: newCode, companyName: nameToUse } });
      } else if (newName && newName !== oldName) {
        await UserModel.updateMany({ companyCode: oldCode }, { $set: { companyName: newName } });
      }

      // Nếu thay đổi code, cập nhật tất cả các collection khác
      if (newCode && newCode !== oldCode) {
        await Promise.all([
          RolePermissionModel.updateMany({ companyCode: oldCode }, { $set: { companyCode: newCode } })
        ]);
      }
    }

    // 3. Thực hiện lưu thông tin doanh nghiệp
    if (newName !== undefined) company.name = newName;
    if (newCode !== undefined) company.code = newCode;
    if (newOwnerEmail !== undefined) company.ownerEmail = newOwnerEmail;
    if (newEnabledModules !== undefined) {
      company.enabledModules = newEnabledModules;
      company.businessType = businessType;
    }

    const savedCompany = await company.save();
    clearModuleCache(oldCode);
    clearModuleCache(savedCompany.code);
    return savedCompany;
  },

  async getCompanyDriveConfig(companyCode: string) {
    const normalizedCode = String(companyCode || "").trim().toUpperCase();
    const company = await CompanyModel.findOne({ code: normalizedCode });
    if (!company) {
      throw new Error("Khong tim thay doanh nghiep tren he thong.");
    }
    return {
      companyCode: company.code,
      companyName: company.name,
      driveFolderLink: company.driveFolderLink || "",
      driveConnected: !!company.driveOAuth?.refreshToken,
      driveConnectedEmail: company.driveOAuth?.connectedEmail || "",
    };
  },

  /** Lưu OAuth Google Drive sau khi công ty kết nối thành công. */
  async saveDriveOAuth(companyCode: string, data: { refreshToken: string; email: string }) {
    const normalizedCode = String(companyCode || "").trim().toUpperCase();
    const company = await CompanyModel.findOne({ code: normalizedCode });
    if (!company) {
      throw new Error("Khong tim thay doanh nghiep tren he thong.");
    }
    company.driveOAuth = {
      refreshToken: data.refreshToken,
      connectedEmail: data.email || "",
      connectedAt: new Date(),
    };
    // Reset thư mục để tạo mới trong tài khoản vừa kết nối (nếu đổi tài khoản)
    company.driveFolderId = "";
    company.driveFolderLink = "";
    await company.save();
    return this.getCompanyDriveConfig(normalizedCode);
  },

  /** Ngắt kết nối Google Drive của doanh nghiệp. */
  async disconnectDrive(companyCode: string) {
    const normalizedCode = String(companyCode || "").trim().toUpperCase();
    const company = await CompanyModel.findOne({ code: normalizedCode });
    if (!company) {
      throw new Error("Khong tim thay doanh nghiep tren he thong.");
    }
    company.driveOAuth = { refreshToken: "", connectedEmail: "", connectedAt: null };
    company.driveFolderId = "";
    company.driveFolderLink = "";
    await company.save();
    return this.getCompanyDriveConfig(normalizedCode);
  },

  async registerUserForCompany(data: Omit<Partial<IUser>, "birthDate"> & { birthDate?: string | Date }, callerCompanyCode?: string, callerRole?: string): Promise<IUser> {
    const {
      displayName,
      email,
      password,
      role,
      companyCode,
      companyName,
      parentId,

      phone,
      jobDescriptionLink,
      branchId,
      birthDate,
      monthlySalary,
    } = data;

    const finalCompanyCode = companyCode?.toUpperCase().trim() || "SYSTEM";
    const emailLower = email.toLowerCase().trim();
    const existingUser = await UserModel.findOne({ email: emailLower });
    if (existingUser) {
      throw new Error(`Địa chỉ email "${emailLower}" đã được sử dụng cho một tài khoản khác.`);
    }

    // 1. Xác thực vai trò có tồn tại/hợp lệ
    let targetRoleLevel = DEFAULT_ROLE_LEVELS[role];
    if (targetRoleLevel === undefined) {
      const rolePerm = await RolePermissionModel.findOne({
        companyCode: finalCompanyCode,
        role,
      });
      if (!rolePerm) {
        throw new Error(`Vai trò "${role}" không tồn tại hoặc chưa được thiết lập phân quyền cho doanh nghiệp.`);
      }
      targetRoleLevel = rolePerm.level;
    }

    // 2. Kiểm tra phân cấp cấp bậc (Hierarchy Level Check) của người gán
    if (callerRole) {
      if (callerRole !== "admin") {
        throw new Error("Chỉ Admin mới có quyền thay đổi vai trò của người dùng.");
      }

      const callerRolePerm = await RolePermissionModel.findOne({
        companyCode: callerCompanyCode,
        role: callerRole,
      });
      const callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[callerRole] || 4);

      if (targetRoleLevel <= callerLevel) {
        throw new Error("Bạn không thể gán vai trò có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.");
      }
    }

    const salaryValue = monthlySalary === undefined || monthlySalary === null || String(monthlySalary) === "" ? undefined : Number(monthlySalary);
    if (salaryValue !== undefined && (!Number.isFinite(salaryValue) || salaryValue < 0)) {
      throw new Error("Lương tháng không hợp lệ.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new UserModel({
      email: emailLower,
      password: hashedPassword,
      displayName: displayName.trim(),
      role,
      companyCode: finalCompanyCode,
      companyName: companyName?.trim() || "",
      industry: data.industry?.trim() || "",
      branchId: branchId || undefined,
      parentId: parentId || undefined,

      monthlySalary: salaryValue,
      phone: phone || "Chưa cập nhật",
      jobDescriptionLink: jobDescriptionLink || "",
      birthDate: normalizeBirthDate(birthDate) || undefined,
      gender: data.gender || undefined,
      address: data.address?.trim() || "",
      targetMarket: data.targetMarket?.trim() || "",
      galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages.slice(0, 5) : [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "offline",
      photoURL: data.photoURL?.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName.trim())}&background=random&color=fff`,
      coverImage: data.coverImage?.trim() || "",
    });

    return await newUser.save();
  },

  /**
   * Cập nhật thông tin chi tiết một nhân sự (Admin)
   */
  async updateUser(userId: string, updateData: Partial<IUser>, callerCompanyCode: string, callerRole: string, callerId?: string): Promise<IUser | null> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    stripLegacyUserFields(updateData);
    if (updateData.birthDate !== undefined) updateData.birthDate = normalizeBirthDate(updateData.birthDate);

    const isSelf = Boolean(callerId && user._id.toString() === callerId);

    if (updateData.password && typeof updateData.password === "string" && updateData.password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(updateData.password.trim(), 10);
    } else {
      delete updateData.password;
    }

    if (updateData.email && typeof updateData.email === "string") {
      const emailLower = updateData.email.toLowerCase().trim();
      if (emailLower !== user.email) {
        const existingUser = await UserModel.findOne({ email: emailLower, _id: { $ne: userId } });
        if (existingUser) {
          throw new Error(`Địa chỉ email "${emailLower}" đã được sử dụng cho một tài khoản khác.`);
        }
        updateData.email = emailLower;
      }
    }

    if (isSelf) {
      // Self-service may update profile fields, never organizational authority.
      delete updateData.role;
      delete updateData.parentId;
      delete updateData.companyCode;
      delete updateData.branchId;
      delete updateData.monthlySalary;
    } else {
      delete updateData.companyCode;
      if (user.companyCode !== callerCompanyCode) {
        throw new Error("Bạn không có quyền chỉnh sửa nhân sự của doanh nghiệp khác.");
      }

      const callerRolePerm = await RolePermissionModel.findOne({ companyCode: callerCompanyCode, role: callerRole });
      const callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[callerRole] || 4);

      let currentTargetLevel = DEFAULT_ROLE_LEVELS[user.role];
      if (currentTargetLevel === undefined) {
        const currentTargetPerm = await RolePermissionModel.findOne({ companyCode: user.companyCode, role: user.role });
        currentTargetLevel = currentTargetPerm ? currentTargetPerm.level : 4;
      }

      if (currentTargetLevel <= callerLevel) {
        throw new Error("Bạn không có quyền chỉnh sửa tài khoản có cấp bậc tương đương hoặc cao hơn.");
      }
    }

    updateData.updatedAt = new Date();


    if (updateData.role) {
      if (callerRole !== "admin") {
        throw new Error("Chỉ Admin mới có quyền thay đổi vai trò của người dùng.");
      }

      let targetLevel = DEFAULT_ROLE_LEVELS[updateData.role];
      if (targetLevel === undefined) {
        const targetRolePerm = await RolePermissionModel.findOne({ companyCode: user.companyCode, role: updateData.role });
        if (!targetRolePerm) {
          throw new Error(`Vai trò "${updateData.role}" không tồn tại hoặc chưa được thiết lập cho doanh nghiệp này.`);
        }
        targetLevel = targetRolePerm.level;
      }

      const callerRolePerm = await RolePermissionModel.findOne({ companyCode: callerCompanyCode, role: callerRole });
      const callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[callerRole] || 4);

      if (targetLevel <= callerLevel) {
        throw new Error("Bạn không thể gán vai trò có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.");
      }
    }

    return await UserModel.findByIdAndUpdate(userId, { $set: updateData }, { returnDocument: 'after' }).select("-password");
  },

  /**
   * Cập nhật hàng loạt thông tin nhân sự (ví dụ: kéo thả thay đổi sơ đồ)
   */
  async bulkUpdateUsers(updates: Array<Partial<IUser> & { id: string }>, callerCompanyCode: string, callerRole: string): Promise<void> {
    for (const update of updates) {
      const { id, ...data } = update;
      stripLegacyUserFields(data);
      const user = await UserModel.findById(id);
      if (!user) continue;

      delete data.companyCode;
      delete data.companyName;
      if (user.companyCode !== callerCompanyCode) {
        throw new Error("Bạn không có quyền chỉnh sửa nhân sự của doanh nghiệp khác.");
      }

      const callerRolePerm = await RolePermissionModel.findOne({ companyCode: callerCompanyCode, role: callerRole });
      const callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[callerRole] || 4);

      let currentTargetLevel = DEFAULT_ROLE_LEVELS[user.role];
      if (currentTargetLevel === undefined) {
        const currentTargetPerm = await RolePermissionModel.findOne({ companyCode: user.companyCode, role: user.role });
        currentTargetLevel = currentTargetPerm ? currentTargetPerm.level : 4;
      }

      if (currentTargetLevel <= callerLevel) {
        throw new Error("Bạn không có quyền chỉnh sửa tài khoản có cấp bậc tương đương hoặc cao hơn.");
      }

      if (data.role) {
        if (callerRole !== "admin") {
          throw new Error("Chỉ Admin mới có quyền thay đổi vai trò của người dùng.");
        }

        const callerRolePerm = await RolePermissionModel.findOne({ companyCode: callerCompanyCode, role: callerRole });
        const callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[callerRole] || 4);

        let targetLevel = DEFAULT_ROLE_LEVELS[data.role];
        if (targetLevel === undefined) {
          const targetRolePerm = await RolePermissionModel.findOne({ companyCode: user.companyCode, role: data.role });
          if (!targetRolePerm) {
            throw new Error(`Vai trò "${data.role}" không tồn tại hoặc chưa được thiết lập cho doanh nghiệp này.`);
          }
          targetLevel = targetRolePerm.level;
        }

        if (targetLevel <= callerLevel) {
          throw new Error("Bạn không thể gán vai trò có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.");
        }
      }

      await UserModel.findByIdAndUpdate(id, { $set: data });
    }
  },

  /**
   * Xóa nhân sự và điều chuyển cấp dưới trực thuộc
   */
  async deleteUser(userId: string, callerCompanyCode: string, _callerRole: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    if (user.companyCode !== callerCompanyCode) {
      throw new Error("Bạn không có quyền xóa nhân sự của doanh nghiệp khác.");
    }
    if (user.role === "admin") {
      throw new Error("Không thể xóa tài khoản Quản trị viên.");
    }

    const parentId = user.parentId || null;
    // Cập nhật tất cả cấp dưới trực thuộc của nhân sự bị xóa
    const children = await UserModel.find({ parentId: userId });
    for (const child of children) {
      child.parentId = parentId || undefined;
      await child.save();
    }

    await UserModel.findByIdAndDelete(userId);
  }
};
