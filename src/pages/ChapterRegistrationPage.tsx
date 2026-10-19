import { useRef, useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { AlertTriangle, ArrowRight, Briefcase, Building2, CheckCircle, Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck, Sparkles, UploadCloud, User } from "lucide-react";

type RegistrationForm = {
  displayName: string;
  email: string;
  phone: string;
  companyName: string;
  industry: string;
  password: string;
};
type Field = keyof RegistrationForm;

const fieldIcons: Record<Field, LucideIcon> = {
  displayName: User,
  email: Mail,
  phone: Phone,
  companyName: Building2,
  industry: Briefcase,
  password: Lock,
};

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
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
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

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#f2f7fb] px-4 py-5 text-slate-900 sm:px-6 sm:py-8 lg:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 -top-36 h-80 w-80 rounded-full bg-cyan-200/45 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-80 w-80 rounded-full bg-blue-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-5 flex items-center justify-between gap-4 sm:mb-8">
          <a href="/" aria-label="iGen Connect, trang chủ" className="inline-flex items-center rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/20">
            <img src="/igen-connect-transparent.png" alt="iGen Connect" width={144} height={72} className="h-10 w-auto object-contain object-left sm:h-12" />
          </a>
          <a href="/dang-nhap" className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-cyan-200 hover:text-cyan-800 sm:px-4 sm:text-sm">
            <span className="hidden sm:inline">Đã có tài khoản?</span>
            <span className="text-cyan-800">Đăng nhập</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </header>

        <div className="mx-auto grid max-w-2xl items-stretch gap-5 lg:max-w-none lg:grid-cols-[0.9fr_1.1fr] lg:gap-7">
          <section className="relative hidden min-h-[650px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#062d43] via-[#075673] to-[#07364d] p-8 text-white shadow-[0_28px_80px_-36px_rgba(3,58,81,0.55)] lg:flex lg:flex-col xl:p-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-2 top-16 h-44 w-44 rounded-full border border-cyan-100/10" />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-[-5rem] right-[-3rem] h-72 w-72 rounded-full bg-cyan-300/10 blur-2xl" />

            <div className="relative flex h-full flex-col">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-100/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                <span>iGen Connect <span className="mx-1 text-cyan-300/60">·</span> BNI</span>
              </div>

              <div className="mt-12 max-w-md xl:mt-16">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Bắt đầu hành trình kết nối</p>
                <h2 className="mt-4 text-4xl font-semibold leading-[1.14] tracking-tight xl:text-[2.75rem]">
                  Một hồ sơ tốt mở ra những cuộc gặp đáng giá.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-7 text-cyan-50/75">
                  Tạo tài khoản, chọn Chapter phù hợp và gửi đề nghị tham gia ngay trên iGen Connect.
                </p>
              </div>

              <div className="mt-9 space-y-3">
                {[
                  { number: "01", title: "Tạo tài khoản", detail: "Thêm thông tin liên hệ và doanh nghiệp", active: true },
                  { number: "02", title: "Chọn Chapter", detail: "Tìm cộng đồng phù hợp với bạn", active: false },
                  { number: "03", title: "Gửi đề nghị tham gia", detail: "Chapter xem xét yêu cầu của bạn", active: false },
                ].map((step) => (
                  <div key={step.number} className={`flex items-center gap-4 rounded-2xl border p-4 transition ${step.active ? "border-cyan-200/30 bg-white/12" : "border-white/10 bg-white/[0.04]"}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${step.active ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-cyan-100"}`}>
                      {step.active ? <CheckCircle className="h-4 w-4" /> : step.number}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{step.title}</span>
                      <span className="mt-0.5 block text-xs text-cyan-50/60">{step.detail}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <p className="text-xs leading-5 text-cyan-50/70">Bạn có thể xem và cập nhật hồ sơ của mình sau khi đăng nhập.</p>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[1.75rem] border border-white/90 bg-white/95 shadow-[0_24px_70px_-30px_rgba(15,55,82,0.25)] backdrop-blur sm:rounded-[2rem]">
            <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
            <div className="p-5 sm:p-8 lg:p-9 xl:p-10">
              <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#07364d] via-[#075673] to-cyan-700 p-4 text-white shadow-md lg:hidden">
                <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-8 h-28 w-28 rounded-full border border-white/15" />
                <div className="relative flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/12 text-cyan-100 ring-1 ring-white/15">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100">iGen Connect · BNI</span>
                    <span className="mt-1 block text-sm font-semibold">Bắt đầu từ hồ sơ của bạn</span>
                  </span>
                </div>
              </div>
              <div className="mb-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-800">Hồ sơ thành viên mới</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-800 ring-1 ring-cyan-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> BƯỚC 1 / 2
                  </span>
                </div>
                <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-600 to-sky-400" />
                </div>
                <div className="flex items-start gap-3.5">
                  <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 sm:flex">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">Tạo tài khoản BNI</h1>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">Điền thông tin cơ bản để tạo hồ sơ và tiếp tục chọn Chapter.</p>
                  </div>
                </div>
              </div>

              <form noValidate onSubmit={submit} className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700">Thông tin tài khoản</span>
                  <span className="text-[10px] font-medium text-slate-400"><span className="text-rose-500">*</span> Bắt buộc</span>
                </div>

                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  {fields.map(({ key, label, type }) => {
                    const Icon = fieldIcons[key];
                    const inputType = key === "password" ? (showPassword ? "text" : "password") : (type || "text");
                    const autoComplete = key === "displayName" ? "name"
                      : key === "email" ? "email"
                        : key === "phone" ? "tel"
                          : key === "companyName" ? "organization"
                            : key === "password" ? "new-password" : "off";
                    const placeholder = key === "displayName" ? "Ví dụ: Nguyễn Minh An"
                      : key === "email" ? "ban@example.com"
                        : key === "phone" ? "0987654321"
                          : key === "companyName" ? "Tên doanh nghiệp"
                            : key === "industry" ? "Ví dụ: Tư vấn, công nghệ…" : "Tối thiểu 8 ký tự";
                    return (
                      <div key={key} className={key === "password" || key === "industry" ? "sm:col-span-2" : ""}>
                        <label htmlFor={key} className="mb-1.5 block text-xs font-semibold text-slate-700">
                          {label} <span className="font-bold text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Icon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            id={key}
                            name={key}
                            required
                            type={inputType}
                            autoComplete={autoComplete}
                            autoCapitalize={key === "email" || key === "password" ? "none" : "words"}
                            spellCheck={key !== "email" && key !== "password"}
                            minLength={key === "password" ? 8 : undefined}
                            maxLength={key === "password" ? 128 : 150}
                            inputMode={key === "phone" ? "tel" : undefined}
                            placeholder={placeholder}
                            aria-invalid={Boolean(fieldErrors[key])}
                            aria-describedby={fieldErrors[key] ? `${key}-error` : key === "password" ? "password-help" : undefined}
                            value={form[key]}
                            onChange={event => {
                              const value = event.target.value;
                              setForm(current => ({ ...current, [key]: value }));
                              if (fieldErrors[key] !== undefined) setFieldErrors(current => ({ ...current, [key]: validateField(key, value) }));
                            }}
                            onBlur={event => setFieldErrors(current => ({ ...current, [key]: validateField(key, event.target.value) }))}
                            className={`h-12 w-full rounded-xl border bg-slate-50/70 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${fieldErrors[key] ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-cyan-500 focus:ring-cyan-500/10"} ${key === "password" ? "pr-12" : ""}`}
                          />
                          {key === "password" && (
                            <button
                              type="button"
                              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                              aria-pressed={showPassword}
                              onClick={() => setShowPassword(value => !value)}
                              className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        {key === "password" && !fieldErrors[key] && <p id="password-help" className="mt-1.5 text-[11px] text-slate-400">Dùng ít nhất 8 ký tự. Bạn có thể ẩn mật khẩu sau khi nhập.</p>}
                        {fieldErrors[key] && <p id={`${key}-error`} className="mt-1.5 text-xs font-medium text-rose-600">{fieldErrors[key]}</p>}
                      </div>
                    );
                  })}
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span id="avatar-label" className="text-xs font-semibold text-slate-700">Ảnh đại diện <span className="font-normal text-slate-400">(tùy chọn)</span></span>
                    {avatar && <button type="button" onClick={() => { setAvatar(null); if (avatarInputRef.current) avatarInputRef.current.value = ""; }} className="text-[11px] font-semibold text-rose-600 hover:text-rose-700">Gỡ ảnh</button>}
                  </div>
                  <label htmlFor="avatar" className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5 transition hover:border-cyan-400 hover:bg-cyan-50/50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200/80 transition group-hover:ring-cyan-200">
                      <UploadCloud className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-700">{avatar?.name || "Chọn ảnh từ thiết bị"}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">JPG, PNG hoặc WEBP</span>
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 shadow-sm transition group-hover:border-cyan-200 group-hover:text-cyan-800">Duyệt ảnh</span>
                    <input id="avatar" name="avatar" ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-labelledby="avatar-label" className="sr-only" onChange={event => setAvatar(event.target.files?.[0] || null)} />
                  </label>
                </div>

                {error && (
                  <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="space-y-3 pt-1">
                  <button disabled={busy} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-700 to-cyan-600 px-4 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(8,145,178,0.85)] transition hover:from-sky-800 hover:to-cyan-700 hover:shadow-[0_14px_28px_-12px_rgba(8,145,178,0.8)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/25 disabled:cursor-wait disabled:opacity-60">
                    {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo tài khoản…</> : <>Tạo tài khoản <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-[10px] leading-5 text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cyan-700" />
                    Thông tin được xử lý theo <a href="/privacy-policy" className="font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-cyan-800">Chính sách quyền riêng tư</a>.
                  </p>
                </div>
              </form>
            </div>
          </section>
        </div>

        <footer className="mx-auto mt-6 flex max-w-2xl flex-col items-center justify-between gap-2 text-[10px] text-slate-400 sm:flex-row sm:text-xs lg:max-w-none">
          <span>iGen Connect <span className="mx-1 text-slate-300">·</span> Kết nối doanh nghiệp trong Chapter BNI</span>
          <a href="/dang-nhap" className="font-semibold text-cyan-800 hover:text-cyan-950">Quay lại đăng nhập</a>
        </footer>
      </div>
    </main>
  );
}
