export type HRSubTabType = "SƠ ĐỒ TỔ CHỨC" | "EMAIL CHÚC MỪNG";

export interface EmployeeNode {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  avatar: string;
  level: number; // 1 = CEO, 2 = Director, 3 = Manager, 4 = Staff
  parentId?: string;
  status: "online" | "offline";
  division: string;
  isLeader?: boolean;
  jobDescriptionLink?: string;
  qualification?: string;
  monthlySalary?: number;
  companyName?: string;
  industry?: string;
  birthDate?: string;
  coverImage?: string;
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
