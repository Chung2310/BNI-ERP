import { Plus, Users, Upload } from "lucide-react";
import {  UserProfile } from "../../types";

interface Props {
  userProfile?: UserProfile | null;
  onOpenCreateUserModal?: () => void;
  onOpenImport?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function UserAdminHeader({
  userProfile: _userProfile,
  onOpenCreateUserModal,
  onOpenImport,
  onRefresh: _onRefresh,
  loading: _loading,
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
      <div className="flex items-center gap-2">
        {onOpenImport && (
          <button
            type="button"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-600" />
            <span>Nhập Excel</span>
          </button>
        )}
        {onOpenCreateUserModal && (
          <button
            type="button"
            onClick={onOpenCreateUserModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm tài khoản</span>
          </button>
        )}
      </div>
    </div>
  );
}
