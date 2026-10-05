import React, { useRef, useState } from "react";
import {
  User,
  Mail,
  Save,
  Phone,
  Building2,
  Briefcase,
  ImagePlus,
  Trash2,
  Camera,
  Calendar,
  Shield,
  BadgeCheck,
  Clock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../pages/Toast";
import { VietnameseDatePicker } from "../common/VietnameseDatePicker";
import { authService } from "../../services/authService";
import type { UserProfile } from "../../types";

const inputClass =
  "w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500 outline-none transition-all disabled:opacity-60";
const labelClass =
  "text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5";

function profileValues(profile: UserProfile) {
  return {
    displayName: profile.displayName || "",
    phone: profile.phone || "",
    birthDate: profile.birthDate?.slice(0, 10) || "",
    companyName: profile.companyName || "",
    industry: profile.industry || "",
    coverImage: profile.coverImage || "",
  };
}

function getRoleInfo(role?: string) {
  switch (role) {
    case "admin":
      return {
        label: "Quản trị viên Hệ thống",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200/80",
        description: "Toàn quyền quản lý và cấu hình toàn bộ hệ thống",
      };
    case "branch_owner":
      return {
        label: "Chủ tịch / Trưởng Chapter",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200/80",
        description: "Quản lý hoạt động, thành viên và cuộc họp Chapter",
      };
    case "manager":
      return {
        label: "Ban điều hành / Quản lý",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200/80",
        description: "Phụ trách điều phối nghiệp vụ và theo dõi tiến độ",
      };
    default:
      return {
        label: "Thành viên BNI",
        badgeClass: "bg-red-50 text-red-700 border-red-200/90",
        description: "Thành viên chính thức kết nối và phát triển kinh doanh",
      };
  }
}

function formatJoinDate(createdAt: any) {
  if (!createdAt) return "Chưa cập nhật";
  let date: Date;
  if (typeof createdAt.toDate === "function") {
    date = createdAt.toDate();
  } else if (createdAt.seconds) {
    date = new Date(createdAt.seconds * 1000);
  } else {
    date = new Date(createdAt);
  }
  if (isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProfileTab() {
  const { userProfile, updateProfileInfo } = useAuth();
  if (!userProfile) return <p className="p-6 text-sm text-gray-500">Đang tải hồ sơ...</p>;
  return <ProfileForm key={userProfile.uid} profile={userProfile} updateProfileInfo={updateProfileInfo} />;
}

function ProfileForm({
  profile,
  updateProfileInfo,
}: {
  profile: UserProfile;
  updateProfileInfo: ReturnType<typeof useAuth>["updateProfileInfo"];
}) {
  const { uploadAvatar } = useAuth();
  const [form, setForm] = useState(() => profileValues(profile));
  const [localAvatar, setLocalAvatar] = useState(profile.photoURL || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [coverUploadToken, setCoverUploadToken] = useState<string>();

  const coverFileInput = useRef<HTMLInputElement>(null);
  const avatarFileInput = useRef<HTMLInputElement>(null);

  const busy = updatingProfile || uploadingCover || uploadingAvatar;
  const roleInfo = getRoleInfo(profile.role);
  const joinDate = formatJoinDate(profile.createdAt);
  const currentAvatar = localAvatar || profile.photoURL || "";
  const initials = (form.displayName || profile.displayName || "BN")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const handleCoverFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh bìa không được vượt quá 5MB.");
      return;
    }
    setUploadingCover(true);
    try {
      const uploaded = await authService.uploadManagedFile(
        file,
        "profile.cover",
        profile.companyCode === "SYSTEM" ? undefined : profile.companyCode
      );
      setForm((current) => ({ ...current, coverImage: uploaded.url }));
      setCoverUploadToken(uploaded.uploadToken);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tải ảnh bìa thất bại.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh đại diện không được vượt quá 5MB.");
      return;
    }
    setUploadingAvatar(true);
    try {
      if (typeof uploadAvatar === "function") {
        const downloadUrl = await uploadAvatar(file);
        setLocalAvatar(downloadUrl);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tải ảnh đại diện thất bại.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.displayName.trim()) {
      toast.error("Họ và tên không được để trống!");
      return;
    }
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    if (form.birthDate > todayValue) {
      toast.error("Ngày sinh không được ở tương lai!");
      return;
    }
    const values = {
      displayName: form.displayName.trim(),
      phone: form.phone.trim(),
      birthDate: form.birthDate,
      companyName: form.companyName.trim(),
      industry: form.industry.trim(),
      coverImage: form.coverImage,
    };
    const { displayName, ...details } = values;
    setUpdatingProfile(true);
    try {
      await updateProfileInfo(displayName, profile.photoURL || "", {
        ...details,
        ...(coverUploadToken ? { coverUploadToken } : {}),
      });
      setForm(values);
      setCoverUploadToken(undefined);
    } catch {
      // AuthContext displays the error; keep the draft so the member can retry.
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HERO PROFILE BANNER CARD */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        {/* Cover Photo Area */}
        <section aria-label="Ảnh bìa hồ sơ" className="relative aspect-[21/9] sm:aspect-[24/7] min-h-[160px] sm:min-h-[220px] w-full overflow-hidden bg-primary">
          {form.coverImage && (
            <img
              key={form.coverImage}
              src={form.coverImage}
              onError={event => { event.currentTarget.style.display = "none"; }}
              alt="Ảnh bìa hồ sơ"
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            />
          )}

          {/* Floating Actions for Cover Photo */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2">
            <label htmlFor="profile-cover-file" className="sr-only">
              Chọn ảnh bìa
            </label>
            <input
              id="profile-cover-file"
              ref={coverFileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={busy}
              onChange={handleCoverFileChange}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => coverFileInput.current?.click()}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition-all shadow-sm border border-white/20 cursor-pointer disabled:opacity-50"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span>{uploadingCover ? "Đang tải ảnh..." : form.coverImage ? "Đổi ảnh bìa" : "Thêm ảnh bìa"}</span>
            </button>
            {form.coverImage && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setForm((current) => ({ ...current, coverImage: "" }));
                  setCoverUploadToken(undefined);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 px-3 py-2 text-xs font-bold text-white backdrop-blur-md transition-all shadow-sm border border-white/20 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa ảnh bìa</span>
              </button>
            )}
          </div>
        </section>

        {/* Profile Info Bar & Overlapping Avatar */}
        <div className="relative px-5 sm:px-8 pb-7 sm:pb-8 pt-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            {/* Avatar & Basic Identifiers */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              {/* Avatar Box with Direct Upload Trigger (Only Avatar overlaps the cover) */}
              <div className="relative group shrink-0 self-start sm:self-auto -mt-14 sm:-mt-18 md:-mt-20">
                <input
                  ref={avatarFileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={busy}
                  onChange={handleAvatarFileChange}
                />
                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full ring-4 ring-white shadow-xl overflow-hidden bg-white relative">
                  {uploadingAvatar ? (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100">
                      <div className="h-7 w-7 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt={form.displayName || "Ảnh đại diện"}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-600 to-blue-700 text-white font-black text-3xl select-none">
                      {initials}
                    </div>
                  )}

                  {/* Hover Overlay Button to Change Avatar */}
                  <button
                    type="button"
                    onClick={() => avatarFileInput.current?.click()}
                    disabled={busy}
                    aria-label="Đổi ảnh đại diện"
                    className="absolute inset-0 bg-slate-900/40 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity backdrop-blur-xs cursor-pointer rounded-full"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] font-bold">Đổi ảnh</span>
                  </button>
                </div>

                {/* Corner Quick Camera Icon (Rounded to hug circular avatar contour) */}
                <button
                  type="button"
                  onClick={() => avatarFileInput.current?.click()}
                  disabled={busy}
                  title="Tải lên ảnh đại diện mới"
                  aria-label="Tải lên ảnh đại diện"
                  className="absolute bottom-1 right-1 h-9 w-9 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white flex items-center justify-center shadow-lg border-2 border-white transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              {/* Title & Role Info (Safely positioned with clear spacing below cover) */}
              <div className="space-y-2 pt-4 sm:pt-5 pb-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                    {form.displayName || profile.displayName || "Thành viên"}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-[10px] uppercase border tracking-wider shadow-2xs ${roleInfo.badgeClass}`}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {roleInfo.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium">
                  {form.companyName && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-slate-700">
                      <Building2 className="h-3.5 w-3.5 text-cyan-600" />
                      {form.companyName}
                    </span>
                  )}
                  {form.industry && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-slate-600">
                      <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                      {form.industry}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                    {profile.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Membership Pill */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs shrink-0 self-start md:self-auto shadow-2xs">
              <Clock className="h-4 w-4 text-cyan-600" />
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-slate-400">Tham gia từ</p>
                <p className="font-bold text-slate-800">{joinDate}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FORM SECTIONS WITH CATEGORIZED CARDS */}
      <form onSubmit={handleUpdateProfile} className="space-y-6" aria-busy={busy}>
        <fieldset disabled={busy} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: THÔNG TIN CÁ NHÂN */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100">
                  <div className="h-9 w-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Thông tin cá nhân</h3>
                    <p className="text-xs text-slate-500">Họ tên đại diện và ngày sinh nhật thành viên</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Họ và Tên */}
                  <div className="space-y-1.5 text-left">
                    <label htmlFor="profile-displayName" className={labelClass}>
                      Họ và Tên *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        id="profile-displayName"
                        required
                        type="text"
                        placeholder="Họ và tên của bạn"
                        autoComplete="name"
                        value={form.displayName}
                        onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Ngày sinh */}
                  <div className="space-y-1.5 text-left">
                    <span className={labelClass}>Ngày sinh</span>
                    <VietnameseDatePicker
                      ariaLabel="Ngày sinh"
                      value={form.birthDate}
                      onChange={(birthDate) => setForm({ ...form, birthDate })}
                      disabled={busy}
                      placeholder="Chọn ngày sinh..."
                      className="w-full"
                      buttonClassName="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>

                  {/* Vai trò hệ thống (Hiển thị quyền hạn) */}
                  <div className="space-y-1.5 text-left">
                    <span className={labelClass}>Vai trò & Phân quyền</span>
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-cyan-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{roleInfo.label}</p>
                          <p className="text-[11px] text-slate-500">{roleInfo.description}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600">
                        {profile.role}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: DOANH NGHIỆP & BNI */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Doanh nghiệp & Nghề nghiệp</h3>
                    <p className="text-xs text-slate-500">Thông tin công ty và ngành nghề đại diện trong Chapter</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Tên doanh nghiệp */}
                  <div className="space-y-1.5 text-left">
                    <label htmlFor="profile-companyName" className={labelClass}>
                      Tên doanh nghiệp
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        id="profile-companyName"
                        type="text"
                        placeholder="Doanh nghiệp của bạn"
                        autoComplete="organization"
                        value={form.companyName}
                        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Ngành nghề */}
                  <div className="space-y-1.5 text-left">
                    <label htmlFor="profile-industry" className={labelClass}>
                      Ngành nghề
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        id="profile-industry"
                        type="text"
                        placeholder="Ví dụ: Công nghệ thông tin"
                        autoComplete="off"
                        value={form.industry}
                        onChange={(e) => setForm({ ...form, industry: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Tổ chức / Chapter */}
                  <div className="space-y-1.5 text-left">
                    <span className={labelClass}>Đơn vị / Chi nhánh</span>
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {profile.companyName || "BNI Chapter"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Mã định danh: <span className="font-mono font-semibold">{profile.companyCode || "BNI"}</span>
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full">
                        Hoạt động
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: TÀI KHOẢN & LIÊN HỆ */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Tài khoản & Liên hệ</h3>
                <p className="text-xs text-slate-500">Thông tin liên lạc và định danh đăng nhập an toàn</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Số điện thoại */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="profile-phone" className={labelClass}>
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="profile-phone"
                    type="tel"
                    placeholder="Số điện thoại liên hệ"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Địa chỉ Email (Không được đổi) */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="profile-email" className={labelClass}>
                  Địa chỉ Email (Không được đổi)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="profile-email"
                    type="email"
                    disabled
                    value={profile.email || ""}
                    className="w-full pl-11 pr-4 py-3 bg-slate-100/90 border border-slate-200 rounded-xl text-xs text-slate-500 outline-none cursor-not-allowed font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* 3. BOTTOM ACTION FOOTER */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            Ảnh hỗ trợ định dạng JPG, PNG, WebP hoặc GIF, dung lượng tối đa 5MB. Bấm <span className="font-semibold text-slate-700">Lưu thay đổi</span> để cập nhật hồ sơ.
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setForm(profileValues(profile));
                setCoverUploadToken(undefined);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy thay đổi
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-cyan-400 disabled:to-blue-400 text-white font-bold text-xs shadow-md shadow-cyan-500/15 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{updatingProfile ? "Đang lưu..." : "Lưu thay đổi"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
