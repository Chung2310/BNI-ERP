import { Plus, RefreshCw, Users } from "lucide-react";
import { CompanyProfile, UserProfile } from "../../types";

interface Props {
  userProfile?: UserProfile | null;
  onOpenCreateUserModal?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function UserAdminHeader({
  userProfile,
  onOpenCreateUserModal,
  onRefresh,
  loading,
}: Props) {
  return (
    <div className="border-b border-gray-200 bg-gray-50/50 p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0" id="user_admin_header">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-cyan-600 rounded-2xl shadow-sm text-white">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-cyan-700 text-xl lg:text-2xl tracking-tight">
            Quản trị Tài khoản & Phân quyền
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Quản lý danh sách thành viên & phân quyền vai trò</p>
        </div>
      </div>
    </div>
  );
}

