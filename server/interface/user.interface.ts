import { Document } from "mongoose";

export interface IWorkHoursConfig {
  useCustom: boolean;
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: number[];
  annualLeaveDays?: number;
  employmentStatus?: "official" | "probation" | "internship";
  officialDate?: Date | string;
}

export interface IUser extends Document {
  workHoursConfig?: IWorkHoursConfig;
  employmentStatus?: "official" | "probation" | "internship";
  officialDate?: Date;
  monthlySalary?: number;
  email: string;
  password?: string; // Hashed password
  displayName: string;
  photoURL?: string;
  coverImage?: string;
  industry?: string;
  role: string;
  createdAt: Date;
  updatedAt?: Date;
  birthDate?: Date;
  jobDescriptionLink?: string;
  phone?: string;
  parentId?: string;
  status?: "online" | "offline";
  disabledAt?: Date | null;
  companyCode?: string;
  companyName?: string;
  branchId?: string;
  activeSessionId?: string;
  activeSessionIssuedAt?: Date;
  activeSessionLastSeenAt?: Date;
  activeSessionUserAgent?: string;
  activeSessionIp?: string;
  permissions?: string[];
  
  // SMTP Configuration
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpSandboxEmail?: string;

  // SaaS / Business limits
  businessType?: "driving" | "language" | "general";
  isActive?: boolean;
  maxUsersLimit?: number;
}

