
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
  connectedAt?: any | null;
}

export interface UserProfile {
  companyDrive?: CompanyDriveStatus;
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  coverImage?: string;
  industry?: string;
  role: "user" | "teacher" | "manager" | "branch_owner" | "admin";
  permissions?: string[];
  createdAt: any;
  updatedAt?: any;
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
  createdAt: any;
  ownerEmail: string;
  enabledModules?: string[];
  businessType?: "education" | "labor" | "service" | "recruitment" | "general";
  monthlySalary?: number;
}
