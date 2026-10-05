import { locate } from "../components/meetings/locateForCheckIn";
import React, { useEffect, useState } from "react";
import { toast } from "./Toast";
import { CheckCircle2, MapPin, CalendarDays, ArrowRight } from "lucide-react";

type MeetingInfo = { title: string; startsAt: string; location?: string; expiresAt: string | null };
type Mode = "member" | "guest";
const fieldClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50";
export default function MeetingCheckInPage() {
  const token = window.location.pathname.split("/").filter(Boolean).pop() || "";
  return <MeetingCheckInContent key={token} token={token} />;
}
function MeetingCheckInContent({ token }: { token: string }) {
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("member");
  const [form, setForm] = useState({ identifier: "", password: "", name: "", phone: "", company: "", industry: "" });
  const [avatar, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  function setAvatar(file: File | null) {
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
  }
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);
  const [success, setSuccess] = useState("");
  const [checkedInMeeting, setCheckedInMeeting] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "locating" | "submitting">("idle");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/meeting-checkin/" + encodeURIComponent(token), { signal: controller.signal })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message || "Không mở được buổi họp."); setMeeting(d.data); })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = !!meeting?.expiresAt && new Date(meeting.expiresAt).getTime() <= now;
  const busy = phase !== "idle";
  const switchMode = (value: Mode) => { setMode(value); setError(""); setForm(old => ({ ...old, password: "" })); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || expired || success) return;
    setError(""); setPhase("locating");
    try {
      const position = await locate();
      setPhase("submitting");
      const identity = mode === "member"
        ? { email: form.identifier.trim(), password: form.password }
        : { name: form.name.trim(), phone: form.phone.trim(), company: form.company.trim(), industry: form.industry.trim() };
      let body: string | FormData = JSON.stringify({ ...identity, ...position });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (mode === "guest" && avatar) {
        const multipart = new FormData();
        for (const [key, value] of Object.entries({ ...identity, ...position })) multipart.append(key, String(value));
        multipart.append("avatar", avatar);
        body = multipart;
        delete headers["Content-Type"];
      }
      const response = await fetch("/api/v1/meeting-checkin/" + encodeURIComponent(token) + "/" + mode, {
        method: "POST", headers, body
      });
      const data = await response.json();
      if (!response.ok) {
        const message = data.message || "Không thể check-in. Vui lòng thử lại.";
        if (response.status === 401) toast.error(message);
        throw new Error(message);
      }
      setAvatar(null);
      setCheckedInMeeting(data.data?.meetingTitle || meeting?.title || "");
      setSuccess(data.data?.name || (mode === "guest" ? form.name : "Bạn"));
      setForm(old => ({ ...old, password: "" }));
    } catch (e) { setError(e.message); } finally { setPhase("idle"); }
  };
  return <main className="min-h-dvh overflow-y-auto bg-[#f4f8fb] px-4 py-6 text-slate-900 sm:py-12">
    <section className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_16px_60px_-24px_rgba(15,60,80,0.22)]">
      <div className="h-1 bg-cyan-500" />
      <header className="px-6 pb-6 pt-7 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <img src="/igen-connect-transparent.png" alt="iGen Connect" width={144} height={72} className="h-16 w-36 object-contain object-left" />
          <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-cyan-700">CHECK-IN BUỔI HỌP</span>
        </div>
        <h1 className="mt-6 text-2xl font-bold leading-tight tracking-tight text-slate-900">{meeting?.title || (loading ? "Đang tải buổi họp…" : "Không thể mở check-in")}</h1>
        {meeting && <div className="mt-4 space-y-2 text-sm text-slate-500">
          <p className="flex items-start gap-2.5"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" /><span>{new Date(meeting.startsAt).toLocaleString("vi-VN")}</span></p>
          {meeting.location && <p className="flex items-start gap-2.5"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" /><span>{meeting.location}</span></p>}
        </div>}
      </header>
      <div className="mx-6 border-t border-slate-100 sm:mx-8" />
      <div className="p-6 sm:p-8">
        {success ? <div role="status" className="pb-4 pt-2 text-center">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50"><CheckCircle2 aria-hidden="true" className="h-10 w-10 text-emerald-600" strokeWidth={1.75} /></div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Check-in thành công</h2>
          <p className="mt-3 text-base text-slate-600">Chào mừng <strong className="font-semibold text-slate-900">{success}</strong>!</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">Thông tin tham dự của bạn đã được ghi nhận{checkedInMeeting ? " cho cuộc họp “" + checkedInMeeting + "”." : "."}</p>
          <div className="mt-7 rounded-2xl bg-cyan-50/70 px-5 py-4 text-sm leading-relaxed text-cyan-900">Bạn có thể đóng trang này và chờ MC mời phát biểu.</div>
        </div> :
          loading ? <p role="status">Đang kiểm tra mã QR…</p> :
          !meeting ? <div role="alert" className="space-y-2 text-sm text-rose-700"><p>{error}</p><p>Hãy quét lại QR đang được ban tổ chức trưng bày.</p></div> :
          expired ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Mã QR đã hết hạn. Hãy liên hệ ban tổ chức để lấy mã mới.</p> :
          <form onSubmit={submit} className="space-y-5">
            <fieldset disabled={busy} className="space-y-4">
              <legend className="mb-3 text-sm font-semibold text-slate-800">1. Bạn tham dự với vai trò nào?</legend>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
                <button type="button" aria-pressed={mode === "member"} onClick={() => switchMode("member")} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition aria-pressed:bg-white aria-pressed:text-cyan-700 aria-pressed:shadow-sm focus-visible:outline-cyan-500">Thành viên</button>
                <button type="button" aria-pressed={mode === "guest"} onClick={() => switchMode("guest")} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition aria-pressed:bg-white aria-pressed:text-cyan-700 aria-pressed:shadow-sm focus-visible:outline-cyan-500">Khách mời</button>
              </div>
              {mode === "member" ? <>
                <label className="block text-sm font-medium text-slate-700">Email hoặc số điện thoại<input required type="text" autoComplete="username" placeholder="Số điện thoại hoặc email" aria-label="Email tài khoản" value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm font-medium text-slate-700">Mật khẩu<input required type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={fieldClass} /></label>
              </> : <>
                <label className="block text-sm font-medium text-slate-700">Họ và tên *<input required minLength={2} maxLength={150} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm font-medium text-slate-700">Số điện thoại<input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm font-medium text-slate-700">Công ty<input maxLength={150} autoComplete="organization" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm font-medium text-slate-700">Lĩnh vực<input maxLength={150} value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className={fieldClass} /></label>
                <div className="space-y-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
                  <label className="block text-sm font-medium text-slate-700">Ảnh đại diện
                    <input type="file" accept="image/jpeg,image/png,image/webp" className={fieldClass}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                          setError("Vui lòng chọn ảnh JPG, PNG hoặc WebP."); return;
                        }
                        if (!file.size || file.size > 5 * 1024 * 1024) {
                          setError("Ảnh đại diện phải có dung lượng từ 1 byte đến 5 MB."); return;
                        }
                        setAvatar(file); setError("");
                      }} />
                  </label>
                  <p className="text-xs text-slate-500">JPG, PNG hoặc WebP, tối đa 5 MB. Ảnh sẽ hiển thị trên slide giới thiệu của bạn.</p>
                  {avatarPreview && <div className="flex items-center gap-3">
                    <img src={avatarPreview} alt="Xem trước ảnh đại diện" className="h-20 w-20 rounded-full border object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm">{avatar?.name}</span>
                    <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setAvatar(null)}>Bỏ ảnh</button>
                  </div>}
                </div>
              </>}
            </fieldset>
            <div className="rounded-2xl border border-cyan-100/60 bg-cyan-50/40 p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin size={18} />2. Xác nhận tại địa điểm họp</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">Khi bấm Check-in, hãy cho phép truy cập vị trí để xác nhận bạn đang ở gần địa điểm.</p></div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3.5 font-semibold text-white shadow-sm shadow-cyan-600/20 transition hover:bg-cyan-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-60">{phase === "locating" ? "Đang xác nhận vị trí…" : phase === "submitting" ? "Đang ghi nhận…" : "Check-in"}{!busy && <ArrowRight aria-hidden="true" size={18} />}</button>
            <p className="text-center text-xs text-slate-500">{meeting.expiresAt ? "QR có hiệu lực đến " + new Date(meeting.expiresAt).toLocaleTimeString("vi-VN") + "." : "QR cố định dùng chung cho các cuộc họp của đơn vị · Không hết hạn."}</p>
          </form>}
      </div>
    </section>
  </main>;
}
