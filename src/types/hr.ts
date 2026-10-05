export type HRSubTabType = "SƠ ĐỒ TỔ CHỨC" | "EMAIL CHÚC MỪNG" | "PHÍ THƯỜNG NIÊN";

export interface EmployeeNode {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar: string; // 1 = CEO, 2 = Director, 3 = Manager, 4 = Staff
  parentId?: string;
  status: "online" | "offline";
  jobDescriptionLink?: string;
  monthlySalary?: number;
  companyName?: string;
  industry?: string;
  birthDate?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  targetMarket?: string;
  coverImage?: string;
  galleryImages?: string[];
}


export interface TrainingCourse {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  isRequired?: boolean;
  icon?: string;
  imageUrl?: string;
  duration?: string;
  instructor?: string;
  companyCode?: string;
  creatorUid?: string;
  createdAt?: any;
  enrolledCount?: number;
  companyProgress?: number;
  autoAssignOnboarding?: boolean;
}
