import { Schema, model } from "mongoose";

const ChapterLeaveRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  chapterCode: { type: String, required: true, uppercase: true, index: true },
  status: { type: String, enum: ["pending", "approved", "rejected", "withdrawn"], required: true, default: "pending" },
  reason: { type: String, default: "" },
  decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
  decidedAt: Date,
  decisionReason: { type: String, default: "" },
}, { timestamps: true });

ChapterLeaveRequestSchema.index(
  { userId: 1, chapterCode: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
ChapterLeaveRequestSchema.index({ chapterCode: 1, status: 1, createdAt: -1 });

export const ChapterLeaveRequestModel = model("ChapterLeaveRequest", ChapterLeaveRequestSchema);
