import React from "react";
import { MeetingStatisticsPanel } from "../components/dashboard/MeetingStatisticsPanel";

export default function DashboardTab() {
  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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

      <MeetingStatisticsPanel />
    </div>
  );
}
