import { Router } from "express";
import Joi from "joi";
import { requireAuth, requirePermission } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";

export const companyPaymentRouter = Router();
companyPaymentRouter.use(requireAuth);

const companyCode = (req: import("express").Request) => String(req.user?.companyCode || "").toUpperCase();

const vietqrSchema = Joi.object({
  bankId: Joi.string().trim().allow("").max(20).required(),
  accountNo: Joi.string().trim().allow("").max(50).required(),
  accountName: Joi.string().trim().allow("").max(100).required(),
});

// Reading the company's receiving account is needed by payment screens for
// ordinary authenticated users. Only changing the account requires the
// management permission.
companyPaymentRouter.put("/vietqr", requirePermission("settings:manage"));

companyPaymentRouter.get("/vietqr", async (req, res) => {
  try {
    const company = await CompanyModel.findOne({ code: companyCode(req) })
      .select("vietqrConfig")
      .lean();
    return res.json({ data: company?.vietqrConfig || { bankId: "", accountNo: "", accountName: "" } });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

companyPaymentRouter.put("/vietqr", requirePermission("settings:manage"), async (req, res) => {
  const { error, value } = vietqrSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    await CompanyModel.updateOne(
      { code: companyCode(req) },
      { $set: { vietqrConfig: value } }
    );
    return res.json({ data: value, message: "Đã cập nhật cấu hình VietQR thành công" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});
