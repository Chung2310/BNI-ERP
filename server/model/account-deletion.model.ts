import { Schema, model } from "mongoose";

// No password or plaintext receipt is stored. Pending jobs survive server restarts.
const schema = new Schema({
  userId: { type: String, unique: true, sparse: true },
  receiptHash: { type: String, required: true, unique: true },
  state: { type: String, enum: ["pending", "processing", "completed"], default: "pending", index: true },
  successorId: String,
  administrationTransferred: { type: Boolean, default: false },
  requestedAt: { type: Date, default: Date.now },
  completedAt: Date,
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  leaseUntil: Date,
  claimToken: String,
  attempts: { type: Number, default: 0 },
  inventoryReady: { type: Boolean, default: false },
  assets: { type: [new Schema({
    provider: { type: String, enum: ["cloudinary", "google-drive"], required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, default: "image" },
    access: { type: String, default: "upload" },
    companyCode: String,
  }, { _id: false })], default: [] },
  expiresAt: Date,
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AccountDeletionModel = model("AccountDeletion", schema);
