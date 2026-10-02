import { CalendarDays, Clock3, MapPin, CheckCircle2, QrCode, X, Loader2 } from "lucide-react";
import { locate } from "./locateForCheckIn";
import React, { useEffect, useRef, useState } from "react";

type Attendee = { id: string; userId?: string; checkedInAt?: string; seconds: number };
type MemberMeeting = {
  allowDirectCheckIn?: boolean;
  coverImage?: string;
  gpsRadiusMeters?: number;
  title: string; description?: string; location?: string; startsAt: string;
  status: "scheduled" | "live" | "paused" | "ended" | "cancelled";
  speakers: Attendee[]; currentIndex: number; speechesCompletedAt?: string;
};

export function memberAttendance(meeting: MemberMeeting, userId?: string) {
  return userId ? meeting.speakers.find(person => person.userId === userId) : undefined;
}

export function memberAttendanceLabel(meeting: MemberMeeting, userId?: string) {
  if (memberAttendance(meeting, userId)) return "Đã check-in";
  if (meeting.status === "cancelled") return "Buổi họp đã hủy";
  if (meeting.status === "ended") return "Không có ghi nhận tham dự";
  return "Chưa check-in";
}

const dateText = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const statusLabels = { scheduled: "Sắp diễn ra", live: "Đang diễn ra", paused: "Tạm dừng", ended: "Đã kết thúc", cancelled: "Đã hủy" };

