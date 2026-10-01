import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ConfirmDialog } from "../common/ConfirmDialog";
type Qr = { url: string; expiresAt: string };
type Meeting = { _id: string; title: string; status: string; latitude?: number; longitude?: number; gpsRadiusMeters?: number; checkInQrExpiresAt?: string; checkInQrTokenHash?: string; speakers: { userId?: string }[] };
export function MeetingCheckInPanel({ meeting, canManage, api, onRefresh, onConfigure, onOperate }: {
  meeting: Meeting; canManage: boolean; api: (path: string, method?: string, body?: unknown) => Promise<any>;
  onRefresh: () => Promise<void>; onConfigure: () => void; onOperate: () => void;
}) {
  const storageKey = "meeting-qr:" + meeting._id;
  const [qr, setQr] = useState<Qr | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const [image, setImage] = useState("");
  const [hours, setHours] = useState(1);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let current = true;
    setImage("");
    if (qr) QRCode.toDataURL(qr.url, { width: 400, margin: 2 }).then(value => { if (current) setImage(value); }).catch(() => { if (current) setError("Không hiển thị được QR. Hãy dùng liên kết check-in."); });
    return () => { current = false; };
  }, [qr]);
  const open = ["scheduled", "live", "paused"].includes(meeting.status);
  const hasGps = typeof meeting.latitude === "number" && typeof meeting.longitude === "number";
  const expiry = meeting.checkInQrExpiresAt ? new Date(meeting.checkInQrExpiresAt).getTime() : 0;
  const active = open && expiry > now;
  const matchingQr = active && qr && new Date(qr.expiresAt).getTime() === expiry;
  useEffect(() => {
    const request = ++requestVersion.current;
    let cancelled = false;
    setQr(null); setCopied(false); setLegacy(false); setError('');
    if (!canManage || !active) { setRecovering(false); return; }
    setRecovering(true);
    const restore = async () => {
      try {
        let result = await api('/' + meeting._id + '/checkin-qr');
        if (cancelled || request !== requestVersion.current) return;
        if (result?.legacy) {
          let cached: Qr | null = null;
          try { cached = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { /* Storage is optional. */ }
          if (cached?.url && new Date(cached.expiresAt).getTime() === new Date(result.expiresAt).getTime()) {
            const token = new URL(cached.url, window.location.origin).pathname.split('/').pop();
            result = await api('/' + meeting._id + '/checkin-qr', 'PUT', { token });
          }
        }
        if (cancelled || request !== requestVersion.current) return;
        if (result?.checkInUrl) {
          setQr({ url: new URL(result.checkInUrl, window.location.origin).href, expiresAt: result.expiresAt });
        } else setLegacy(!!result?.legacy);
      } catch (e: any) {
        if (!cancelled && request === requestVersion.current) setError(e.message || 'Không tải được mã QR. Vui lòng thử lại.');
      } finally {
        if (!cancelled && request === requestVersion.current) setRecovering(false);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [api, meeting._id, meeting.checkInQrTokenHash, expiry, active, canManage, retry, storageKey]);
  const members = meeting.speakers.filter(p => p.userId).length;
  const generate = async () => {
    ++requestVersion.current;
    setRecovering(false); setLegacy(false);
    setBusy(true); setError("");
    try {
      const result = await api("/" + meeting._id + "/checkin-qr", "POST", { hours });
      const next = { url: new URL(result.checkInUrl, window.location.origin).href, expiresAt: result.expiresAt };
      setQr(next); setNow(Date.now());
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* QR remains available in memory. */ }
      await onRefresh(); setConfirm(false);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-xl font-bold text-slate-900">Đón tiếp & check-in</h3><p className="mt-1 text-sm text-slate-500">{members} thành viên · {meeting.speakers.length - members} khách mời · thứ tự phát biểu theo check-in</p></div>
      <button type="button" onClick={onOperate} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white">Sang điều hành →</button>
    </div>
    {!open ? <p className="rounded-xl bg-slate-100 p-4 text-sm">Buổi họp đã đóng check-in. Danh sách tham dự được giữ lại bên dưới.</p> :
      !canManage ? <p className="rounded-xl bg-cyan-50 p-4 text-sm">Quét mã QR do ban tổ chức cung cấp tại địa điểm họp, chọn Thành viên hoặc Khách mời và cho phép xác nhận vị trí.</p> :
      <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-4">
          {matchingQr && image ? <><img src={image} alt={"QR check-in " + meeting.title} className="w-full max-w-[280px]" /><p className="mt-2 text-center text-sm font-semibold">{meeting.title}</p><p className="mt-1 text-xs text-emerald-700">Còn {Math.ceil((expiry - now) / 60000)} phút</p></> : <p className="py-10 text-center text-sm text-slate-500">{recovering ? "Đang tải mã QR đã tạo…" : legacy ? "Mã QR cũ chưa được lưu để khôi phục. Mở lại tab đã tạo mã để đồng bộ, hoặc tạo mã thay thế một lần." : active ? "Mã QR vẫn còn hiệu lực. Tải lại để hiển thị mã." : "Chưa mở QR check-in hoặc mã đã hết hạn."}</p>}
        </div>
        <div className="space-y-4">
          <div><h4 className="font-bold">Mở QR khi bắt đầu đón khách</h4><p className="mt-1 text-sm text-slate-500">Thời hạn tính từ lúc tạo mã. Thành viên xác nhận tài khoản; khách mời điền thông tin. QR vẫn dùng được khi cuộc họp đang diễn ra.</p></div>
          <p className="text-sm">{hasGps ? "Kiểm tra vị trí trong bán kính " + (meeting.gpsRadiusMeters || 200) + " m." : "Cần bổ sung GPS địa điểm trước khi mở check-in."} <button type="button" onClick={onConfigure} className="font-semibold text-cyan-700 underline">Cấu hình địa điểm</button></p>
          <label className="block text-sm">Thời hạn QR<select value={hours} onChange={e => setHours(+e.target.value)} disabled={busy} className="mt-1 block w-full rounded-lg border p-2"><option value={1}>1 giờ từ lúc tạo</option><option value={2}>2 giờ từ lúc tạo</option></select></label>
          <button type="button" disabled={busy || !hasGps} onClick={() => active ? setConfirm(true) : void generate()} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang tạo…" : active ? "Tạo mã thay thế" : "Mở QR check-in"}</button>
          {matchingQr && <div className="flex flex-wrap gap-3 text-sm"><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(qr.url); setCopied(true); } catch { setError("Không sao chép được. Hãy mở trang check-in và sao chép địa chỉ."); } }} className="text-cyan-700 underline">{copied ? "Đã sao chép" : "Sao chép liên kết"}</button><a href={qr.url} target="_blank" rel="noreferrer" className="text-cyan-700 underline">Mở trang check-in</a>{image && <a href={image} download={"checkin-" + meeting._id + ".png"} className="text-cyan-700 underline">Tải QR</a>}</div>}
          {active && !matchingQr && !recovering && <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)} className="text-sm font-semibold text-cyan-700 underline">Tải lại mã QR hiện tại</button>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        </div>
      </div>}
    <ConfirmDialog isOpen={confirm} title="Thay mã QR đang hoạt động?" description="Mã đang được trưng bày sẽ mất hiệu lực. Hãy thay bằng QR mới sau khi tạo." confirmLabel="Tạo mã thay thế" tone="warning" isSubmitting={busy} onClose={() => setConfirm(false)} onConfirm={generate} />
  </section>;
}
