import { Schema, model } from "mongoose";

const blockSchema = new Schema({
  companyCode: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  blockedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
blockSchema.index({ companyCode: 1, userId: 1, blockedUserId: 1 }, { unique: true });
blockSchema.index({ companyCode: 1, blockedUserId: 1 });
export const ChatUserBlockModel = model("ChatUserBlock", blockSchema);

const reportSchema = new Schema({
  companyCode: { type: String, required: true, index: true },
  roomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true },
  messageId: { type: Schema.Types.ObjectId, ref: "ChatMessage", required: true },
  reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  reportedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, enum: ["harassment", "sexual", "violence", "spam", "other", "media_review"], required: true },
  details: { type: String, default: "", maxlength: 2000 },
  state: { type: String, enum: ["pending", "resolved"], default: "pending" },
  action: { type: String, enum: ["approve", "remove", "suspend", "dismiss"] },
  moderatorId: { type: Schema.Types.ObjectId, ref: "User" },
  resolvedAt: Date,
  expiresAt: Date,
}, { timestamps: true });
reportSchema.index({ companyCode: 1, state: 1, createdAt: 1 });
reportSchema.index({ reporterId: 1, messageId: 1, reason: 1 }, { unique: true });
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const ChatReportModel = model("ChatReport", reportSchema);
