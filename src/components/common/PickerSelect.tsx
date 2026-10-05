import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface PickerSelectProps {
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
  ariaLabel: string;
  className?: string;
}

/** A single-column picker matching the date and time controls. */
export function PickerSelect({ value, onChange, options, ariaLabel, className = "" }: PickerSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    const selected = listRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (selected && listRef.current) {
      const list = listRef.current;
      list.scrollTop += selected.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - selected.offsetHeight) / 2;
      selected.focus({ preventScroll: true });
    }
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  return <div ref={containerRef} className={`relative inline-block text-xs text-slate-800 ${className}`}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }}>
    <button ref={triggerRef} type="button" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(!open)}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}
      className="w-full flex items-center justify-between text-left cursor-pointer bg-white border border-cyan-200 hover:border-cyan-300 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl font-normal font-sans px-3.5 py-2.5 transition-all">
      <span>{options.find(option => option.value === value)?.label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1.5" />
    </button>
    {open && <div role="dialog" aria-label={ariaLabel} className="absolute left-0 right-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-3.5 select-none animate-fade-in animate-scale-in">
      <div ref={listRef} role="group" aria-label={ariaLabel} className="max-h-[180px] overflow-y-auto space-y-0.5 scrollbar-thin" style={{ scrollbarWidth: "thin" }}
        onKeyDown={event => {
          const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
        }}>
        {options.map(option => <button key={option.value} type="button" aria-pressed={option.value === value}
          onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus(); }}
          className={`w-full px-3 py-1.5 text-center text-xs font-normal tabular-nums rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 ${option.value === value ? "border border-cyan-200 bg-cyan-100 text-cyan-800" : "text-slate-650 hover:bg-cyan-50 active:scale-95"}`}>
          {option.label}
        </button>)}
      </div>
    </div>}
  </div>;
}
