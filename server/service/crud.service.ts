import { UserModel } from "../model/user.model";
import { HRLeaveTemplateModel } from "../model/hr-leave-template.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { SupportedModelName, ICRUDQueryOptions } from "../interface/crud.interface";
import mongoose from "mongoose";
import { notificationService } from "./notification.service";

/**
 * Model chỉ được đọc qua router CRUD chung; mọi thao tác ghi (tạo/sửa/xóa)
 * phải đi qua router chuyên biệt có kiểm tra phân quyền & phân cấp đầy đủ.
 * Chặn ở đây để tránh leo thang đặc quyền (vd tự set role/permissions qua /crud/users).
 */
const WRITE_PROTECTED_MODELS = new Set<string>(["users"]);

/** Loại bỏ trường nhạy cảm khỏi kết quả trả về của model users */
function sanitizeUserResult(modelName: string, item: any) {
  if (modelName !== "users" || !item || typeof item !== "object") {
    return item;
  }
  const plainItem = typeof item.toObject === "function" ? item.toObject() : { ...item };
  delete plainItem.password;
  delete plainItem.refreshToken;
  return plainItem;
}

function assertWritable(modelName: string) {
  if (WRITE_PROTECTED_MODELS.has(modelName)) {
    const err: any = new Error(
      "Không thể thao tác trực tiếp trên tài nguyên này qua API chung. Vui lòng dùng chức năng Quản lý người dùng."
    );
    err.statusCode = 403;
    throw err;
  }
}

function sanitizeCrudResult(modelName: string, item: any) {
  return sanitizeUserResult(modelName, item);
}

const MODEL_MAPPING: Record<SupportedModelName, mongoose.Model<any>> = {
  "users": UserModel,
  "hr-leave-templates": HRLeaveTemplateModel,
  "hr-leave-applications": HRLeaveApplicationModel,
  "timekeeping-logs": TimekeepingLogModel,
};

/**
 * Các model được cô lập theo chi nhánh: bản ghi luôn được đóng dấu branchId khi tạo
 * và mọi truy cập theo _id đều bị giới hạn trong chi nhánh của người dùng.
 */
const BRANCH_SCOPED_MODELS = new Set<string>([
  "projects",
  "hr-calendar-events",
  "hr-leave-templates",
  "hr-leave-applications",
]);

export const crudService = {
  /**
   * Lấy danh sách tài nguyên kèm phân trang, lọc và cô lập companyCode
   */
  async getList(
    modelName: SupportedModelName,
    companyCode: string,
    options: ICRUDQueryOptions,
    userRole: string
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: any = {};

    // Áp dụng các bộ lọc động truyền từ client (loại bỏ key nguy hiểm trước khi merge)
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (key === "companyCode" || key === "_id" || key.startsWith("$")) continue;
        query[key] = value;
      }
    }

    // Cô lập dữ liệu theo companyCode (áp dụng sau cùng, không cho client ghi đè)
    if (companyCode) {
      query.companyCode = companyCode;
    }

    if (options.search) {
      const searchRegex = new RegExp(options.search, "i");
      query.$or = [
        { name: searchRegex },
        { title: searchRegex },
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 1000;
    const skip = (page - 1) * limit;
    const sort = options.sort || "-_id";

    const items = await model.find(query).sort(sort).skip(skip).limit(limit).lean();
    const total = await model.countDocuments(query);

    return {
      items: items.map((item) => sanitizeCrudResult(modelName, item)),
      total,
      page,
      limit,
    };
  },

  /**
   * Lấy chi tiết tài nguyên theo ID
   */
  async getById(
    modelName: SupportedModelName,
    id: string,
    companyCode: string,
    userRole: string,
    branchId?: string,
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: any = { _id: id };
    if (companyCode) {
      query.companyCode = companyCode;
    }
    if (BRANCH_SCOPED_MODELS.has(modelName) && branchId) query.branchId = branchId;

    const item = await model.findOne(query).lean();
    if (!item) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền truy cập.");
    }
    return sanitizeCrudResult(modelName, item);
  },

  /**
   * Tạo mới tài nguyên
   */
  async create(
    modelName: SupportedModelName,
    data: any,
    companyCode: string,
    branchId?: string,
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }
    assertWritable(modelName);

    const payload = {
      ...data,
      companyCode,
    };

    if (BRANCH_SCOPED_MODELS.has(modelName) && (branchId || data.branchId)) {
      payload.branchId = branchId || data.branchId;
    }

    const newItem = new model(payload);
    await newItem.save();


    return sanitizeCrudResult(modelName, newItem);
  },

  /**
   * Cập nhật tài nguyên theo ID
   */
  async update(
    modelName: SupportedModelName,
    id: string,
    data: any,
    companyCode: string,
    userRole: string,
    branchId?: string,
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    assertWritable(modelName);

    const query: any = { _id: id };
    if (companyCode) {
      query.companyCode = companyCode;
    }
    if (BRANCH_SCOPED_MODELS.has(modelName) && branchId) query.branchId = branchId;

    // Loại bỏ các trường nhạy cảm không cho phép đè trực tiếp
    const { companyCode: _cCode, branchId: _branchId, ownerId: _ownerId, _id: _itemId, id: _plainId, ...rawUpdatePayload } = data;
    const updatePayload = { ...rawUpdatePayload };

    if ((modelName === "timekeeping-logs" || BRANCH_SCOPED_MODELS.has(modelName)) && data.branchId) {
      updatePayload.branchId = data.branchId;
    }


    const updatedItem = await model.findOneAndUpdate(query, updatePayload, { returnDocument: 'after' });
    if (!updatedItem) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền chỉnh sửa.");
    }

    return sanitizeCrudResult(modelName, updatedItem);
  },

  /**
   * Xóa tài nguyên theo ID
   */
  async delete(
    modelName: SupportedModelName,
    id: string,
    companyCode: string,
    userRole: string,
    branchId?: string,
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }
    assertWritable(modelName);

    const query: any = { _id: id };
    if (companyCode) {
      query.companyCode = companyCode;
    }
    if (BRANCH_SCOPED_MODELS.has(modelName) && branchId) query.branchId = branchId;

    const deletedItem = await model.findOneAndDelete(query);
    if (!deletedItem) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền xóa.");
    }


    return deletedItem;
  },
};
