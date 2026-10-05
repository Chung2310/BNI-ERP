import React, { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Gift, GripVertical, Megaphone, RotateCcw, Star, Users } from "lucide-react";

export type MeetingFlowStep = "checkin" | "presentation" | "luckyDraw" | "activeMembers";

export const DEFAULT_MEETING_FLOW: MeetingFlowStep[] = ["checkin", "presentation", "luckyDraw", "activeMembers"];

const FLOW_STORAGE_KEY = "bni_meeting_flow_order";

export const MEETING_FLOW_META: Record<MeetingFlowStep, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  checkin: { label: "Check-in", icon: Users },
  presentation: { label: "Thuyết trình", icon: Megaphone },
  luckyDraw: { label: "Quay thưởng", icon: Gift },
  activeMembers: { label: "Thành viên tích cực", icon: Star },
};

/** Đọc thứ tự quy trình đã lưu; bỏ bước lạ và bổ sung bước còn thiếu để luôn đủ 4 bước. */
export function loadMeetingFlowOrder(): MeetingFlowStep[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FLOW_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [...DEFAULT_MEETING_FLOW];
    const valid = saved.filter((s): s is MeetingFlowStep => DEFAULT_MEETING_FLOW.includes(s));
    const unique = Array.from(new Set(valid));
    return [...unique, ...DEFAULT_MEETING_FLOW.filter(s => !unique.includes(s))];
  } catch {
    return [...DEFAULT_MEETING_FLOW];
  }
}

export function saveMeetingFlowOrder(order: MeetingFlowStep[]) {
  localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(order));
}

type Props = {
  order: MeetingFlowStep[];
  current: MeetingFlowStep;
  canReorder: boolean;
  badges?: Partial<Record<MeetingFlowStep, number | undefined>>;
  onSelect: (step: MeetingFlowStep) => void;
  onReorder: (order: MeetingFlowStep[]) => void;
  onFinish?: () => void;
};

export function MeetingFlowStepper({ order, current, canReorder, badges, onSelect, onReorder, onFinish }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const currentIndex = Math.max(0, order.indexOf(current));
  const isLast = currentIndex === order.length - 1;
  const isDefaultOrder = order.every((s, i) => s === DEFAULT_MEETING_FLOW[i]);

  const drop = (target: number) => {
    if (dragIndex === null || dragIndex === target) return;
    const next = [...order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    onReorder(next);
  };

  return (
    <div className="sticky top-0 z-10 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 border-b border-slate-200/80 bg-white/95 px-4 py-3 sm:px-6 backdrop-blur" aria-label="Quy trình điều hành cuộc họp">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ol className="flex flex-1 items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          {order.map((step, index) => {
            const meta = MEETING_FLOW_META[step];
            const Icon = meta.icon;
            const active = step === current;
            const done = index < currentIndex;
            const badge = badges?.[step];
            return (
              <li key={step} className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  draggable={canReorder}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Bước ${index + 1}: ${meta.label}`}
                  title={canReorder ? "Bấm để mở bước · Kéo thả để sắp xếp quy trình" : meta.label}
                  onClick={() => onSelect(step)}
                  onDragStart={e => { setDragIndex(index); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", step); }}
                  onDragOver={e => { if (dragIndex === null) return; e.preventDefault(); setOverIndex(index); }}
                  onDragLeave={() => setOverIndex(i => (i === index ? null : i))}
                  onDrop={e => { e.preventDefault(); drop(index); setDragIndex(null); setOverIndex(null); }}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200 cursor-pointer select-none
                    ${active ? "border-cyan-500 bg-cyan-600 text-white shadow-md shadow-cyan-600/20" : done ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700"}
                    ${dragIndex === index ? "opacity-40 scale-95" : ""}
                    ${overIndex === index && dragIndex !== index ? "ring-2 ring-cyan-400 ring-offset-1" : ""}`}
                >
                  {canReorder && <GripVertical className={`h-3.5 w-3.5 cursor-grab ${active ? "text-cyan-100" : "text-slate-300 group-hover:text-slate-400"}`} />}
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${active ? "bg-white text-cyan-700" : done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {done ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{meta.label}</span>
                  {badge ? <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-white/25" : "bg-amber-400 text-slate-900"}`}>{badge}</span> : null}
                </button>
                {index < order.length - 1 && (
                  <ChevronRight aria-hidden className={`h-4 w-4 shrink-0 ${index < currentIndex ? "text-emerald-500" : "text-slate-300"}`} />
                )}
              </li>
            );
          })}
          {canReorder && !isDefaultOrder && (
            <li className="shrink-0 pl-1">
              <button type="button" title="Khôi phục thứ tự mặc định" aria-label="Khôi phục thứ tự mặc định" onClick={() => onReorder([...DEFAULT_MEETING_FLOW])} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </li>
          )}
        </ol>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => onSelect(order[currentIndex - 1])}
            className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Quay lại
          </button>
          {isLast ? (
            onFinish && (
              <button type="button" onClick={onFinish} className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 cursor-pointer">
                <Check className="h-3.5 w-3.5" /> Hoàn tất quy trình
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => onSelect(order[currentIndex + 1])}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-cyan-600/20 hover:bg-cyan-700 cursor-pointer"
            >
              Tiếp tục: {MEETING_FLOW_META[order[currentIndex + 1]].label} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
