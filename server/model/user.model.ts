import { Schema, model } from "mongoose";
import { IUser } from "../interface/user.interface";
import { stripLegacyUserFields } from "../utils/legacy-user-fields";

const WorkHoursConfigSchema = new Schema(
  {
    useCustom: { type: Boolean, default: false },
    checkInLimit: { type: String, default: "08:30" },
    checkOutLimit: { type: String, default: "17:30" },
    lunchBreakStart: { type: String, default: "12:00" },
    lunchBreakEnd: { type: String, default: "13:00" },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    annualLeaveDays: { type: Number, min: 0 },
    employmentStatus: { type: String, enum: ["official", "probation", "internship"], default: "official" },
    officialDate: { type: Date },
  },
  { _id: false }
);
const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, index: true, lowercase: true },
  password: { type: String },
  displayName: { type: String, required: true },
  photoURL: { type: String, default: "" },
  coverImage: { type: String, default: "" },
  industry: { type: String, default: "", trim: true },
  role: { type: String, default: "user" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  birthDate: { type: Date },
  gender: { type: String, enum: ["male", "female", "other"], default: undefined },
  address: { type: String, default: "", trim: true },
  targetMarket: { type: String, default: "", trim: true },
  jobDescriptionLink: { type: String },
  phone: { type: String },
  parentId: { type: String },
  status: { type: String, enum: ["online", "offline"], default: "offline" },
  companyCode: { type: String, index: true },
  companyName: { type: String },
  branchId: { type: String, index: true },
  activeSessionId: { type: String, default: "" },
  activeSessionIssuedAt: { type: Date },
  activeSessionLastSeenAt: { type: Date },
  activeSessionUserAgent: { type: String },
  activeSessionIp: { type: String },
  employmentStatus: { type: String, enum: ["official", "probation", "internship"], default: "official" },
  officialDate: { type: Date },
  permissions: { type: [String], default: [] },
  workHoursConfig: { type: WorkHoursConfigSchema, default: undefined },
  monthlySalary: { type: Number, min: 0 },
  
  // SMTP Configuration
  smtpHost: { type: String },
  smtpPort: { type: Number },
  smtpSecure: { type: Boolean },
  smtpUser: { type: String },
  smtpPass: { type: String },
  smtpFrom: { type: String },
  smtpSandboxEmail: { type: String },

  // SaaS / Business limits
  businessType: { type: String, enum: ["driving", "language", "general"], default: "general" },
  isActive: { type: Boolean, default: true },
  maxUsersLimit: { type: Number },
}, { timestamps: true });

// Older documents must not expose retired credentials before the DB migration runs.
UserSchema.pre("init", function (raw) { stripLegacyUserFields(raw); });
UserSchema.post(["find", "findOne", "findOneAndUpdate"], function (result) {
  if (this.mongooseOptions().lean) {
    for (const user of Array.isArray(result) ? result : [result]) {
      if (user) stripLegacyUserFields(user);
    }
  }
});

export const UserModel = model<IUser>("User", UserSchema);
