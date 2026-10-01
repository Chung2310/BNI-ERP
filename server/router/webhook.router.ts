import { Router } from "express";

import { authenticateSePay, processSePay } from "../modules/member-fees/sepay.service";
import { MemberFeeError } from "../modules/member-fees/member-fee.service";

export const webhookRouter = Router();

webhookRouter.post("/", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

webhookRouter.post("/sepay/:companyCode", async (req, res) => {
  try {
    const companyCode = String(req.params.companyCode).toUpperCase();
    await authenticateSePay(companyCode, req.headers.authorization || "");
    res.json(await processSePay(companyCode, req.body));
  } catch (error) {
    const known = error instanceof MemberFeeError;
    res.status(known ? error.status : 500).json({ success: false, message: known ? error.message : "Không thể xử lý giao dịch. Vui lòng thử lại." });
  }
});
