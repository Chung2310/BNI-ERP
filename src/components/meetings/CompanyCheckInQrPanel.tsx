import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Maximize2 } from "lucide-react";
import { CheckInQrFullscreen } from "./CheckInQrFullscreen";

type Qr = { url: string; image: string };
export type CheckInQrApi = (path: string, method?: string, body?: unknown) => Promise<{ checkInUrl?: string } | null>;

export function CompanyCheckInQrPanel({ api, companyCode }: { api: CheckInQrApi; companyCode?: string }) {
  return <CompanyQrContent key={companyCode || ""} api={api} />;
}

function CompanyQrContent({ api }: { api: CheckInQrApi }) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fullscreenRequest, setFullscreenRequest] = useState<Promise<boolean> | null>(null);
  const closeFullscreen = useCallback(() => setFullscreenRequest(null), []);
  const openFullscreen = () => {
    const request = !document.fullscreenElement && document.documentElement.requestFullscreen
      ? document.documentElement.requestFullscreen().then(() => true).catch(() => false)
      : Promise.resolve(false);
    setFullscreenRequest(request);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await api("/checkin-qr");
        if (!result?.checkInUrl) throw new Error("Không tải được mã QR. Vui lòng thử lại.");
        const url = new URL(result.checkInUrl, window.location.origin).href;
        if (!active) return;
        setQr({ url, image: "" });
        try {
          const image = await QRCode.toDataURL(url, { width: 1200, margin: 2 });
          if (active) setQr({ url, image });
        } catch {
          if (active) setError("Không hiển thị được QR. Hãy dùng liên kết check-in hoặc tải lại.");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Không tải được mã QR. Vui lòng thử lại.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [api, retry]);

  const currentQr = qr;
  return <section aria-label="QR check-in cố định" className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-[minmax(220px,300px)_1fr]">
    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-4">
      {currentQr?.image ? <>
        <button type="button" onClick={openFullscreen} aria-label="Phóng to mã QR toàn màn hình" aria-haspopup="dialog"
          className="group flex w-full max-w-[280px] cursor-zoom-in flex-col items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-600">
          <img src={currentQr.image} alt="QR check-in dùng chung" className="w-full" />
          <span className="mt-2 flex items-center gap-1 rounded-lg border border-cyan-100 bg-white px-2 py-1 text-xs text-cyan-700 shadow-sm group-hover:bg-cyan-50">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />Phóng to
          </span>
        </button>
        {fullscreenRequest && <CheckInQrFullscreen image={currentQr.image} fullscreenRequest={fullscreenRequest} onClose={closeFullscreen} />}
        <p className="mt-2 text-center text-sm font-normal">Sử dụng Zalo để quét mã</p>
      </> : <p role={loading ? "status" : undefined} className="py-10 text-center text-sm text-slate-500">{loading ? "Đang tải QR check-in cố định…" : "Chưa hiển thị được mã QR."}</p>}
    </div>
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-slate-900">Check-in cuộc họp</h3>
        <p className="mt-2 text-sm text-slate-600">Lưu hoặc in mã này để dùng cho mọi cuộc họp.</p>
      </div>
      <p className="text-sm text-slate-500">Khi đến buổi họp, quét mã và cho phép truy cập vị trí để check-in.</p>
      {currentQr && <div className="flex flex-wrap gap-3 text-sm font-semibold text-cyan-700">
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(currentQr.url); setCopied(true); }
          catch { setError("Không sao chép được. Hãy mở trang check-in và sao chép địa chỉ."); }
        }} className="hover:text-cyan-900">{copied ? "Đã sao chép" : "Sao chép liên kết"}</button>
        <a href={currentQr.url} target="_blank" rel="noreferrer" className="hover:text-cyan-900">Mở trang check-in</a>
        {currentQr.image && <a href={currentQr.image} download="checkin-qr-co-dinh.png" className="hover:text-cyan-900">Tải QR</a>}
      </div>}
      {error && <div className="space-y-2">
        <p role="alert" className="text-sm text-rose-700">{error}</p>
        <button type="button" disabled={loading} onClick={() => { setQr(null); setLoading(true); setCopied(false); setError(""); setRetry(value => value + 1); }} className="text-sm font-semibold text-cyan-700">Tải lại mã QR hiện tại</button>
      </div>}
    </div>
  </section>;
}