export default function MemberMeetingDetail({ meeting, userId, onClose, onCheckIn }: {
  meeting: MemberMeeting; userId?: string; onClose: () => void; onCheckIn: (location: { latitude: number; longitude: number }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const checkIn = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { const location = await locate(); await onCheckIn(location); } catch (error: any) { setError(error.message || "Không thể điểm danh. Vui lòng thử lại."); }
    finally { pending.current = false; setBusy(false); }
  };
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);
  const attendee = memberAttendance(meeting, userId);
  const position = attendee ? meeting.speakers.indexOf(attendee) + 1 : 0;
  const open = ["scheduled", "live", "paused"].includes(meeting.status);
  const current = attendee && meeting.speakers[meeting.currentIndex]?.id === attendee.id
    && ["live", "paused"].includes(meeting.status) && !meeting.speechesCompletedAt;
  const directCheckInOpen = ["live", "paused"].includes(meeting.status) || meeting.allowDirectCheckIn === true;
  const canCheckIn = !attendee && open && directCheckInOpen && !!userId;
  const checkInHint = attendee ? "Bạn đã điểm danh cuộc họp này." : !open ? "Cuộc họp đã đóng điểm danh." : !userId ? "Vui lòng đăng nhập bằng tài khoản thành viên." : !directCheckInOpen ? "Điểm danh trực tiếp sẽ tự mở khi cuộc họp bắt đầu. Bạn vẫn có thể quét mã QR do ban tổ chức cung cấp để điểm danh trước." : "Điểm danh bằng tài khoản thành viên của bạn.";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="member-meeting-title"
        onKeyDown={event => {
          if (event.key === "Escape") { event.stopPropagation(); onClose(); }
          if (event.key === "Tab") {
            const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
            const first = buttons[0]; const last = buttons[buttons.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl outline-none sm:max-h-[90dvh]">
        <div className="min-h-0 overflow-y-auto">
          <header className="relative isolate overflow-hidden bg-cyan-950 px-5 pb-6 pt-7 text-white sm:px-7">
            {meeting.coverImage && <img src={meeting.coverImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cyan-950/95 via-cyan-900/85 to-teal-800/80" />
            <button type="button" onClick={onClose} aria-label="Đóng chi tiết cuộc họp"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">
              <X className="h-5 w-5" />
            </button>
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-200"><CalendarDays className="h-4 w-4" />Chi tiết cuộc họp</p>
            <h2 id="member-meeting-title" className="max-w-full break-words pr-8 text-xl font-bold leading-snug sm:text-2xl">{meeting.title}</h2>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${meeting.status === "live" ? "bg-emerald-300" : meeting.status === "cancelled" ? "bg-rose-300" : "bg-cyan-200"}`} />
              {statusLabels[meeting.status]}
            </span>
          </header>
          <div className="space-y-5 p-4 sm:p-6">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
                <div><dt className="text-xs font-medium text-slate-500">Thời gian (giờ Việt Nam)</dt><dd className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-900">{dateText(meeting.startsAt)}</dd></div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
                <div className="min-w-0"><dt className="text-xs font-medium text-slate-500">Địa điểm</dt><dd className="mt-1.5 break-words text-sm font-semibold leading-relaxed text-slate-900">{meeting.location || "Chưa cập nhật địa điểm"}</dd></div>
              </div>
            </dl>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Thông tin tham dự của bạn">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                <h3 className="text-sm font-bold text-slate-900">Thông tin tham dự của bạn</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${attendee ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {attendee && <CheckCircle2 className="h-3.5 w-3.5" />}{memberAttendanceLabel(meeting, userId)}
                </span>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                {attendee ? (
                  <>
                    {attendee.checkedInAt && <p className="text-sm text-slate-600">Thời gian check-in: <span className="font-medium text-slate-900">{dateText(attendee.checkedInAt)}</span></p>}
                    <dl className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs leading-relaxed text-slate-500">Thứ tự trong danh sách phát biểu</dt><dd className="mt-2 text-xl font-bold text-slate-900">{position}</dd></div>
                      <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs leading-relaxed text-slate-500">Thời lượng phát biểu</dt><dd className="mt-2 text-xl font-bold text-slate-900">{attendee.seconds} giây</dd></div>
                    </dl>
                    {current && <p role="status" className="rounded-xl bg-cyan-50 p-3 text-sm font-semibold text-cyan-800">{meeting.status === "paused" ? "Đến lượt của bạn · Buổi họp đang tạm dừng" : "Đang đến lượt phát biểu của bạn"}</p>}
                  </>
                ) : open ? (
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700">{canCheckIn ? <MapPin className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}</div>
                    <div className="min-w-0 space-y-2">
                      <p className="text-sm font-semibold text-slate-900">{canCheckIn ? "Điểm danh tại địa điểm họp" : "Điểm danh bằng mã QR"}</p>
                      <p className="text-sm leading-relaxed text-slate-500">{canCheckIn ? "Bấm Điểm danh và cho phép truy cập vị trí. Hệ thống kiểm tra GPS trong phạm vi địa điểm họp và ghi nhận cho tài khoản của bạn." : "Để check-in, hãy quét mã QR do ban tổ chức cung cấp tại địa điểm họp và xác nhận vị trí."}</p>
                      {canCheckIn && <p className="text-xs font-medium text-cyan-700">Phạm vi điểm danh: {meeting.gpsRadiusMeters || 200} m quanh địa điểm họp</p>}
                    </div>
                  </div>
                ) : null}
                {!open && <p className="text-sm text-slate-500">Buổi họp đã đóng check-in.</p>}
              </div>
            </section>
            {meeting.description && <section className="px-1"><h3 className="mb-2 text-sm font-bold text-slate-900">Nội dung cuộc họp</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{meeting.description}</p></section>}
          </div>
        </div>
          <footer className="shrink-0 space-y-3 border-t border-slate-200 bg-white p-4 sm:px-6">
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p id="member-checkin-hint" className="text-xs leading-relaxed text-slate-500">{checkInHint}</p>
              <button type="button" disabled={busy || !canCheckIn} aria-describedby="member-checkin-hint" onClick={() => void checkIn()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {busy ? "Đang xác nhận vị trí..." : attendee ? "Đã điểm danh" : "Điểm danh"}
              </button>
            </div>
          </footer>
      </section>
    </div>
  );
}
