import React from "react";
import { Check, Gift, Megaphone, MessageSquareText, Star, Users } from "lucide-react";

export type MeetingFlowStep = "checkin" | "presentation" | "interaction" | "luckyDraw" | "activeMembers";

export const DEFAULT_MEETING_FLOW: MeetingFlowStep[] = ["checkin", "presentation", "interaction", "luckyDraw", "activeMembers"];

export const MEETING_FLOW_META: Record<MeetingFlowStep, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  checkin: { label: "Check-in", icon: Users },
  presentation: { label: "Thuyết trình", icon: Megaphone },
  interaction: { label: "Tương tác", icon: MessageSquareText },
  luckyDraw: { label: "Quay thưởng", icon: Gift },
  activeMembers: { label: "Thành viên tích cực", icon: Star },
};

type Props = {
  current: MeetingFlowStep;
  badges?: Partial<Record<MeetingFlowStep, number | undefined>>;
  onSelect: (section: MeetingFlowStep) => void;
  onFinish?: () => void;
};

export function MeetingFlowStepper({ current, badges, onSelect, onFinish }: Props) {
  return (
    <nav className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-6" aria-label="Nội dung cuộc họp">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-medium text-slate-500">Chọn nội dung muốn xem</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0" role="tablist" aria-label="Nội dung chi tiết cuộc họp">
            {DEFAULT_MEETING_FLOW.map(section => {
              const meta = MEETING_FLOW_META[section];
              const Icon = meta.icon;
              const active = section === current;
              const badge = badges?.[section];
              return (
                <button
                  key={section}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={meta.label}
                  title={`Mở ${meta.label}`}
                  onClick={() => onSelect(section)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200 cursor-pointer
                    ${active
                      ? "border-cyan-500 bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{meta.label}</span>
                  {badge ? (
                    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[11px] font-normal leading-none tabular-nums ${active ? "border-white/30 bg-white/20 text-white" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {onFinish && (
          <button type="button" onClick={onFinish} className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 cursor-pointer">
            <Check className="h-3.5 w-3.5" /> Kết thúc cuộc họp
          </button>
        )}
      </div>
    </nav>
  );
}
