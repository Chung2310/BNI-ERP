import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { PermissionModel } from "../model/permission.model";
import { PERMISSION_CATALOG, PERMISSION_CODES } from "./permission-catalog";
import { resetPermissionsForRegistryVersion } from "../model/permission-registry-reset";
import { DEFAULT_MODULE_KEYS } from "./module-keys";

async function seedPermissions() {
  try {
    const catalogPermissions = PERMISSION_CATALOG.map((entry) => ({
      code: entry.code,
      name: entry.label,
      module: entry.feature,
      group: entry.group,
      action: entry.action,
      description: entry.description,
    }));
    for (const perm of catalogPermissions) {
      const result = await PermissionModel.updateOne({ code: perm.code }, { $set: perm }, { upsert: true });
      if (result.upsertedCount) console.log(`[Backend Database] Khởi tạo mã quyền mặc định: ${perm.code}`);
    }

    await PermissionModel.deleteMany({ code: { $nin: PERMISSION_CODES } });
  } catch (error) {
    console.error("[Backend Database] Lỗi khi tự động khởi tạo mã quyền:", error);
  }
}

async function seedAdminUser() {
  const seedEmail = (process.env.SEED_ADMIN_EMAIL || "admin@bni.vn").toLowerCase().trim();
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const seedName = (process.env.SEED_ADMIN_NAME || "Quản trị viên Hệ thống").trim();
  const seedPhone = process.env.SEED_ADMIN_PHONE || "0901234567";
  const seedCompanyCode = (process.env.SEED_ADMIN_COMPANY_CODE || "BNI").toUpperCase().trim();
  const seedCompanyName = (process.env.SEED_ADMIN_COMPANY_NAME || "BNI Chapter").trim();

  try {
    // 1. Kiểm tra / khởi tạo Doanh nghiệp mặc định
    let company = await CompanyModel.findOne({ code: seedCompanyCode });
    if (!company) {
      company = new CompanyModel({
        code: seedCompanyCode,
        name: seedCompanyName,
        ownerEmail: seedEmail,
        businessType: "general",
        enabledModules: DEFAULT_MODULE_KEYS,
        lifecycleStatus: "active",
        createdAt: new Date(),
      });
      await company.save();
      console.log(`[Backend Database] Khởi tạo doanh nghiệp mặc định: ${seedCompanyCode} - ${seedCompanyName}`);
    } else if (company.lifecycleStatus !== "active") {
      company.lifecycleStatus = "active";
      await company.save();
    }

    // 2. Kiểm tra / đồng bộ vai trò admin trong RolePermission
    await RolePermissionModel.updateOne(
      { companyCode: seedCompanyCode, role: "admin" },
      {
        $set: {
          displayName: "Quản trị viên",
          level: 1,
          permissions: PERMISSION_CODES,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    // 3. Kiểm tra tài khoản admin theo email
    let adminUser = await UserModel.findOne({ email: seedEmail });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash(seedPassword, 10);
      adminUser = new UserModel({
        email: seedEmail,
        password: hashedPassword,
        displayName: seedName,
        role: "admin",
        companyCode: seedCompanyCode,
        companyName: seedCompanyName,
        jobTitle: "CEO",
        department: "Ban Giám Đốc",
        division: "Ban Giám Đốc",
        level: 1,
        phone: seedPhone,
        status: "offline",
        isActive: true,
        permissions: PERMISSION_CODES,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(seedName)}&background=4f46e5&color=fff`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await adminUser.save();
      console.log(`[Backend Database] Khởi tạo tài khoản Admin mặc định thành công: ${seedEmail}`);
    } else {
      let updated = false;
      if (adminUser.role !== "admin") {
        adminUser.role = "admin";
        updated = true;
      }
      if (!adminUser.isActive) {
        adminUser.isActive = true;
        updated = true;
      }
      if (!adminUser.companyCode) {
        adminUser.companyCode = seedCompanyCode;
        adminUser.companyName = seedCompanyName;
        updated = true;
      }
      const currentPerms = new Set(adminUser.permissions || []);
      const missingPerms = PERMISSION_CODES.filter((code) => !currentPerms.has(code));
      if (missingPerms.length > 0) {
        adminUser.permissions = Array.from(new Set([...(adminUser.permissions || []), ...PERMISSION_CODES]));
        updated = true;
      }
      if (updated) {
        await adminUser.save();
        console.log(`[Backend Database] Đã đồng bộ quyền và trạng thái cho Admin: ${seedEmail}`);
      }
    }
  } catch (error) {
    console.error("[Backend Database] Lỗi khi tự động khởi tạo tài khoản Admin:", error);
  }
}

/**
 * Khởi tạo kết nối cơ sở dữ liệu MongoDB
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  let connectionUri = uri;
  if (user && pass) {
    const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
    const uriWithoutProtocol = uri.replace(protocol, "");
    
    if (!uriWithoutProtocol.includes("@")) {
      connectionUri = `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${uriWithoutProtocol}`;
    }
    
    if (authSource && !connectionUri.includes("authSource=")) {
      const separator = connectionUri.includes("?") ? "&" : "?";
      connectionUri = `${connectionUri}${separator}authSource=${authSource}`;
    }
  }

  // Local MongoDB standalone deployments do not support retryable writes.
  // Always normalize the option, including when the supplied URI already
  // contains retryWrites=true.
  if (/[?&]retryWrites=[^&]*/i.test(connectionUri)) {
    connectionUri = connectionUri.replace(/([?&])retryWrites=[^&]*/i, "$1retryWrites=false");
  } else {
    connectionUri += (connectionUri.includes("?") ? "&" : "?") + "retryWrites=false";
  }

  // Log URI ẩn mật khẩu để dễ debug cấu hình trên VPS
  const redactedUri = connectionUri.replace(/:([^:@]+)@/, ":******@");
  console.log(`[Backend Database - v2] Đang kết nối tới MongoDB qua URI: ${redactedUri}`);

  try {
    await mongoose.connect(connectionUri, { retryWrites: false });
    console.log(`[Backend Database] Kết nối MongoDB thành công. db=${mongoose.connection.name || "unknown"} host=${mongoose.connection.host || "unknown"} instance=${process.env.INSTANCE_ID || process.env.HOSTNAME || "local"} pid=${process.pid}`);
    await seedPermissions();
    const permissionReset = await resetPermissionsForRegistryVersion();
    if (permissionReset.applied) {
      console.warn(`[Backend Database] Permission registry clean-break reset applied: ${permissionReset.rolesReset} role(s), ${permissionReset.usersReset} user(s). Administrators must configure permissions again.`);
    }
    await seedAdminUser();
  } catch (error) {
    console.error("[Backend Database] Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
}

/**
 * Helper để chạy logic trong Transaction nếu DB hỗ trợ (Replica Set),
 * ngược lại chạy bình thường (dành cho môi trường Local DB Standalone).
 */
export async function runInTransaction<T>(callback: (session?: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const topologyInfo = await mongoose.connection.db?.admin().command({ hello: 1 });
  const isReplicaSet = Boolean(topologyInfo?.setName) || topologyInfo?.msg === "isdbgrid";
  
  if (!isReplicaSet) {
    // Standalone fallback: chạy không có transaction
    return callback(undefined);
  }

  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async (s) => {
      result = await callback(s);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}
