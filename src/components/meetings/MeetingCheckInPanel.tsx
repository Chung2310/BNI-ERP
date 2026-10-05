import { CompanyCheckInQrPanel, type CheckInQrApi } from "./CompanyCheckInQrPanel";

type Meeting = { title: string; status: string; latitude?: number; longitude?: number; gpsRadiusMeters?: number; speakers: { userId?: string }[] };
export function MeetingCheckInPanel({ meeting, canManage, api, companyCode, onConfigure }: {
  meeting: Meeting; canManage: boolean; api: CheckInQrApi; companyCode?: string;
  onConfigure: () => void;
}) {
  const open = ["scheduled", "live", "paused"].includes(meeting.status);
  const hasGps = typeof meeting.latitude === "number" && typeof meeting.longitude === "number";
  const members = meeting.speakers.filter(person => person.userId).length;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-xl font-bold text-slate-900">Đón tiếp & check-in</h3><p className="mt-1 text-sm text-slate-500">{members} thành viên · {meeting.speakers.length - members} khách mời · thứ tự phát biểu theo check-in</p></div>
    </div>
    {!open && <p className="rounded-xl bg-slate-100 p-4 text-sm">Buổi họp đã đóng check-in. QR cố định vẫn dùng cho những cuộc họp tiếp theo của đơn vị.</p>}
    {canManage ? <>
      <CompanyCheckInQrPanel api={api} companyCode={companyCode} />
      <p className="text-sm text-slate-600">{hasGps ? "Cuộc họp này kiểm tra vị trí trong bán kính " + (meeting.gpsRadiusMeters || 200) + " m." : "Cần bổ sung GPS địa điểm để cuộc họp này nhận check-in."} <button type="button" onClick={onConfigure} className="font-semibold text-cyan-700 hover:text-cyan-900">Cấu hình địa điểm & thời gian</button></p>
    </> : open && <p className="rounded-xl bg-cyan-50 p-4 text-sm">Quét QR check-in cố định của đơn vị, chọn Thành viên hoặc Khách mời và cho phép xác nhận vị trí.</p>}
  </section>;
}
