import React, { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export function VietnameseMonthPicker({ value, onChange, currentMonth }: {
  value: string;
  onChange: (value: string) => void;
  currentMonth: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const selected = panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (selected || panel.current?.querySelector<HTMLButtonElement>("[data-month]"))?.focus();
    const outside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  };

  return <div ref={container} className="relative" onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation();
      setOpen(false); trigger.current?.focus();
    }
  }}>
    <button ref={trigger} type="button" aria-label="Tháng xem lịch" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
      onClick={() => { setYear(Number(value.slice(0, 4))); setOpen(previous => !previous); }}
      className="flex h-8 items-center gap-3 rounded-lg border border-cyan-200/70 bg-white px-2.5 text-xs font-normal text-slate-700 hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-cyan-500 cursor-pointer">
      <span>Tháng {Number(value.slice(5, 7))}, {value.slice(0, 4)}</span>
      <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-cyan-600" />
    </button>
    {open && <div ref={panel} id={panelId} role="dialog" aria-label="Chọn tháng và năm" className="absolute left-0 top-full z-30 mt-1.5 w-60 max-w-[calc(100vw-6rem)] rounded-xl border border-cyan-100 bg-white p-2.5 shadow-lg">
      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
        <button type="button" aria-label="Năm trước" disabled={year <= 1} onClick={() => setYear(previous => previous - 1)} className="rounded-lg p-1.5 text-cyan-700 hover:bg-cyan-50 disabled:opacity-40 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
        <span aria-live="polite" className="text-xs font-medium text-slate-700">Năm {year}</span>
        <button type="button" aria-label="Năm sau" disabled={year >= 9999} onClick={() => setYear(previous => previous + 1)} className="rounded-lg p-1.5 text-cyan-700 hover:bg-cyan-50 disabled:opacity-40 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, index) => {
          const month = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`;
          const selected = month === value;
          return <button key={index} data-month={index + 1} type="button" aria-pressed={selected} onClick={() => select(month)}
            className={`rounded-lg border py-2 text-xs font-normal focus-visible:outline-2 focus-visible:outline-cyan-500 cursor-pointer ${selected ? "border-cyan-300 bg-cyan-50 text-cyan-700" : "border-transparent text-slate-600 hover:border-cyan-100 hover:bg-cyan-50"}`}>Tháng {index + 1}</button>;
        })}
      </div>
      <button type="button" onClick={() => select(currentMonth)} className="mt-2 w-full border-t border-slate-100 pt-2 text-xs font-normal text-cyan-700 hover:underline cursor-pointer">Tháng hiện tại</button>
    </div>}
  </div>;
}
