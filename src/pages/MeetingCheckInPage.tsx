import React, { useEffect, useState } from "react";
import { CheckCircle2, MapPin } from "lucide-react";

type MeetingInfo = { title: string; startsAt: string; location?: string; expiresAt: string };
type Mode = "member" | "guest";
const fieldClass = "mt-1 w-full rounded-xl border border-slate-200 p-3 text-base";
function locate(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Trình duyệt không hỗ trợ vị trí. Hãy mở liên kết bằng Chrome hoặc Safari.")); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      e => reject(new Error(e.code === 1 ? "Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí trong trình duyệt rồi thử lại." : "Chưa lấy được GPS. Hãy đến nơi thoáng hơn và thử lại.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
export default function MeetingCheckInPage() {
  const token = window.location.pathname.split("/").filter(Boolean).pop() || "";
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("member");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", company: "" });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "locating" | "submitting">("idle");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/v1/meeting-checkin/" + encodeURIComponent(token), { signal: controller.signal })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message || "Không mở được buổi họp."); setMeeting(d.data); })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = !!meeting && new Date(meeting.expiresAt).getTime() <= now;
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
        ? { email: form.email.trim(), password: form.password }
        : { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), company: form.company.trim() };
      const response = await fetch("/api/v1/meeting-checkin/" + encodeURIComponent(token) + "/" + mode, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...identity, ...position })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Không thể check-in. Vui lòng thử lại.");
      setSuccess(data.data?.name || (mode === "guest" ? form.name : "Bạn"));
      setForm(old => ({ ...old, password: "" }));
    } catch (e: any) { setError(e.message); } finally { setPhase("idle"); }
  };
  return <main className="min-h-dvh overflow-y-auto bg-slate-100 px-4 py-8 text-slate-900">
    <section className="mx-auto max-w-lg overflow-hidden rounded-2xl bg-white shadow-lg">
      <header className="bg-cyan-800 p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-100">Check-in buổi họp</p>
        <h1 className="mt-2 text-2xl font-bold">{meeting?.title || (loading ? "Đang tải buổi họp…" : "Không thể mở check-in")}</h1>
        {meeting && <><p className="mt-3 text-sm text-cyan-50">{new Date(meeting.startsAt).toLocaleString("vi-VN")}</p>{meeting.location && <p className="mt-1 text-sm text-cyan-50">{meeting.location}</p>}</>}
      </header>
      <div className="p-6">
        {success ? <div role="status" className="space-y-3 py-6 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /><h2 className="text-xl font-bold">Check-in thành công</h2><p>{success}, thông tin tham dự của bạn đã được ghi nhận.</p><p className="text-sm text-slate-500">Bạn có thể đóng trang này và chờ MC mời phát biểu.</p></div> :
          loading ? <p role="status">Đang kiểm tra mã QR…</p> :
          !meeting ? <div role="alert" className="space-y-2 text-sm text-rose-700"><p>{error}</p><p>Hãy quét lại QR đang được ban tổ chức trưng bày.</p></div> :
          expired ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Mã QR đã hết hạn. Hãy liên hệ ban tổ chức để lấy mã mới.</p> :
          <form onSubmit={submit} className="space-y-5">
            <fieldset disabled={busy} className="space-y-4">
              <legend className="mb-3 font-semibold">1. Bạn tham dự với vai trò nào?</legend>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={mode === "member"} onClick={() => switchMode("member")} className="rounded-xl border px-4 py-3 font-semibold aria-pressed:border-cyan-700 aria-pressed:bg-cyan-50 aria-pressed:text-cyan-800">Thành viên</button>
                <button type="button" aria-pressed={mode === "guest"} onClick={() => switchMode("guest")} className="rounded-xl border px-4 py-3 font-semibold aria-pressed:border-cyan-700 aria-pressed:bg-cyan-50 aria-pressed:text-cyan-800">Khách mời</button>
              </div>
              {mode === "member" ? <>
                <label className="block text-sm">Email tài khoản<input required type="email" autoComplete="username" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm">Mật khẩu<input required type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={fieldClass} /></label>
              </> : <>
                <label className="block text-sm">Họ và tên *<input required minLength={2} maxLength={150} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm">Email<input type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm">Số điện thoại<input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm">Công ty<input maxLength={150} autoComplete="organization" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={fieldClass} /></label>
              </>}
            </fieldset>
            <div className="rounded-xl bg-slate-50 p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin size={18} />2. Xác nhận tại địa điểm họp</h2><p className="mt-2 text-sm text-slate-600">Khi bấm Check-in, hãy cho phép truy cập vị trí để xác nhận bạn đang ở gần địa điểm.</p></div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-cyan-800 p-3 font-semibold text-white disabled:opacity-60">{phase === "locating" ? "Đang xác nhận vị trí…" : phase === "submitting" ? "Đang ghi nhận…" : "Check-in"}</button>
            <p className="text-center text-xs text-slate-500">QR có hiệu lực đến {new Date(meeting.expiresAt).toLocaleTimeString("vi-VN")}.</p>
          </form>}
      </div>
    </section>
  </main>;
}
