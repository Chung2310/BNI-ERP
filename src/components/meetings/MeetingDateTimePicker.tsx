import React, { useState, useEffect, useRef } from "react";
import { CalendarDays, Clock, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface MeetingDateTimePickerProps {
  value: string; // ISO string hoặc "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
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
const YEARS = Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - 2 + i);

const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => pad2(i * 5));

export function MeetingDateTimePicker({
  value,
  onChange,
  required,
  disabled,
  className = "",
  placeholder = "Chọn ngày...",
  ariaLabel = "Ngày và giờ",
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

  const formatDisplay = (y: number, m: number, d: number, h: string, min: string) => {
    return `${pad2(d)}/${pad2(m + 1)}/${y} ${h}:${min}`;
  };

  // Input text field value for direct typing
  const [inputValue, setInputValue] = useState(
    parsed ? formatDisplay(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute) : ""
  );

  // Keep internal state synced when value prop updates
  const [previousInputs1, setPreviousInputs1] = useState<unknown[] | null>(null);
  if (previousInputs1 === null || !Object.is(previousInputs1[0], value)) {
    setPreviousInputs1([value]);
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
        setInputValue(formatDisplay(p.year, p.month, p.day, p.hour, p.minute));
      }
    } else {
      setInputValue("");
    }
  
  }

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

  // Direct keyboard input handling (dd/mm/yyyy HH:mm)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);

    // Support formats: dd/mm/yyyy HH:mm or dd/mm/yyyy
    const match = text.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
    if (match) {
      const d = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const y = parseInt(match[3], 10);
      const h = match[4] !== undefined ? pad2(parseInt(match[4], 10)) : selectedHour;
      const min = match[5] !== undefined ? pad2(parseInt(match[5], 10)) : selectedMinute;

      if (d >= 1 && d <= 31 && m >= 0 && m <= 11 && y >= 2020 && y <= 2100) {
        setSelectedDay(d);
        setSelectedMonth(m);
        setSelectedYear(y);
        setSelectedHour(h);
        setSelectedMinute(min);
        setViewYear(y);
        setViewMonth(m);
        emitChange(y, m, d, h, min);
      }
    }
  };

  const handleInputBlur = () => {
    if (value) {
      const p = parseValue(value);
      if (p) {
        setInputValue(formatDisplay(p.year, p.month, p.day, p.hour, p.minute));
      }
    } else {
      setInputValue("");
    }
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

  const handleNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setViewYear(nextWeek.getFullYear());
    setViewMonth(nextWeek.getMonth());
    setSelectedYear(nextWeek.getFullYear());
    setSelectedMonth(nextWeek.getMonth());
    setSelectedDay(nextWeek.getDate());
    emitChange(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), selectedHour, selectedMinute);
  };

  const handleNextMonthQuick = () => {
    const nextM = new Date();
    nextM.setMonth(nextM.getMonth() + 1);
    setViewYear(nextM.getFullYear());
    setViewMonth(nextM.getMonth());
    setSelectedYear(nextM.getFullYear());
    setSelectedMonth(nextM.getMonth());
    setSelectedDay(nextM.getDate());
    emitChange(nextM.getFullYear(), nextM.getMonth(), nextM.getDate(), selectedHour, selectedMinute);
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

  const handleConfirm = () => {
    emitChange(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden input for HTML form validations if required */}
      <input
        tabIndex={-1}
        required={required}
        value={value}
        onChange={() => {}}
        className="sr-only"
        aria-hidden="true"
      />

      {/* Main Input Field: Direct typing + Click to open picker */}
      <div className="relative flex items-center w-full rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus-within:bg-white focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition shadow-2xs">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="pl-3 pr-2 py-2.5 text-cyan-600 hover:text-cyan-700 transition cursor-pointer shrink-0"
          title="Mở lịch chọn nhanh ngày & giờ"
        >
          <CalendarDays className="h-4 w-4" />
        </button>

        <input
          type="text"
          aria-label={ariaLabel}
          disabled={disabled}
          required={required}
          value={inputValue}
          placeholder={placeholder}
          onClick={() => setIsOpen(true)}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className="w-full bg-transparent py-2.5 pr-2 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none tracking-wide"
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="pr-3 pl-2 py-2.5 text-slate-400 hover:text-cyan-600 transition cursor-pointer shrink-0"
          title="Chọn giờ"
        >
          <Clock className="h-4 w-4" />
        </button>
      </div>

      {/* Popover Date & Time Picker */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 z-50 w-[330px] sm:w-[570px] rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none">
          <div className="flex flex-col sm:flex-row sm:divide-x sm:divide-slate-100 gap-3.5 sm:gap-4">
            {/* Left Panel: Calendar (Date Picker) */}
            <div className="sm:flex-1 sm:pr-4 flex flex-col justify-between">
              <div>
                {/* Calendar Month & Year Fast Selector + Navigation */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {/* Quick Month Dropdown */}
                    <select
                      value={viewMonth}
                      onChange={(e) => {
                        const m = parseInt(e.target.value, 10);
                        setViewMonth(m);
                        setSelectedMonth(m);
                        emitChange(viewYear, m, selectedDay, selectedHour, selectedMinute);
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-extrabold text-slate-800 hover:bg-white focus:bg-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                    >
                      {MONTH_NAMES.map((name, index) => (
                        <option key={name} value={index}>
                          {name}
                        </option>
                      ))}
                    </select>

                    {/* Quick Year Dropdown */}
                    <select
                      value={viewYear}
                      onChange={(e) => {
                        const y = parseInt(e.target.value, 10);
                        setViewYear(y);
                        setSelectedYear(y);
                        emitChange(y, viewMonth, selectedDay, selectedHour, selectedMinute);
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-extrabold text-slate-800 hover:bg-white focus:bg-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          Năm {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
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

                {/* Quick Date Shortcuts (Hôm nay, Ngày mai, Tuần sau, Tháng sau) */}
                <div className="flex items-center gap-1.5 pt-2 pb-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={handleToday}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 transition cursor-pointer shrink-0"
                  >
                    Hôm nay
                  </button>
                  <button
                    type="button"
                    onClick={handleTomorrow}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 transition cursor-pointer shrink-0"
                  >
                    Ngày mai
                  </button>
                  <button
                    type="button"
                    onClick={handleNextWeek}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 transition cursor-pointer shrink-0"
                  >
                    Tuần sau
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonthQuick}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 transition cursor-pointer shrink-0"
                  >
                    Tháng sau
                  </button>
                </div>

                {/* Quick Manual Date Inputs Row (Nhập nhanh Ngày - Tháng - Năm) */}
                <div className="grid grid-cols-3 gap-1.5 pb-2 border-b border-slate-100 text-xs">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Ngày (1-31)</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={selectedDay}
                      onChange={(e) => {
                        const d = parseInt(e.target.value, 10);
                        if (!isNaN(d) && d >= 1 && d <= 31) {
                          setSelectedDay(d);
                          emitChange(selectedYear, selectedMonth, d, selectedHour, selectedMinute);
                        }
                      }}
                      className="w-full text-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Tháng (1-12)</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => {
                        const m = parseInt(e.target.value, 10);
                        setSelectedMonth(m);
                        setViewMonth(m);
                        emitChange(selectedYear, m, selectedDay, selectedHour, selectedMinute);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                    >
                      {MONTH_NAMES.map((name, index) => (
                        <option key={name} value={index}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Năm</label>
                    <input
                      type="number"
                      min={2020}
                      max={2099}
                      value={selectedYear}
                      onChange={(e) => {
                        const y = parseInt(e.target.value, 10);
                        if (!isNaN(y) && y >= 2020 && y <= 2099) {
                          setSelectedYear(y);
                          setViewYear(y);
                          emitChange(y, selectedMonth, selectedDay, selectedHour, selectedMinute);
                        }
                      }}
                      className="w-full text-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold text-slate-800 focus:bg-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Weekday Labels (T2 - CN) */}
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 py-1">
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
                        className={`h-7.5 w-7.5 sm:h-8 sm:w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-semibold transition cursor-pointer ${
                          isSelected
                            ? "bg-cyan-600 text-white shadow-xs font-bold scale-105"
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
              </div>

              {/* Date selection status preview */}
              <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-500">
                Ngày đã chọn: <span className="font-bold text-slate-800">{pad2(selectedDay)}/{pad2(selectedMonth + 1)}/{selectedYear}</span>
              </div>
            </div>

            {/* Right Panel: Time Picker (Giờ & Phút) */}
            <div className="sm:w-[210px] sm:pl-4 flex flex-col justify-between pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Clock className="h-4 w-4 text-cyan-600" />
                    Giờ diễn ra
                  </span>
                </div>

                {/* Big Time Display Badge */}
                <div className="py-2.5 px-3 bg-cyan-50/70 border border-cyan-100 rounded-xl text-center shadow-xs">
                  <span className="text-2xl font-black font-mono text-cyan-700 tracking-wider">
                    {selectedHour}:{selectedMinute}
                  </span>
                  <span className="block text-[10px] font-semibold text-cyan-600/80 mt-0.5">
                    {parseInt(selectedHour, 10) < 12 ? "Buổi sáng" : parseInt(selectedHour, 10) < 18 ? "Buổi chiều" : "Buổi tối"}
                  </span>
                </div>

                {/* Hour and Minute Dropdowns */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Giờ</label>
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
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Phút</label>
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
                <div className="space-y-1.5 pt-0.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gợi ý giờ BNI</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["06:45", "07:00", "07:15", "08:30", "14:00", "19:30"].map((preset) => {
                      const [h, m] = preset.split(":");
                      const isActive = selectedHour === h && selectedMinute === m;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleQuickPreset(h, m)}
                          className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold transition text-center cursor-pointer ${
                            isActive
                              ? "bg-cyan-600 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Confirm Action */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-cyan-600/20 transition cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Xong</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
