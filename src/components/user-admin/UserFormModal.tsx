import React from "react";
import { createPortal } from "react-dom";
import {
  User,
  Mail,
  Lock,
  X,
  RefreshCw,
  Building2,
  Briefcase,
  Phone,
  Calendar,
  Image as ImageIcon,
  Camera,
} from "lucide-react";
import { CompanyProfile, UserProfile } from "../../types";
import { authService } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { VietnameseDatePicker } from "../common/VietnameseDatePicker";

export interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  editingUser: UserProfile | null;
  userDisplayName: string;
  setUserDisplayName: (val: string) => void;
  userCompanyName: string;
  setUserCompanyName: (val: string) => void;
  userIndustry: string;
  setUserIndustry: (val: string) => void;
  userEmail: string;
  setUserEmail: (val: string) => void;
  userPhone: string;
  setUserPhone: (val: string) => void;
  userBirthDate: string;
  setUserBirthDate: (val: string) => void;
  userPhotoURL: string;
  setUserPhotoURL: (val: string) => void;
  userCoverImage: string;
  setUserCoverImage: (val: string) => void;
  userPassword: string;
  setUserPassword: (val: string) => void;
  userRole: string;
  setUserRole: (val: string) => void;
  userCompanyCode: string;
  setUserCompanyCode: (val: string) => void;
  userBranchId: string;
  setUserBranchId: (val: string) => void;
  userParentId: string;
  setUserParentId: (val: string) => void;
  userJobDescriptionLink: string;
  userMonthlySalary: string;
  setUserMonthlySalary: (val: string) => void;
  setUserJobDescriptionLink: (val: string) => void;
  setUserJobDescriptionUploadToken: (val: string) => void;
  getAvailableRoles: () => Array<{ role: string; displayName: string; level: number }>;
  userProfile: UserProfile | null;
  companies?: CompanyProfile[];
  usersList: UserProfile[];
  onSubmit: (e: React.FormEvent) => void;
  submittingUser: boolean;
  lockRole?: boolean;
  lockCompany?: boolean;
  lockBranch?: boolean;
  lockParent?: boolean;
}

