import { useEffect, useMemo, useState } from "react";
import { MeetingStatisticsPanel } from "../components/dashboard/MeetingStatisticsPanel";
import { ActiveMembersPanel } from "../components/meetings/ActiveMembersPanel";
import { meetingService, type Meeting } from "../services/meetingService";
import { socketService } from "../services/socketService";

export default function DashboardTab() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [rankingTime, setRankingTime] = useState(Date.now);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    let active = true;
    const refreshMeetings = async () => {
      setIsLoadingMeetings(true);
      setMeetingsError(null);
      try {
        const data = await meetingService.listMeetings({ all: true });
        if (active) {
          setMeetings(data);
          setRankingTime(Date.now());
        }
      } catch (error) {
        if (active) setMeetingsError(error instanceof Error ? error.message : "Không thể tải dữ liệu cuộc họp.");
      } finally {
        if (active) setIsLoadingMeetings(false);
      }
    };

    void refreshMeetings();
    const offMeeting = socketService.on("meeting_updated", () => { void refreshMeetings(); });
    window.addEventListener("focus", refreshMeetings);
    return () => {
      active = false;
      offMeeting();
      window.removeEventListener("focus", refreshMeetings);
    };
  }, []);

  const rankingMeeting = useMemo(() => meetings
    .filter(meeting =>
      ["live", "paused", "ended"].includes(meeting.status) &&
      new Date(meeting.startsAt).getTime() <= rankingTime
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .at(-1), [meetings, rankingTime]);

  return (
    <div className="mx-auto max-h-[85vh] max-w-7xl overflow-y-auto px-0.5 pb-4 text-left sm:pr-2" id="dashboard_tab_view">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-1.5 bg-red-600 rounded-full shrink-0" />
          <div>
            <h1 className="font-extrabold text-xl md:text-2xl tracking-tight text-slate-900">
              Tổng quan
            </h1>
            <p className="text-xs text-slate-500 font-medium">Hôm nay, {todayLabel}</p>
          </div>
        </div>
      </div>

      <MeetingStatisticsPanel
        beforeDetails={
          <section aria-label="Bảng xếp hạng thành viên tích cực">
            {meetingsError ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {meetingsError}
              </div>
            ) : isLoadingMeetings ? (
              <p role="status" className="py-8 text-center text-xs text-slate-500">Đang tải bảng xếp hạng…</p>
            ) : rankingMeeting ? (
              <ActiveMembersPanel meeting={rankingMeeting} meetings={meetings} />
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center text-xs text-slate-400 shadow-2xs">
                Chưa có cuộc họp đã diễn ra để xếp hạng thành viên.
              </div>
            )}
          </section>
        }
      />
    </div>
  );
}
