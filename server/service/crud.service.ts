import { UserModel } from "../model/user.model";
import { SupportedModelName, ICRUDQueryOptions } from "../interface/crud.interface";

/** Loại bỏ trường nhạy cảm khỏi kết quả trả về của model users */
function sanitizeUserResult(modelName: string, item: object & { toObject?: () => Record<string, unknown>; password?: string; refreshToken?: string }) {
  if (modelName !== "users" || !item || typeof item !== "object") {
    return item;
  }
  const plainItem = typeof item.toObject === "function" ? item.toObject() : { ...item };
  delete plainItem.password;
  delete plainItem.refreshToken;
  return plainItem;
}

function sanitizeCrudResult(modelName: string, item: object & { toObject?: () => Record<string, unknown>; password?: string; refreshToken?: string }) {
  return sanitizeUserResult(modelName, item);
}

const MODEL_MAPPING: Record<SupportedModelName, typeof UserModel> = {
  "users": UserModel,
};

export const crudService = {
  /**
   * Lấy danh sách tài nguyên kèm phân trang, lọc và cô lập companyCode
   */
  async getList(
    modelName: SupportedModelName,
    companyCode: string,
    options: ICRUDQueryOptions,
    _userRole: string
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: Record<string, unknown> = {};

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
    _userRole: string,
    _branchId?: string,
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: Record<string, unknown> = { _id: id };
    if (companyCode) {
      query.companyCode = companyCode;
    }

    const item = await model.findOne(query).lean();
    if (!item) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền truy cập.");
    }
    return sanitizeCrudResult(modelName, item);
  },
};
