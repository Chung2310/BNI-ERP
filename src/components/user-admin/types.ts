import { UserProfile } from "../../types";

export type UserAdminTabKey = "users" | "roles";

export interface UserFormState {
  displayName: string;
  companyName?: string;
  industry?: string;
  phone?: string;
  birthDate?: string;
  photoURL?: string;
  coverImage?: string;
  email: string;
  password?: string;
  role: string;
  companyCode: string;
  parentId?: string;
}

export interface UserTableProps {
  users: UserProfile[];
  currentUser?: UserProfile | null;
  userPage: number;
  totalUserPages: number;
  onPageChange: (page: number | ((prev: number) => number)) => void;
  openActionMenuId: string | null;
  onToggleActionMenu: (uid: string) => void;
  onEditUser: (user: UserProfile) => void;
  onDeleteUser: (user: UserProfile) => void;
  onViewActivity?: (user: UserProfile) => void;
}

export interface CompanyFormState {
  companyName: string;
  companyCode: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  enabledModules: string[];
}

export interface CompanyEditFormState {
  id: string;
  name: string;
  code: string;
  ownerEmail: string;
  enabledModules: string[];
}
