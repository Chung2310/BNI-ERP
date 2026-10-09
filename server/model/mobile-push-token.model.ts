import { Document, Schema, model } from "mongoose";

export interface IMobilePushToken extends Document {
  uid: string;
  companyCode: string;
  token: string;
  platform: "android" | "ios";
  deviceName?: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MobilePushTokenSchema = new Schema<IMobilePushToken>(
  {
    uid: { type: String, required: true, index: true },
    companyCode: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
    deviceName: { type: String, trim: true, maxlength: 160 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const MobilePushTokenModel = model<IMobilePushToken>("MobilePushToken", MobilePushTokenSchema);
