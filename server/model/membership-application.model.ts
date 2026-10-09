import { Schema, model } from "mongoose";

export type MembershipApplicationStatus = "pending" | "approved" | "rejected" | "withdrawn" | "superseded";

const MembershipApplicationSchema = new Schema({
  applicantUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  chapterCode: { type: String, required: true, uppercase: true, index: true },
  status: { type: String, enum: ["pending", "approved", "rejected", "withdrawn", "superseded"], required: true, default: "pending" },
  profileSnapshot: {
    displayName: String, email: String, phone: String, companyName: String,
    industry: String, photoURL: String, referral: String, note: String,
  },
  decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
  decidedAt: Date,
  decisionReason: { type: String, default: "" },
}, { timestamps: true });

MembershipApplicationSchema.index(
  { applicantUserId: 1 },
  { name: "one_pending_application_per_user", unique: true, partialFilterExpression: { status: "pending" } },
);
MembershipApplicationSchema.index({ chapterCode: 1, status: 1, createdAt: -1 });

export const MembershipApplicationModel = model("MembershipApplication", MembershipApplicationSchema);
