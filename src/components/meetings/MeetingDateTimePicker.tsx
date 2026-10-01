import React, { useState, useEffect, useRef } from "react";
import { CalendarDays, Clock, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface MeetingDateTimePickerProps {
  value: string; // ISO string hoặc "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
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

const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => pad2(i * 5));

export function MeetingDateTimePicker({
  value,
  onChange,
  required,
  disabled,
  className = "",
  placeholder = "Chọn ngày & giờ...",
}: MeetingDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value with regex first to preserve exact local date-time without timezone offset shifts
  const parseValue = (val: string) => {
    if (!val) return null;
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10) - 1,
        day: parseInt(match[3], 10),
        hour: match[4],
        minute: match[5],
      };
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      hour: pad2(d.getHours()),
      minute: pad2(d.getMinutes()),
    };
  };

  const parsed = parseValue(value);

  // Active viewing month/year in calendar
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed ? parsed.year : now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.month : now.getMonth());

  // Selected date parts
  const [selectedYear, setSelectedYear] = useState(parsed ? parsed.year : now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(parsed ? parsed.month : now.getMonth());
  const [selectedDay, setSelectedDay] = useState(parsed ? parsed.day : now.getDate());
  const [selectedHour, setSelectedHour] = useState(parsed ? parsed.hour : "07");
  const [selectedMinute, setSelectedMinute] = useState(parsed ? parsed.minute : "00");

  // Keep internal state synced when value prop updates
  useEffect(() => {
    if (value) {
      const p = parseValue(value);
      if (p) {
        setSelectedYear(p.year);
        setSelectedMonth(p.month);
        setSelectedDay(p.day);
        setSelectedHour(p.hour);
        setSelectedMinute(p.minute);
        setViewYear(p.year);
        setViewMonth(p.month);
      }
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const emitChange = (y: number, m: number, d: number, h: string, min: string) => {
    const formatted = `${y}-${pad2(m + 1)}-${pad2(d)}T${h}:${min}`;
    onChange(formatted);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    setSelectedYear(viewYear);
    setSelectedMonth(viewMonth);
    setSelectedDay(day);
    emitChange(viewYear, viewMonth, day, selectedHour, selectedMinute);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newH = e.target.value;
    setSelectedHour(newH);
    emitChange(selectedYear, selectedMonth, selectedDay, newH, selectedMinute);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newM = e.target.value;
    setSelectedMinute(newM);
    emitChange(selectedYear, selectedMonth, selectedDay, selectedHour, newM);
  };

  const handleQuickPreset = (h: string, m: string) => {
    setSelectedHour(h);
    setSelectedMinute(m);
    emitChange(selectedYear, selectedMonth, selectedDay, h, m);
  };

  const handleToday = () => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
    setSelectedDay(today.getDate());
    emitChange(today.getFullYear(), today.getMonth(), today.getDate(), selectedHour, selectedMinute);
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setViewYear(tomorrow.getFullYear());
    setViewMonth(tomorrow.getMonth());
    setSelectedYear(tomorrow.getFullYear());
    setSelectedMonth(tomorrow.getMonth());
    setSelectedDay(tomorrow.getDate());
    emitChange(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), selectedHour, selectedMinute);
  };

  // Build calendar matrix
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0

  const calendarDays: Array<{ day: number; isCurrentMonth: boolean }> = [];
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, isCurrentMonth: true });
  }
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, isCurrentMonth: false });
  }

  // Display text formatted as: dd/mm/yyyy HH:mm
  const displayText = value && parsed
    ? `${pad2(selectedDay)}/${pad2(selectedMonth + 1)}/${selectedYear} ${selectedHour}:${selectedMinute}`
    : "";

  const handleConfirm = () => {
    emitChange(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden input to satisfy HTML form validations if required */}
      <input
        tabIndex={-1}
        required={required}
        value={value}
        onChange={() => {}}
        className="sr-only"
        aria-hidden="true"
      />

      {/* Trigger Button Field */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-cyan-500 focus:outline-none p-2.5 text-xs text-slate-800 transition shadow-2xs cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-cyan-600 shrink-0 group-hover:scale-105 transition-transform" />
          {displayText ? (
            <span className="font-bold text-slate-900 tracking-wide">{displayText}</span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center shrink-0 ml-2">
          <Clock className="h-4 w-4 text-slate-400 group-hover:text-cyan-600 transition-colors" />
        </div>
      </button>

      {/* Popover Date & Time Picker */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 z-50 w-[320px] sm:w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Calendar Month & Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="font-extrabold text-sm text-slate-900">
              {MONTH_NAMES[viewMonth]}, {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-2 pt-2.5 pb-2">
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 transition cursor-pointer"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={handleTomorrow}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 transition cursor-pointer"
            >
              Ngày mai
            </button>
          </div>

          {/* Weekday Labels (T2 - CN) */}
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 py-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {calendarDays.map((item, index) => {
              const isSelected =
                item.isCurrentMonth &&
                viewYear === selectedYear &&
                viewMonth === selectedMonth &&
                item.day === selectedDay;

              const isToday =
                item.isCurrentMonth &&
                viewYear === now.getFullYear() &&
                viewMonth === now.getMonth() &&
                item.day === now.getDate();

              return (
                <button
                  key={index}
                  type="button"
                  disabled={!item.isCurrentMonth}
                  onClick={() => item.isCurrentMonth && handleSelectDay(item.day)}
                  className={`h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? "bg-cyan-600 text-white shadow-sm font-bold scale-105"
                      : !item.isCurrentMonth
                      ? "text-slate-300 cursor-not-allowed opacity-30"
                      : isToday
                      ? "border border-cyan-500 text-cyan-700 font-bold bg-cyan-50/40"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Time Section */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Clock className="h-3.5 w-3.5 text-cyan-600" />
                Giờ diễn ra
              </span>
              <span className="text-[11px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100 font-bold">
                {selectedHour}:{selectedMinute}
              </span>
            </div>

            {/* Hour and Minute Selectors */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Giờ</label>
                <select
                  value={selectedHour}
                  onChange={handleHourChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                >
                  {HOURS_24.map((h) => (
                    <option key={h} value={h}>
                      {h} giờ
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Phút</label>
                <select
                  value={selectedMinute}
                  onChange={handleMinuteChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                >
                  {MINUTES_5.map((m) => (
                    <option key={m} value={m}>
                      {m} phút
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick BNI Time Presets */}
            <div className="flex items-center justify-between gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-medium">Gợi ý:</span>
              <div className="flex items-center gap-1">
                {["06:45", "07:00", "08:30", "14:00", "19:30"].map((preset) => {
                  const [h, m] = preset.split(":");
                  const isActive = selectedHour === h && selectedMinute === m;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleQuickPreset(h, m)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                        isActive
                          ? "bg-cyan-600 text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">
              {pad2(selectedDay)}/{pad2(selectedMonth + 1)}/{selectedYear} • {selectedHour}:{selectedMinute}
            </span>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Xong</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
