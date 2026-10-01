import React from "react";
import {
  User,
  Mail,
  Lock,
  X,
  RefreshCw,
  Link2,
  Upload,
  Eye,
  Building2,
  Briefcase,
  Phone,
  Calendar,
  Image as ImageIcon,
  Camera,
  Clock,
} from "lucide-react";
import { CompanyProfile, UserProfile } from "../../types";
import { BranchRecord } from "../../services/branchService";
import { authService } from "../../services/authService";
import { toast } from "../../pages/Toast";

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
  userDepartment: string;
  userQualification: string;
  setUserDepartment: (val: string) => void;
  setUserQualification: (val: string) => void;
  userJobDescriptionLink: string;
  userMonthlySalary: string;
  setUserMonthlySalary: (val: string) => void;
  setUserJobDescriptionLink: (val: string) => void;
  setUserJobDescriptionUploadToken: (val: string) => void;
  getAvailableRoles: () => Array<{ role: string; displayName: string; level: number }>;
  userProfile: UserProfile | null;
  companies?: CompanyProfile[];
  branches: BranchRecord[];
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
  userRole,
  setUserRole,
  userCompanyCode,
  setUserCompanyCode,
  userBranchId,
  setUserBranchId,
  userParentId,
  setUserParentId,
  userDepartment,
  setUserDepartment,
  userQualification,
  setUserQualification,
  userJobDescriptionLink,
  userMonthlySalary,
  setUserMonthlySalary,
  setUserJobDescriptionLink,
  setUserJobDescriptionUploadToken,
  getAvailableRoles,
  userProfile: _userProfile,
  companies: _companies = [],
  branches,
  usersList,
  onSubmit,
  submittingUser,
  lockRole = false,
  lockCompany = false,
  lockBranch = false,
  lockParent = false,
}: UserFormModalProps) {
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [uploadingJobDescription, setUploadingJobDescription] = React.useState(false);
  const [showJobDescriptionPreview, setShowJobDescriptionPreview] = React.useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = React.useState(false);

  const avatarFileInputRef = React.useRef<HTMLInputElement>(null);
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);
  const jobDescriptionFileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleJobDescriptionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingJobDescription(true);
    try {
      const uploaded = await authService.uploadManagedFile(
        file,
        "hr.employee",
        userCompanyCode === "SYSTEM" ? undefined : userCompanyCode
      );
      setUserJobDescriptionLink(uploaded.url);
      setUserJobDescriptionUploadToken(uploaded.uploadToken);
      toast.success("Đã tải lên mô tả công việc.");
    } catch (error: any) {
      toast.error(error?.message || "Tải file mô tả công việc lên Cloudinary thất bại.");
    } finally {
      setUploadingJobDescription(false);
    }
  };

  const formatTimestamp = (dateVal: any) => {
    if (!dateVal) return "Chưa cập nhật";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "Chưa cập nhật";
      return d.toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Chưa cập nhật";
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all scale-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex justify-between items-center relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg tracking-tight font-sans">
                  {editingUser ? "Sửa thông tin người dùng" : "Thêm người dùng mới"}
                </h3>
                {editingUser && (
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-mono text-indigo-300 border border-indigo-400/30">
                    ID: {editingUser.uid.slice(0, 8)}...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {editingUser
                  ? "Cập nhật các thông tin hồ sơ, ảnh đại diện, ảnh bìa và phân quyền"
                  : "Điền đầy đủ thông tin để tạo mới tài khoản thành viên"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form autoComplete="off" onSubmit={onSubmit} className="flex flex-col min-h-0">
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
            {/* Visual Cover Image & Avatar Preview Section */}
            <div className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xs">
              {/* Cover Banner */}
              <div className="relative h-28 sm:h-36 w-full bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 overflow-hidden">
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
              <div className="px-5 pb-4 pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="flex items-center gap-4 -mt-10 sm:-mt-12">
                  <div className="relative group shrink-0">
                    <div className="h-20 w-20 sm:h-22 sm:w-22 rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center">
                      {userPhotoURL ? (
                        <img
                          src={userPhotoURL}
                          alt="Ảnh đại diện"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-full w-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl uppercase">
                          {(userDisplayName || "AV").slice(0, 2)}
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
                  <div className="pt-8 sm:pt-0">
                    <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                      {userDisplayName || "Tên người dùng"}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">
                      {userEmail || "email@congty.com"}
                    </p>
                  </div>
                </div>

                {/* Timestamps Info Pill (for Edit mode) */}
                {editingUser && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-500 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-150">
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>Tạo: {formatTimestamp(editingUser.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <RefreshCw className="h-3 w-3 text-indigo-500" />
                      <span>Sửa: {formatTimestamp(editingUser.updatedAt || editingUser.createdAt)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Direct URLs collapsible/expandable helper inputs */}
              <div className="px-5 pb-3 pt-1 border-t border-slate-150/70 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/50">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Link ảnh đại diện (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://... ảnh avatar"
                    value={userPhotoURL}
                    onChange={(e) => setUserPhotoURL(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Link ảnh bìa (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://... ảnh bìa"
                    value={userCoverImage}
                    onChange={(e) => setUserCoverImage(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Thông tin cá nhân & Doanh nghiệp */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Thông tin cơ bản
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Họ và tên */}
                <div className="space-y-1.5 text-left sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Họ và Tên <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn An"
                      value={userDisplayName}
                      onChange={(e) => setUserDisplayName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Công ty */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Công ty
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
                      placeholder="Ví dụ: Công nghệ thông tin / Giáo dục / Bất động sản"
                      value={userIndustry}
                      onChange={(e) => setUserIndustry(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

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
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      value={userBirthDate}
                      onChange={(e) => setUserBirthDate(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Địa chỉ Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                  </div>
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

            {/* Cấu hình phân quyền & tổ chức (Collapsible Toggle) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-600" />
                  Cấu hình phân quyền, phòng ban & sơ đồ tổ chức
                </span>
                <span className="text-[10px] text-indigo-600 font-mono">
                  {showAdvancedSettings ? "Thu gọn ▲" : "Chi tiết ▼"}
                </span>
              </button>

              {showAdvancedSettings && (
                <div className="mt-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Quyền hạn */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Quyền hạn (Role) *
                      </label>
                      <select
                        aria-label="Quyền hạn"
                        disabled={lockRole}
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                      >
                        {getAvailableRoles().map((r, index) => (
                          <option key={`${r.role}-${index}`} value={r.role}>
                            {r.displayName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mã doanh nghiệp */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Mã doanh nghiệp
                      </label>
                      <input
                        aria-label="Mã doanh nghiệp"
                        type="text"
                        disabled={lockCompany}
                        value={userCompanyCode}
                        onChange={(e) => setUserCompanyCode(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2 border border-slate-200 bg-white text-slate-700 rounded-xl text-xs outline-none font-mono uppercase"
                      />
                    </div>
                  </div>

                  {/* Chi nhánh */}
                  {userCompanyCode && userCompanyCode !== "SYSTEM" && (
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Chi nhánh
                      </label>
                      <select
                        aria-label="Chi nhánh"
                        disabled={lockBranch}
                        value={userBranchId}
                        onChange={(e) => setUserBranchId(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none disabled:bg-slate-50"
                      >
                        <option value="">Không gán chi nhánh</option>
                        {branches
                          .filter((branch) => branch.companyCode === userCompanyCode && branch.isActive)
                          .map((branch) => (
                            <option key={branch._id} value={branch._id}>
                              {branch.name} ({branch.code})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Quản lý trực tiếp */}
                  {userCompanyCode && userCompanyCode !== "SYSTEM" && (userRole === "user" || lockParent) && (
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Người quản lý trực tiếp
                      </label>
                      {(() => {
                        const eligibleManagers = usersList.filter(
                          (u) =>
                            u.companyCode === userCompanyCode &&
                            (lockParent ? u.uid === userParentId : u.role === "manager")
                        );
                        return eligibleManagers.length === 0 ? (
                          <div className="w-full px-3.5 py-2 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic bg-white">
                            Chưa có quản lý nào trong công ty này
                          </div>
                        ) : (
                          <div>
                            <select
                              aria-label="Người quản lý trực tiếp"
                              disabled={lockParent}
                              value={userParentId}
                              onChange={(e) => setUserParentId(e.target.value)}
                              className="w-full p-2 pl-3.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                            >
                              <option value="">— Không có / Chọn sau —</option>
                              {eligibleManagers.map((mgr) => (
                                <option key={mgr.uid} value={mgr.uid}>
                                  {`${mgr.displayName} (${mgr.jobTitle ? mgr.jobTitle + " · " : ""}${mgr.department || "Manager"})`}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Phòng ban & Trình độ */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Phòng ban
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Phòng Kỹ Thuật"
                        value={userDepartment}
                        onChange={(e) => setUserDepartment(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Trình độ chuyên môn
                      </label>
                      <input
                        type="text"
                        value={userQualification}
                        onChange={(e) => setUserQualification(e.target.value)}
                        placeholder="Ví dụ: Cử nhân, Thạc sĩ, Kỹ sư"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Lương tháng */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Lương tháng (VNĐ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={userMonthlySalary}
                      onChange={(e) => setUserMonthlySalary(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white"
                      placeholder="20000000"
                    />
                  </div>

                  {/* Mô tả công việc */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Link mô tả công việc (JD)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="url"
                          placeholder="Dán link hoặc tải file lên"
                          value={userJobDescriptionLink}
                          onChange={(e) => setUserJobDescriptionLink(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        />
                      </div>
                      <input
                        ref={jobDescriptionFileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleJobDescriptionFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => jobDescriptionFileInputRef.current?.click()}
                        disabled={uploadingJobDescription}
                        title="Tải file lên"
                        className="shrink-0 p-2 px-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all cursor-pointer bg-white"
                      >
                        {uploadingJobDescription ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </button>
                      {userJobDescriptionLink && (
                        <button
                          type="button"
                          onClick={() => setShowJobDescriptionPreview(true)}
                          title="Xem trước"
                          className="shrink-0 p-2 px-3 border border-indigo-200 bg-indigo-50 rounded-xl text-indigo-600 hover:bg-indigo-100 transition-all cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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

      {/* Job Description Link Preview Modal */}
      {showJobDescriptionPreview && userJobDescriptionLink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 h-[85vh] text-left">
            <div className="flex items-center justify-between p-4 border-b border-slate-150 bg-slate-50/50">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="h-5 w-5 text-indigo-600 shrink-0" />
                <span className="text-sm font-bold text-slate-800 truncate max-w-lg">Mô tả công việc</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={userJobDescriptionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition bg-white"
                >
                  Mở trong tab mới
                </a>
                <button
                  type="button"
                  onClick={() => setShowJobDescriptionPreview(false)}
                  className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 relative">
              <iframe
                src={
                  userJobDescriptionLink.includes("drive.google.com")
                    ? userJobDescriptionLink.replace("/edit", "/preview").replace("/view", "/preview")
                    : userJobDescriptionLink
                }
                className="w-full h-full border-0 rounded-2xl bg-white shadow-sm"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
