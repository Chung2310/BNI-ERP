import React, { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

type DateParts = { day: number; month: number; year: number };
const pad = (value: number) => String(value).padStart(2, "0");
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const today = (): DateParts => {
  const now = new Date();
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
};
function parse(value: string): DateParts {
  const [year, month, day] = value.split("-").map(Number);
  return year >= 100 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
    ? { year, month, day } : today();
}

export function DateInputScroll({ value, onChange, ariaLabel = "Chọn ngày", placeholder = "Chọn ngày...", className = "" }: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parse(value));
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const commit = (date: DateParts) => { onChange(`${date.year}-${pad(date.month)}-${pad(date.day)}`); close(); };
  const select = (part: keyof DateParts, value: number) => setDraft(previous => {
    const next = { ...previous, [part]: value };
    return { ...next, day: Math.min(next.day, daysInMonth(next.year, next.month)) };
  });

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    container.current?.querySelectorAll<HTMLElement>('[role="group"]').forEach(column => {
      const selected = column.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (selected) column.scrollTop += selected.getBoundingClientRect().top - column.getBoundingClientRect().top - (column.clientHeight - selected.clientHeight) / 2;
    });
  }, [open, draft.month, draft.year]);

  const startYear = Math.min(1940, draft.year);
  const endYear = Math.max(new Date().getFullYear() + 10, draft.year);
  const columns: { key: keyof DateParts; label: string; values: number[] }[] = [
    { key: "day", label: "Ngày", values: Array.from({ length: daysInMonth(draft.year, draft.month) }, (_, i) => i + 1) },
    { key: "month", label: "Tháng", values: Array.from({ length: 12 }, (_, i) => i + 1) },
    { key: "year", label: "Năm", values: Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i) },
  ];

  return <div ref={container} className={`relative text-xs text-slate-800 ${className}`} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.stopPropagation(); close(); }
  }}>
    <button ref={trigger} type="button" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { if (!open) setDraft(parse(value)); setOpen(!open); }}
      className="flex w-full items-center justify-between rounded-xl border border-cyan-200 bg-white px-3.5 py-2.5 text-left font-normal transition-all hover:border-cyan-300 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 cursor-pointer">
      <span className={value ? "tabular-nums" : "text-slate-400"}>{value ? value.split("-").reverse().join("/") : placeholder}</span>
      <CalendarDays className="ml-1.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
    </button>
    {open && <div role="dialog" aria-label="Chọn ngày" className="absolute left-0 z-50 mt-1.5 w-[260px] max-w-[calc(100vw-5rem)] rounded-2xl border border-gray-200 bg-white p-3.5 shadow-xl">
      <div className="mb-2 grid grid-cols-3 text-center text-xs font-normal text-slate-500">{columns.map(column => <span key={column.key}>{column.label}</span>)}</div>
      <div className="-mx-3.5 mb-2.5 h-px bg-gray-100" />
      <div className="grid h-[180px] grid-cols-3 divide-x divide-gray-100">
        {columns.map(column => <div key={column.key} role="group" aria-label={column.label} className="space-y-0.5 overflow-y-auto px-1" style={{ scrollbarWidth: "thin" }}>
          {column.values.map(number => <button key={number} type="button" aria-pressed={draft[column.key] === number} onClick={() => select(column.key, number)}
            className="w-full rounded-lg py-1.5 text-center text-xs font-normal tabular-nums text-slate-600 transition-all hover:bg-cyan-50 aria-pressed:border aria-pressed:border-cyan-200 aria-pressed:bg-cyan-100 aria-pressed:text-cyan-800 cursor-pointer">
            {column.key === "year" ? number : pad(number)}
          </button>)}
        </div>)}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 font-normal">
        <button type="button" onClick={() => commit(today())} className="text-cyan-700 hover:underline cursor-pointer">Hôm nay</button>
        <button type="button" onClick={() => commit(draft)} className="rounded-lg border border-cyan-200 bg-cyan-100 px-3 py-1.5 text-cyan-800 hover:bg-cyan-200 cursor-pointer">Xong</button>
      </div>
    </div>}
  </div>;
}
