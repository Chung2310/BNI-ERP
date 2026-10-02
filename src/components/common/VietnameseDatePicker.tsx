import React, { useState, useEffect, useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

export interface VietnameseDatePickerProps {
  value: string; // Format: "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
  align?: "left" | "right" | "auto";
}

const pad2 = (n: number) => n.toString().padStart(2, "0");

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_NAMES = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

const CURRENT_YEAR = new Date().getFullYear();
// Support from 1940 to CURRENT_YEAR + 10 (covering birthdays, meetings, and future events)
const YEARS = Array.from({ length: CURRENT_YEAR - 1940 + 11 }, (_, i) => 1940 + i);

export function VietnameseDatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày...",
  className = "",
  buttonClassName = "",
  ariaLabel = "Chọn ngày",
  disabled = false,
  align = "auto",
}: VietnameseDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse "YYYY-MM-DD" safely
  const parseDate = (val: string) => {
    if (!val) return null;
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed
    const day = parseInt(match[3], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return { year, month, day };
  };

  const parsed = parseDate(value);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  // Active viewing calendar month and year
  const [viewYear, setViewYear] = useState(parsed ? parsed.year : todayY);
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.month : todayM);

  // Sync viewing month/year when value changes from outside
  useEffect(() => {
    if (value) {
      const p = parseDate(value);
      if (p) {
        setViewYear(p.year);
        setViewMonth(p.month);
      }
    }
  }, [value]);

  // Check whether to open popup upwards or downwards based on viewport space
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < 320 && spaceAbove > 320);
    }
  }, [isOpen]);

  // Click outside and Esc key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formatted = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleToday = () => {
    const formatted = `${todayY}-${pad2(todayM + 1)}-${pad2(todayD)}`;
    setViewYear(todayY);
    setViewMonth(todayM);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  // Build calendar matrix (Monday as first day of week)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 0 = Monday, 6 = Sunday

  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  const calendarCells: Array<{ day: number; isCurrentMonth: boolean }> = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({ day: i, isCurrentMonth: true });
  }
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({ day: i, isCurrentMonth: false });
  }

  // Display text formatted as "DD/MM/YYYY"
  const displayText = parsed ? `${pad2(parsed.day)}/${pad2(parsed.month + 1)}/${parsed.year}` : "";

  // Alignment classes for dropdown popup
  const alignClass =
    align === "right"
      ? "right-0"
      : align === "left"
      ? "left-0"
      : "right-0 sm:right-auto sm:left-0";

  return (
    <div ref={containerRef} className={`relative text-left ${className}`}>
      {/* Input button triggering calendar */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`group flex items-center justify-between gap-1.5 transition cursor-pointer select-none ${
          buttonClassName ||
          "rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 px-2.5 text-xs text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-red-500 focus:outline-hidden"
        } ${isOpen ? "bg-white border-blue-500 ring-2 ring-blue-500/20" : ""} ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
          <span
            className={`truncate ${
              displayText ? "font-medium text-slate-800" : "text-slate-400 font-normal"
            }`}
          >
            {displayText || placeholder}
          </span>
        </div>

        {displayText && !disabled && (
          <button
            type="button"
            aria-label="Xóa ngày đã chọn"
            title="Xóa ngày đã chọn"
            onClick={handleClear}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Popover Calendar Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Lịch chọn ngày"
          className={`absolute ${alignClass} ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } z-50 w-[280px] rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xl shadow-slate-900/15 animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Calendar Header with Vietnamese Month and Year */}
          <div className="flex items-center justify-between gap-1 pb-2.5 border-b border-slate-100">
            <button
              type="button"
              aria-label="Tháng trước"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Select Month & Year */}
            <div className="flex items-center gap-1">
              <select
                aria-label="Chọn tháng"
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="appearance-none bg-slate-50 border border-slate-200 py-1 px-1.5 text-xs font-bold text-slate-800 hover:bg-white rounded-lg cursor-pointer focus:outline-hidden"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Chọn năm"
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="appearance-none bg-slate-50 border border-slate-200 py-1 px-1.5 text-xs font-bold text-slate-800 hover:bg-white rounded-lg cursor-pointer focus:outline-hidden max-h-48"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              aria-label="Tháng sau"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Labels (T2 -> CN) */}
          <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center">
            {WEEKDAYS.map((wd, i) => (
              <span
                key={wd}
                className={`text-[10px] font-semibold ${
                  i >= 5 ? "text-amber-600" : "text-slate-400"
                }`}
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <span
                    key={idx}
                    className="flex h-8 items-center justify-center text-[11px] text-slate-300 font-normal select-none"
                  >
                    {cell.day}
                  </span>
                );
              }

              const isSelected =
                parsed &&
                parsed.year === viewYear &&
                parsed.month === viewMonth &&
                parsed.day === cell.day;

              const isToday =
                todayY === viewYear && todayM === viewMonth && todayD === cell.day;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(cell.day)}
                  className={`flex h-8 items-center justify-center rounded-lg text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-xs hover:bg-blue-700"
                      : isToday
                      ? "border border-blue-500 font-bold text-blue-600 hover:bg-blue-50"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer Actions: Hôm nay, Xóa lọc, Đóng */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
            >
              Hôm nay
            </button>
            <div className="flex items-center gap-2">
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-slate-500 hover:text-slate-700 transition cursor-pointer"
                >
                  Xóa
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer px-2 py-0.5 rounded hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
