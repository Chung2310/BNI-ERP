import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true, index: true },
  targetType: { type: String, enum: ["profile", "resource"], required: true },
  targetId: { type: String, required: true },
  reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  reportedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, enum: ["harassment", "sexual", "violence", "spam", "other", "media_review"], required: true },
  details: { type: String, default: "", maxlength: 2000 },
  revision: { type: String },
  snapshot: { type: Schema.Types.Mixed, select: false },
  state: { type: String, enum: ["pending", "resolved"], default: "pending" },
  action: { type: String, enum: ["approve", "remove", "suspend", "dismiss"] },
  moderatorId: { type: Schema.Types.ObjectId, ref: "User" },
  resolvedAt: Date,
  expiresAt: Date,
}, { timestamps: true });
schema.index({ companyCode: 1, state: 1, createdAt: 1 });
schema.index({ targetType: 1, targetId: 1, state: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const ContentSafetyReportModel = model("ContentSafetyReport", schema);
