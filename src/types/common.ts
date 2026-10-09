
export type TabType =
  | "TỔNG QUAN"
  | "NHÂN SỰ"
  | "CUỘC HỌP"
  | "BẢNG XẾP HẠNG"
  | "QUẢN LÝ TÀI NGUYÊN"
  | "TRÒ CHUYỆN"
  | "TÀI NGUYÊN"
  | "PHÂN TÍCH & BÁO CÁO"
  | "QUẢN TRỊ USER"
  | "CÀI ĐẶT";

export interface CompanyDriveStatus {
  isConnected: boolean;
  driveEmail: string;
  rootFolderId?: string;
  connectedAt?: import("../utils/dateValue").DateValue | null;
}

export interface UserProfile {
  id?: string;
  _id?: string;
  companyDrive?: CompanyDriveStatus;
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  coverImage?: string;
  galleryImages?: string[];
  industry?: string;
  role: "user" | "teacher" | "manager" | "branch_owner" | "admin" | "superadmin";
  membershipStatus?: "none" | "active";
  permissions?: string[];
  createdAt: import("../utils/dateValue").DateValue;
  updatedAt?: import("../utils/dateValue").DateValue;
  birthDate?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  targetMarket?: string;
  jobDescriptionLink?: string;
  phone?: string;
  parentId?: string;
  status?: "online" | "offline";
  companyCode?: string;
  companyName?: string;
  branchId?: string;
  branchName?: string;
  /** Module nghiệp vụ được bật cho doanh nghiệp. Thiếu hoặc rỗng = bật tất cả. */
  enabledModules?: string[];
  businessType?: "education" | "labor" | "service" | "recruitment" | "general";
  monthlySalary?: number;
  isActive?: boolean;
}

export interface CompanyProfile {
  id: string;
  code: string;
  name: string;
  createdAt: import("../utils/dateValue").DateValue;
  ownerEmail: string;
  enabledModules?: string[];
  businessType?: "education" | "labor" | "service" | "recruitment" | "general";
  monthlySalary?: number;
}
