import React, { useRef, useState } from "react";
import { User, Mail, Save, Phone, Building2, Briefcase, ImagePlus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../pages/Toast";
import { VietnameseDatePicker } from "../common/VietnameseDatePicker";
import { authService } from "../../services/authService";
import type { UserProfile } from "../../types";

const inputClass = "w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 outline-none transition-all disabled:opacity-60";
const labelClass = "text-[10px] font-bold text-gray-400 uppercase tracking-wider block";

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

export default function ProfileTab() {
  const { userProfile, updateProfileInfo } = useAuth();
  if (!userProfile) return <p className="p-6 text-sm text-gray-500">Đang tải hồ sơ...</p>;
  return <ProfileForm key={userProfile.uid} profile={userProfile} updateProfileInfo={updateProfileInfo} />;
}

function ProfileForm({ profile, updateProfileInfo }: {
  profile: UserProfile;
  updateProfileInfo: ReturnType<typeof useAuth>["updateProfileInfo"];
}) {
  const [form, setForm] = useState(() => profileValues(profile));
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadToken, setCoverUploadToken] = useState<string>();
  const coverFileInput = useRef<HTMLInputElement>(null);
  const busy = updatingProfile || uploadingCover;

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
      const uploaded = await authService.uploadManagedFile(file, "profile.cover", profile.companyCode === "SYSTEM" ? undefined : profile.companyCode);
      setForm((current) => ({ ...current, coverImage: uploaded.url }));
      setCoverUploadToken(uploaded.uploadToken);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tải ảnh bìa thất bại.");
    } finally {
      setUploadingCover(false);
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
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
      await updateProfileInfo(displayName, profile.photoURL || "", { ...details, ...(coverUploadToken ? { coverUploadToken } : {}) });
      setForm(values);
      setCoverUploadToken(undefined);
    } catch {
      // AuthContext displays the error; keep the draft so the member can retry.
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs">
      <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
        <User className="h-5 w-5 text-blue-500" />
        Cập nhật thông tin hồ sơ
      </h3>
      <p className="mb-4 text-xs text-gray-500">Cập nhật thông tin cá nhân và doanh nghiệp của bạn.</p>
      <form onSubmit={handleUpdateProfile} className="space-y-4" aria-busy={busy}>
        <section className="space-y-3" aria-label="Ảnh bìa hồ sơ">
          <h4 className="text-sm font-semibold text-gray-700">Ảnh bìa</h4>
          <div className="aspect-[3/1] overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600">
            {form.coverImage ? (
              <img src={form.coverImage} alt="Ảnh bìa hồ sơ" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/90">Chưa có ảnh bìa</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="profile-cover-file" className="sr-only">Chọn ảnh bìa</label>
            <input id="profile-cover-file" ref={coverFileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden" disabled={busy} onChange={handleCoverFileChange} />
            <button type="button" disabled={busy} onClick={() => coverFileInput.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <ImagePlus className="h-4 w-4" />
              {uploadingCover ? "Đang tải ảnh..." : form.coverImage ? "Đổi ảnh bìa" : "Thêm ảnh bìa"}
            </button>
            {form.coverImage && (
              <button type="button" disabled={busy} onClick={() => { setForm((current) => ({ ...current, coverImage: "" })); setCoverUploadToken(undefined); }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> Xóa ảnh bìa
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">JPG, PNG, WebP hoặc GIF, tối đa 5MB. Nên dùng ảnh ngang. Bấm Lưu thay đổi để cập nhật ảnh bìa.</p>
        </section>
        <fieldset disabled={busy} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { key: "displayName", label: "Họ và Tên *", icon: User, type: "text", placeholder: "Họ và tên của bạn", autoComplete: "name" },
            { key: "phone", label: "Số điện thoại", icon: Phone, type: "tel", placeholder: "Số điện thoại liên hệ", autoComplete: "tel" },
            { key: "companyName", label: "Tên doanh nghiệp", icon: Building2, type: "text", placeholder: "Doanh nghiệp của bạn", autoComplete: "organization" },
            { key: "industry", label: "Ngành nghề", icon: Briefcase, type: "text", placeholder: "Ví dụ: Công nghệ thông tin", autoComplete: "off" },
          ] as const).map(({ key, label, icon: Icon, ...input }) => (
            <div key={key} className="space-y-1.5 text-left">
              <label htmlFor={`profile-${key}`} className={labelClass}>{label}</label>
              <div className="relative">
                <Icon className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <input {...input} id={`profile-${key}`} required={key === "displayName"}
                  value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} />
              </div>
            </div>
          ))}
          <div className="space-y-1.5 text-left">
            <span className={labelClass}>Ngày sinh</span>
            <VietnameseDatePicker ariaLabel="Ngày sinh" value={form.birthDate}
              onChange={(birthDate) => setForm({ ...form, birthDate })} disabled={busy}
              placeholder="Chọn ngày sinh..." className="w-full"
              buttonClassName="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-blue-500/25 outline-none" />
          </div>
          <div className="space-y-1.5 text-left">
            <label htmlFor="profile-email" className={labelClass}>Địa chỉ Email (Không được đổi)</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-300" />
              <input id="profile-email" type="email" disabled value={profile.email || ""}
                className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-400 outline-none cursor-not-allowed" />
            </div>
          </div>
        </fieldset>
        <div className="pt-2 flex flex-wrap justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => { setForm(profileValues(profile)); setCoverUploadToken(undefined); }}
            className="px-5 py-3 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 disabled:opacity-60">
            Hủy thay đổi
          </button>
          <button type="submit" disabled={busy}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 flex items-center gap-2 cursor-pointer">
            <Save className="h-4 w-4" />
            <span>{updatingProfile ? "Đang lưu..." : "Lưu thay đổi"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
