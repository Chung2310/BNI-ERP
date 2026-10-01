import { Activity, Building2, Calendar, MoreVertical, Pencil, Phone, Shield, Trash2 } from "lucide-react";
import { UserTableProps } from "./types";
import { getRoleDisplayName } from "../../utils/permissionUtils";

export function UserListTable({
  users,
  currentUser,
  rolePermissionsList,
  userPage: _userPage,
  totalUserPages: _totalUserPages,
  onPageChange: _onPageChange,
  getAvailableRoles,
  onRoleChange,
  openActionMenuId,
  onToggleActionMenu,
  onEditUser,
  onDeleteUser,
  onViewActivity,
}: UserTableProps) {
  const formatDate = (dateVal: any) => {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("vi-VN");
    } catch {
      return "—";
    }
  };

  return (
    <div className="max-w-full rounded-2xl border border-slate-200 bg-white shadow-xs" style={{ overflow: "clip" }}>
      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[980px] border-collapse text-left font-sans text-xs sm:min-w-[1240px]">
          <thead>
            <tr className="border-b border-slate-150 bg-slate-50/80 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="p-4 pl-6">Thành viên</th>
              <th className="p-4">Doanh nghiệp & Lĩnh vực</th>
              <th className="p-4">Địa chỉ Email</th>
              <th className="p-4">Ngày sinh & Điện thoại</th>
              <th className="p-4">Ngày tạo / Ngày sửa</th>
              <th className="p-4">Quyền hạn (Role)</th>
              <th className="p-4 pr-6 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {users.map((usr) => {
              const isSelf = usr.uid === currentUser?.uid;
              return (
                <tr key={usr.uid} className="transition-colors hover:bg-slate-50/60">
                  {/* Thành viên */}
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        {usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/")) ? (
                          <img
                            src={usr.photoURL}
                            alt={usr.displayName}
                            className="h-10 w-10 rounded-xl border border-slate-200 object-cover shadow-2xs"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-xs font-bold text-indigo-700 shadow-2xs uppercase">
                            {(usr.displayName || usr.email || "US").slice(0, 2)}
                          </div>
                        )}
                        {usr.coverImage && (
                          <span
                            title="Có ảnh bìa"
                            className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-600 text-[8px] text-white ring-2 ring-white"
                          >
                            ★
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="flex items-center gap-1.5 font-bold text-slate-800">
                          {usr.displayName}
                          {isSelf && (
                            <span className="rounded-sm border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-blue-700">
                              BẠN
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                          UID: {usr.uid.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Doanh nghiệp & Lĩnh vực */}
                  <td className="p-4">
                    <div className="flex flex-col gap-0.5 max-w-[200px]">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800 truncate" title={usr.companyName || usr.companyCode || "Chưa cập nhật"}>
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{usr.companyName || usr.companyCode || "Chưa cập nhật"}</span>
                      </div>
                      {usr.industry ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-600 font-medium truncate max-w-max" title={usr.industry}>
                          {usr.industry}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic font-mono">Chưa chọn lĩnh vực</span>
                      )}
                    </div>
                  </td>

                  {/* Địa chỉ Email */}
                  <td className="p-4 font-mono text-slate-600 select-all">
                    {usr.email}
                  </td>

                  {/* Ngày sinh & Điện thoại */}
                  <td className="p-4">
                    <div className="flex flex-col gap-1 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{usr.phone && usr.phone !== "Chưa cập nhật" ? usr.phone : "Chưa có"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[10px]">
                        <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{formatDate(usr.birthDate)}</span>
                      </div>
                    </div>
                  </td>

                  {/* Ngày tạo / Ngày sửa */}
                  <td className="p-4 font-mono text-[11px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-600" title="Ngày tạo tài khoản">
                        Tạo: {formatDate(usr.createdAt)}
                      </span>
                      <span className="text-[10px] text-slate-400" title="Lần chỉnh sửa gần nhất">
                        Sửa: {formatDate(usr.updatedAt || usr.createdAt)}
                      </span>
                    </div>
                  </td>

                  {/* Quyền hạn (role) */}
                  <td className="p-4">
                    <span
                      className={`flex w-max items-center gap-1.5 rounded-full px-2.5 py-0.75 font-mono text-[9px] font-bold uppercase tracking-wider ${
                        usr.role === "admin"
                          ? "border border-amber-200 bg-amber-50 text-amber-800"
                          : usr.role === "manager"
                            ? "border border-blue-200 bg-blue-50 text-blue-800"
                            : usr.role === "user"
                              ? "border border-slate-200 bg-slate-50 text-slate-600"
                              : "border border-indigo-200 bg-indigo-50 text-indigo-700"
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      {getRoleDisplayName(usr.role, rolePermissionsList.find((rp) => rp.role === usr.role)?.displayName)}
                    </span>
                  </td>

                  {/* Hành động */}
                  <td className="p-4 pr-6">
                    <div className="flex items-center justify-end gap-2.5">
                      <select
                        aria-label="Thay đổi vai trò"
                        disabled={isSelf || (usr.role === "admin" && currentUser?.role === "admin")}
                        value={usr.role}
                        onChange={(e) => onRoleChange(usr.uid, usr.displayName, e.target.value as any)}
                        className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-indigo-500 ${
                          isSelf || (usr.role === "admin" && currentUser?.role === "admin")
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-50"
                            : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300"
                        }`}
                      >
                        {[
                          ...getAvailableRoles(),
                          ...(!getAvailableRoles().some((r) => r.role === usr.role) ? [{ role: usr.role, displayName: usr.role.toUpperCase(), level: 99 }] : []),
                        ].map((r, index) => (
                          <option key={`${usr.uid}-${r.role}-${index}`} value={r.role}>
                            {r.displayName}
                          </option>
                        ))}
                      </select>

                      <div className="relative" data-action-menu>
                        <button
                          type="button"
                          onClick={() => onToggleActionMenu(usr.uid)}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 cursor-pointer"
                          title="Thao tác"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openActionMenuId === usr.uid && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                            {onViewActivity && (
                              <button
                                type="button"
                                onClick={() => onViewActivity(usr)}
                                className="flex w-full items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-cyan-50 cursor-pointer"
                              >
                                <Activity className="h-3.5 w-3.5 text-cyan-600" />
                                Xem hoạt động
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditUser(usr)}
                              className="flex w-full items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-indigo-50 cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                              Sửa thông tin
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteUser(usr)}
                              disabled={isSelf || usr.role === "admin"}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              Xóa tài khoản
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
