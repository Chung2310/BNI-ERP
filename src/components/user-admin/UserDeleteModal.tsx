import { parseDateValue } from "../../utils/dateValue";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Mail,
  Phone,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { UserProfile } from "../../types";

export interface UserDeleteModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onConfirm: () => void | Promise<void>;
  deleting: boolean;
}

export function UserDeleteModal({
  open,
  onClose,
  user,
  onConfirm,
  deleting,
}: UserDeleteModalProps) {
  if (!open || !user) return null;

  const formatDate = (dateVal: unknown) => {
    if (!dateVal) return "Chưa cập nhật";
    try {
      const d = parseDateValue(dateVal);
      if (isNaN(d.getTime())) return "Chưa cập nhật";
      return d.toLocaleDateString("vi-VN");
    } catch {
      return "Chưa cập nhật";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50/70 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Xác nhận xóa tài khoản</h3>
              <p className="text-xs text-rose-600 font-medium">Hành động này không thể hoàn tác</p>
            </div>
          </div>
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: User Details Card */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-600 leading-relaxed">
            Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản người dùng dưới đây khỏi hệ thống không?
          </p>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
            {/* User Profile Header */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-slate-200/70">
              {user.photoURL && (user.photoURL.startsWith("http") || user.photoURL.startsWith("/")) ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="h-12 w-12 rounded-2xl border border-slate-200 object-cover shadow-xs"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-100 font-bold text-indigo-700 uppercase">
                  {(user.displayName || user.email || "US").slice(0, 2)}
                </div>
              )}
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{user.displayName}</h4>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5">
                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>{user.email}</span>
                </div>
              </div>
            </div>

            {/* Detailed Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500">Công ty:</span>
                <span className="font-semibold truncate">{user.companyName || user.companyCode || "Chưa có"}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-slate-500">Lĩnh vực:</span>
                <span className="font-semibold truncate">{user.industry || "Chưa có"}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500">Điện thoại:</span>
                <span className="font-mono">{user.phone && user.phone !== "Chưa cập nhật" ? user.phone : "Chưa có"}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500">Ngày sinh:</span>
                <span className="font-mono">{formatDate(user.birthDate)}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Ngày tạo: {formatDate(user.createdAt)}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Ngày sửa: {formatDate(user.updatedAt || user.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-[11px] text-amber-800 leading-relaxed">
            Lưu ý: Mọi quyền hạn, vai trò và dữ liệu cá nhân của thành viên này sẽ bị xóa hoặc thu hồi trên hệ thống.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
          >
            {deleting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Đang xóa...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Xóa tài khoản này
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
