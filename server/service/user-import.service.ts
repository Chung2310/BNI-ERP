import Joi from "joi";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { BranchModel } from "../model/branch.model";
import { authService } from "./auth.service";
import { normalizeBirthDate } from "./birth-date";

export class UserImportError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const rowSchema = Joi.object({
  rowNumber: Joi.number().integer().min(2).max(201).required(),
  displayName: Joi.string().trim().min(1).max(150).required(),
  email: Joi.string().trim().lowercase().max(254).pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/).required(),
  phone: Joi.string().trim().pattern(/^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/).allow("").default(""),
  companyName: Joi.string().trim().max(200).allow("").default(""),
  industry: Joi.string().trim().max(200).allow("").default(""),
  photoURL: Joi.string().trim().max(2048).uri({ scheme: ["https", "http"] }).allow("").default(""),
  coverImage: Joi.string().trim().max(2048).uri({ scheme: ["https", "http"] }).allow("").default(""),
  birthDate: Joi.string().allow("").default("").custom((value, helpers) => {
    try { normalizeBirthDate(value); return value; } catch { return helpers.error("any.invalid"); }
  }),
});
export type ImportResultRow = { rowNumber: number; email: string; status: "valid" | "created" | "skipped" | "error"; message: string };
export async function importUsers(input: unknown, actor: { companyCode: string; role: string; branchId?: string }) {
  if (actor.role !== "admin") throw new UserImportError(403, "Chỉ Admin được nhập tài khoản.");
  const { error, value } = Joi.object({
    dryRun: Joi.boolean().strict().required(),
    rows: Joi.array().min(1).max(200).items(Joi.object().unknown(true)).required(),
  }).validate(input);
  if (error) throw new UserImportError(400, "Mỗi lần nhập cần từ 1 đến 200 dòng.");
  if (!value.dryRun && value.rows.length > 20) throw new UserImportError(400, "Mỗi đợt tạo tối đa 20 tài khoản. Hãy chia nhỏ dữ liệu.");
  const companyCode = String(actor.companyCode || "").trim().toUpperCase();
  const company = await CompanyModel.findOne({ code: companyCode }).select("name").lean();
  if (!company) throw new UserImportError(400, "Không tìm thấy đơn vị nhận tài khoản.");
  if (actor.branchId && !await BranchModel.exists({ _id: actor.branchId, companyCode, isActive: true })) {
    throw new UserImportError(400, "Chi nhánh không hợp lệ.");
  }
  const results: ImportResultRow[] = [];
  const seenEmails = new Set<string>();
  const seenRows = new Set<number>();
  const fieldNames: Record<string, string> = { displayName: "Họ tên", email: "Email", phone: "Điện thoại", birthDate: "Ngày sinh",
    photoURL: "Ảnh đại diện", coverImage: "Ảnh bìa / Banner", companyName: "Doanh nghiệp", industry: "Lĩnh vực", rowNumber: "Số dòng" };
  for (const raw of value.rows) {
    const checked = rowSchema.validate(raw);
    const result: ImportResultRow = { rowNumber: Number(raw.rowNumber) || 0, email: String(raw.email || "").slice(0,254), status: "error", message: "" };
    if (checked.error) {
      result.message = (fieldNames[String(checked.error.details[0].path[0])] || "Cột dữ liệu") + " không hợp lệ.";
      results.push(result); continue;
    }
    const row = checked.value;
    result.email = row.email;
    if (seenRows.has(row.rowNumber)) { result.message = "Số dòng bị trùng."; results.push(result); continue; }
    seenRows.add(row.rowNumber);
    if (seenEmails.has(row.email)) { result.message = "Email trùng trong file."; results.push(result); continue; }
    seenEmails.add(row.email);
    if (await UserModel.exists({ email: row.email })) {
      result.status = "skipped"; result.message = "Email đã có tài khoản."; results.push(result); continue;
    }
    if (value.dryRun) {
      result.status = "valid"; result.message = "Sẵn sàng tạo Member.";
    } else {
      try {
        const { rowNumber: _rowNumber, ...profile } = row;
        await authService.registerUserForCompany({ ...profile, companyName: row.companyName || company.name,
          role: "user", password: "123456", companyCode, branchId: actor.branchId }, companyCode, actor.role);
        result.status = "created"; result.message = "Đã tạo tài khoản Member.";
      } catch {
        // Unique email index also prevents duplicate accounts on retry/concurrent imports.
        if (await UserModel.exists({ email: row.email })) {
          result.status = "skipped"; result.message = "Email đã có tài khoản.";
        } else { result.message = "Không thể tạo tài khoản. Kiểm tra quyền của Admin hoặc thử lại."; }
      }
    }
    results.push(result);
  }
  return { rows: results, created: results.filter(r => r.status === "created").length,
    valid: results.filter(r => r.status === "valid").length, skipped: results.filter(r => r.status === "skipped").length,
    errors: results.filter(r => r.status === "error").length };
}
