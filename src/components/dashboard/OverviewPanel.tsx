/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Users, Clock, UserX, CheckCircle2 } from "lucide-react";
import { DashboardSummary, DashboardActionItems } from "../../types/dashboard";
import { ActionItemsWidget } from "./ActionItemsWidget";
import { DashboardSectionCard } from "./DashboardSectionCard";

export function OverviewPanel({
  summary,
  actionItems,
  canSeeHr,
}: {
  summary: DashboardSummary | null;
  actionItems?: DashboardActionItems | null;
  canSeeHr: boolean;
  [key: string]: any;
}) {
  const goToTab = (tab: string, subTab?: string) => {
    const pathMap: Record<string, string> = {
      "TỔNG QUAN": "/tong-quan",
      "NHÂN SỰ": "/nhan-su",
      "ANALYTICS": "/analytics",
    };
    let path = pathMap[tab];
    if (path) {
      if (subTab) {
        path += `?sub=${subTab}`;
      }
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const SimpleMetric = ({ icon: Icon, title, value, unit, tone = "blue", onClick }: any) => {
    const tones: Record<string, { bg: string; text: string; iconBg: string }> = {
      blue: { bg: "hover:bg-blue-50/50 hover:border-blue-200", text: "text-blue-600", iconBg: "bg-blue-50 text-blue-600" },
      amber: { bg: "hover:bg-amber-50/50 hover:border-amber-200", text: "text-amber-600", iconBg: "bg-amber-50 text-amber-600" },
      emerald: { bg: "hover:bg-emerald-50/50 hover:border-emerald-200", text: "text-emerald-600", iconBg: "bg-emerald-50 text-emerald-600" },
      indigo: { bg: "hover:bg-indigo-50/50 hover:border-indigo-200", text: "text-indigo-600", iconBg: "bg-indigo-50 text-indigo-600" },
      rose: { bg: "hover:bg-rose-50/50 hover:border-rose-200", text: "text-rose-600", iconBg: "bg-rose-50 text-rose-600" },
      slate: { bg: "hover:bg-slate-50 hover:border-slate-300", text: "text-slate-600", iconBg: "bg-slate-100 text-slate-500" },
    };
    const c = tones[tone] || tones.blue;

    return (
      <div
        onClick={onClick}
        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] transition-all duration-200 ${onClick ? "cursor-pointer " + c.bg : ""}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 truncate">{title}</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-xl font-black tracking-tight text-slate-800 truncate" title={value}>
            {value}
          </span>
          {unit && <span className="text-[10px] text-slate-400 font-bold uppercase">{unit}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      {actionItems && (
        <ActionItemsWidget
          actionItems={actionItems}
          onGoToTasks={() => goToTab("NHÂN SỰ", "kanban")}
          onGoToApprovals={() => goToTab("NHÂN SỰ", "lich")}
        />
      )}

      {/* KHỐI NHÂN SỰ & CHẤM CÔNG */}
      {canSeeHr && (
        <DashboardSectionCard
          title="Nhân sự & Chấm công"
          icon={Users}
          gradientFrom="from-emerald-500"
          gradientTo="to-teal-600"
        >
          <SimpleMetric
            icon={CheckCircle2}
            tone="emerald"
            title="Đi làm"
            value={summary ? String(summary.timekeeping?.checkedInToday ?? 0) : "..."}
            unit={`/ ${summary ? (summary.timekeeping?.totalEmployees ?? 0) : "..."} Người`}
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />
          <SimpleMetric
            icon={Clock}
            tone="amber"
            title="Đi muộn"
            value={summary ? String(summary.timekeeping?.lateToday ?? 0) : "..."}
            unit="Người"
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />
          <SimpleMetric
            icon={UserX}
            tone="slate"
            title="Nghỉ phép"
            value={summary?.timekeeping?.onApprovedLeaveToday != null ? String(summary.timekeeping.onApprovedLeaveToday) : "..."}
            unit="Người"
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />
          <SimpleMetric
            icon={UserX}
            tone="rose"
            title="Nghỉ không phép"
            value={summary?.timekeeping?.absentWithoutLeave != null ? String(summary.timekeeping.absentWithoutLeave) : "..."}
            unit="Người"
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />
        </DashboardSectionCard>
      )}
    </div>
  );
}
