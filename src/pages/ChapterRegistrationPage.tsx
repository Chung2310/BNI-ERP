import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";

export default function ChapterRegistrationPage() {
  const { loginWithIdentifier, refreshProfile } = useAuth();
  const [form, setForm] = useState({ displayName: "", email: "", phone: "", companyName: "", industry: "", password: "" });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await authService.registerWithEmail(form.email, form.password, form.displayName, {
        phone: form.phone, companyName: form.companyName, industry: form.industry,
      });
      await loginWithIdentifier(form.email, form.password);
      if (avatar) {
        try {
          const body = new FormData(); body.append("avatar", avatar);
          const response = await fetch("/api/v1/auth/profile/avatar", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }, body });
          if (!response.ok) throw new Error("Không tải được ảnh đại diện.");
          await refreshProfile();
        } catch { sessionStorage.setItem("chapter_registration_avatar_error", "Tài khoản đã tạo, nhưng chưa tải được ảnh đại diện. Bạn có thể bổ sung sau."); }
      }
      window.location.assign("/chapter");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo tài khoản.");
    } finally { setBusy(false); }
  }

  const fields: Array<{ key: keyof typeof form; label: string; type?: string }> = [
    { key: "displayName", label: "Họ và tên" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Số điện thoại", type: "tel" },
    { key: "companyName", label: "Công ty" },
    { key: "industry", label: "Lĩnh vực" },
    { key: "password", label: "Mật khẩu", type: "password" },
  ];
  return <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <a href="/dang-nhap" className="text-sm font-medium text-sky-700">← Đăng nhập</a>
      <div><h1 className="text-2xl font-bold">Tạo tài khoản BNI</h1><p className="mt-2 text-sm text-slate-600">Sau khi tạo tài khoản, bạn có thể chọn chapter và gửi đơn gia nhập.</p></div>
      {fields.map(({ key, label, type }) => <label key={key} className="block text-sm font-medium">{label} *
        <input required type={type || "text"} minLength={key === "password" ? 8 : undefined} maxLength={key === "password" ? 128 : 150}
          value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))}
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500" />
      </label>)}
      <label className="block text-sm font-medium">Ảnh đại diện (tùy chọn)
        <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-sm"
          onChange={event => setAvatar(event.target.files?.[0] || null)} />
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</button>
    </form>
  </main>;
}
