import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";

type RegistrationForm = {
  displayName: string;
  email: string;
  phone: string;
  companyName: string;
  industry: string;
  password: string;
};
type Field = keyof RegistrationForm;

const fields: Array<{ key: Field; label: string; type?: string }> = [
  { key: "displayName", label: "Họ và tên" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Số điện thoại", type: "tel" },
  { key: "companyName", label: "Công ty" },
  { key: "industry", label: "Lĩnh vực" },
  { key: "password", label: "Mật khẩu", type: "password" },
];

function validateField(key: Field, value: string): string {
  const trimmed = value.trim();
  const label = fields.find(field => field.key === key)?.label;
  if (!trimmed) return `Vui lòng nhập ${label?.toLowerCase()}.`;
  if (key === "email" && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return "Email không đúng định dạng.";
  if (key === "phone" && !/^(0|\+84|84)[35789][0-9]{8}$/.test(trimmed)) return "Số điện thoại không đúng định dạng (ví dụ: 0987654321).";
  if (key === "password" && trimmed.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự.";
  if (key === "password" && trimmed.length > 128) return "Mật khẩu không được vượt quá 128 ký tự.";
  if (key === "industry" && trimmed.length > 150) return "Lĩnh vực không được vượt quá 150 ký tự.";
  return "";
}

export default function ChapterRegistrationPage() {
  const { loginWithIdentifier, refreshProfile } = useAuth();
  const [form, setForm] = useState<RegistrationForm>({ displayName: "", email: "", phone: "", companyName: "", industry: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [avatar, setAvatar] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = Object.fromEntries(fields.map(({ key }) => [key, validateField(key, form[key])]).filter(([, message]) => message)) as Partial<Record<Field, string>>;
    setFieldErrors(errors);
    const firstInvalid = fields.find(({ key }) => errors[key]);
    if (firstInvalid) {
      (event.currentTarget.elements.namedItem(firstInvalid.key) as HTMLElement | null)?.focus();
      return;
    }
    setBusy(true); setError("");
    try {
      await authService.registerWithEmail(form.email.trim(), form.password, form.displayName.trim(), {
        phone: form.phone.trim(), companyName: form.companyName.trim(), industry: form.industry.trim(),
      });
      await loginWithIdentifier(form.email.trim(), form.password);
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

  return <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
    <form noValidate onSubmit={submit} className="mx-auto max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <div className="flex items-center justify-between gap-4">
        <img
          src="/igen-connect-transparent.png"
          alt="iGen Connect"
          width={144}
          height={72}
          className="h-12 w-auto object-contain object-left"
        />
        <a href="/dang-nhap" className="text-sm font-medium text-sky-700 hover:underline">← Đăng nhập</a>
      </div>
      <div><h1 className="text-2xl font-bold">Tạo tài khoản BNI</h1><p className="mt-2 text-sm text-slate-600">Sau khi tạo tài khoản, bạn có thể chọn chapter và gửi đơn gia nhập.</p></div>
      {fields.map(({ key, label, type }) => <div key={key}>
        <label htmlFor={key} className="block text-sm font-medium">{label} *</label>
        <input id={key} name={key} required type={type || "text"} minLength={key === "password" ? 8 : undefined} maxLength={key === "password" ? 128 : 150}
          inputMode={key === "phone" ? "tel" : undefined}
          aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `${key}-error` : undefined}
          value={form[key]}
          onChange={event => {
            const value = event.target.value;
            setForm(current => ({ ...current, [key]: value }));
            if (fieldErrors[key] !== undefined) setFieldErrors(current => ({ ...current, [key]: validateField(key, value) }));
          }}
          onBlur={event => setFieldErrors(current => ({ ...current, [key]: validateField(key, event.target.value) }))}
          className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:border-sky-500 ${fieldErrors[key] ? "border-red-500" : "border-slate-300"}`} />
        {fieldErrors[key] && <p id={`${key}-error`} className="mt-1 text-sm text-red-700">{fieldErrors[key]}</p>}
      </div>)}
      <label className="block text-sm font-medium">Ảnh đại diện (tùy chọn)
        <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-sm"
          onChange={event => setAvatar(event.target.files?.[0] || null)} />
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</button>
    </form>
  </main>;
}
