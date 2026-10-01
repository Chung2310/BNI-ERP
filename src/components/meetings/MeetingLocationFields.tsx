import { useState } from "react";
type Point = { latitude: number; longitude: number };
export function MeetingLocationFields({ value, onChange, radius, onRadiusChange }: {
  value: Point | null; onChange: (point: Point | null) => void; radius: number; onRadiusChange: (radius: number) => void;
}) {
  const [draft, setDraft] = useState({ latitude: value?.latitude.toString() ?? "", longitude: value?.longitude.toString() ?? "" });
  const updatePoint = (field: "latitude" | "longitude", text: string) => {
    const next = { ...draft, [field]: text }; setDraft(next);
    onChange(next.latitude !== "" && next.longitude !== "" ? { latitude: +next.latitude, longitude: +next.longitude } : null);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locate = () => {
    setError("");
    if (!navigator.geolocation) { setError("Trình duyệt không hỗ trợ lấy vị trí."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(p => {
      setDraft({ latitude: p.coords.latitude.toString(), longitude: p.coords.longitude.toString() });
      onChange({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setBusy(false);
    }, () => { setError("Không lấy được vị trí. Hãy cấp quyền vị trí hoặc nhập tọa độ địa điểm bên dưới."); setBusy(false); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  return <fieldset className="space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/50 p-4">
    <legend className="px-1 font-bold text-slate-800">Vị trí check-in</legend>
    <p className="text-xs leading-relaxed text-slate-600">Có thể lên lịch trước và bổ sung GPS sau. Phải lưu đúng tọa độ địa điểm trước khi mở QR. Chỉ dùng vị trí hiện tại khi bạn đang ở nơi tổ chức. Đổi tọa độ hoặc bán kính sẽ đóng QR cũ; cần mở lại QR sau khi lưu.</p>
    <button type="button" disabled={busy} onClick={locate} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Đang lấy vị trí…" : "Lấy vị trí hiện tại"}</button>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs">Vĩ độ<input type="number" step="any" min="-90" max="90" value={draft.latitude} required={draft.longitude !== ""} onChange={e => updatePoint("latitude", e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2" /></label>
      <label className="text-xs">Kinh độ<input type="number" step="any" min="-180" max="180" value={draft.longitude} required={draft.latitude !== ""} onChange={e => updatePoint("longitude", e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2" /></label>
    </div>
    <label className="block text-xs">Bán kính cho phép (m)<input required type="number" min="50" max="5000" value={radius} onChange={e => onRadiusChange(+e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2" /></label>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </fieldset>;
}
