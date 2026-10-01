import { Schema, model } from "mongoose";
const transaction = new Schema({
  companyCode: { type: String, required: true },
  transactionId: { type: Number, required: true },
  fingerprint: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["pending", "applied", "review", "ignored"], default: "pending" },
  reason: { type: String, default: "" },
  feeId: String,
}, { timestamps: true });
transaction.index({ companyCode: 1, transactionId: 1 }, { unique: true });
export const SePayTransactionModel = model("MemberFeeSePayTransaction", transaction);
