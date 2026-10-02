import { Schema, model } from "mongoose";

const payment = new Schema({
  id: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  paidOn: { type: String, required: true },
  method: { type: String, enum: ["cash", "transfer"], required: true },
  reference: { type: String, default: "" },
  note: { type: String, default: "" },
  recordedBy: { type: String, required: true },
  recordedAt: { type: Date, required: true },
  voidedAt: Date, voidedBy: String, voidReason: String,
}, { _id: false });
const memberFee = new Schema({
  companyCode: { type: String, required: true },
  memberId: { type: String, required: true },
  memberName: { type: String, required: true },
  memberEmail: { type: String, default: "" },
  year: { type: Number, required: true },
  title: { type: String, required: true },
  campaignId: String,
  titleKey: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  dueDate: { type: String, required: true },
  note: { type: String, default: "" },
  createdBy: { type: String, required: true },
  paymentCode: String,
  bankAccount: { bank: String, accountNumber: String, accountName: String },
  notifiedAt: Date,
  emailNotifiedAt: Date,
  emailNotifiedDay: String,
  emailClaimToken: { type: String, select: false },
  emailClaimUntil: { type: Date, select: false },
  payments: { type: [payment], default: [] },
}, { timestamps: true, optimisticConcurrency: true });
memberFee.index({ companyCode: 1, campaignId: 1, memberId: 1 }, { unique: true, partialFilterExpression: { campaignId: { $type: "string" } } });
memberFee.index({ companyCode: 1, year: 1, memberId: 1, titleKey: 1 }, { unique: true });
memberFee.index({ companyCode: 1, paymentCode: 1 }, { unique: true, partialFilterExpression: { paymentCode: { $type: "string" } } });
export const MemberFeeModel = model("MemberFee", memberFee);