export function UserFormModal({
  open,
  onClose,
  editingUser,
  userDisplayName,
  setUserDisplayName,
  userCompanyName,
  setUserCompanyName,
  userIndustry,
  setUserIndustry,
  userEmail,
  setUserEmail,
  userPhone,
  setUserPhone,
  userBirthDate,
  setUserBirthDate,
  userPhotoURL,
  setUserPhotoURL,
  userCoverImage,
  setUserCoverImage,
  userPassword,
  setUserPassword,
  userCompanyCode,
  onSubmit,
  submittingUser,
  userRole,
  setUserRole,
  userProfile,
  lockRole = false,
}: UserFormModalProps) {
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [uploadingCover, setUploadingCover] = React.useState(false);

  const avatarFileInputRef = React.useRef<HTMLInputElement>(null);
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const uploaded = await authService.uploadManagedFile(
        file,
        "profile.avatar",
        userCompanyCode === "SYSTEM" ? undefined : userCompanyCode
      );
      setUserPhotoURL(uploaded.url);
      toast.success("Đã tải lên ảnh đại diện thành công.");
    } catch (error: any) {
      toast.error(error?.message || "Tải ảnh đại diện thất bại.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingCover(true);
    try {
      const uploaded = await authService.uploadManagedFile(
        file,
        "profile.cover",
        userCompanyCode === "SYSTEM" ? undefined : userCompanyCode
      );
      setUserCoverImage(uploaded.url);
      toast.success("Đã tải lên ảnh bìa thành công.");
    } catch (error: any) {
      toast.error(error?.message || "Tải ảnh bìa thất bại.");
    } finally {
      setUploadingCover(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all scale-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-cyan-600 text-white p-5 sm:p-6 flex justify-between items-center relative z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-700 rounded-2xl shadow-lg shadow-cyan-900/20">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg tracking-tight font-sans">
                  {editingUser ? "Sửa thông tin người dùng" : "Thêm người dùng mới"}
                </h3>
              </div>
              <p className="text-xs text-cyan-100 mt-0.5">
                {editingUser
                  ? "Cập nhật thông tin hồ sơ, ảnh đại diện và ảnh bìa"
                  : "Điền đầy đủ thông tin để tạo mới tài khoản thành viên"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-cyan-700 rounded-xl text-cyan-100 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form autoComplete="off" onSubmit={onSubmit} className="flex flex-col min-h-0">
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
            {/* Visual Cover Image & Avatar Preview Section */}
            <div className="relative isolate rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xs">
              {/* Cover Banner */}
              <div className="relative z-0 h-28 sm:h-36 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 overflow-hidden">
                {userCoverImage ? (
                  <img
                    src={userCoverImage}
                    alt="Ảnh bìa"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-30 text-white">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
                {/* Cover Image Action Buttons */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="px-2.5 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    {uploadingCover ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                    <span>{userCoverImage ? "Đổi ảnh bìa" : "Tải ảnh bìa"}</span>
                  </button>
                  {userCoverImage && (
                    <button
                      type="button"
                      onClick={() => setUserCoverImage("")}
                      title="Xóa ảnh bìa"
                      className="p-1.5 bg-black/60 hover:bg-red-600 backdrop-blur-md text-white rounded-xl transition cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Avatar & Basic Info Header inside card */}
              <div className="relative z-10 px-5 pb-4 -mt-10 sm:-mt-12 flex items-end gap-4">
                <div className="relative shrink-0 group">
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white p-1 shadow-md border border-slate-200 overflow-hidden">
                    {userPhotoURL ? (
                      <img
                        src={userPhotoURL}
                        alt="Avatar"
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl rounded-xl">
                        {(userDisplayName || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Avatar Upload trigger */}
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    title="Đổi ảnh đại diện"
                    className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                    {userDisplayName || "Tên người dùng"}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {userEmail || "email@congty.com"}
                  </p>
                </div>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Họ tên */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={userDisplayName}
                      onChange={(e) => setUserDisplayName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Email đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      disabled={!!editingUser}
                      placeholder="nguyenvana@gmail.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Công ty */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Tên Doanh nghiệp / Công ty
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Ví dụ: Công ty TNHH Marketing IGEN"
                      value={userCompanyName}
                      onChange={(e) => setUserCompanyName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Lĩnh vực */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Lĩnh vực hoạt động
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Ví dụ: Công nghệ thông tin / Bất động sản"
                      value={userIndustry}
                      onChange={(e) => setUserIndustry(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Điện thoại */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="0987654321"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Ngày sinh */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Ngày sinh
                  </label>
                  <VietnameseDatePicker
                    ariaLabel="Ngày sinh"
                    value={userBirthDate}
                    onChange={(val) => setUserBirthDate(val)}
                    placeholder="Chọn ngày sinh..."
                    className="w-full"
                    buttonClassName="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    align="right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Role */}
                <div className="space-y-1.5 text-left">
                  <label htmlFor="user-role-select" className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Vai trò <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="user-role-select"
                    aria-label="Vai trò"
                    disabled={lockRole}
                    value={userRole === "admin" ? "admin" : "user"}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="user">Member (Thành viên)</option>
                    {userProfile?.role === "admin" && (
                      <option value="admin">Admin (Quản trị viên)</option>
                    )}
                    {userRole !== "admin" && userRole !== "user" && (
                      <option value={userRole} disabled>
                        Vai trò hiện tại: {userRole}
                      </option>
                    )}
                  </select>
                </div>

                {/* Password */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Mật khẩu {!editingUser && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      required={!editingUser}
                      placeholder={editingUser ? "Để trống nếu không đổi" : "Tối thiểu 6 ký tự"}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex gap-3 justify-end p-5 sm:p-6 border-t border-slate-100 bg-slate-50/70 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submittingUser}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-600/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {submittingUser ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                "Lưu người dùng"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
