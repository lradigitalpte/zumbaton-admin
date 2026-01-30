"use client";

import { useState, useRef, useEffect } from "react";

export interface DateRangeValue {
  from: string; // YYYY-MM-DD or ""
  to: string;   // YYYY-MM-DD or ""
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Preset buttons to show: "today" | "week" | "month" | "clear" */
  presets?: ("today" | "week" | "month" | "clear")[];
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  const startPad = first.getDay();
  const prevMonth = new Date(year, month, 0);
  const prevCount = prevMonth.getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevCount - i));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push(new Date(year, month + 1, d));
  }
  return days;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isInRange(dayYMD: string, from: string, to: string): boolean {
  if (!from || !to) return false;
  return dayYMD >= from && dayYMD <= to;
}

function isSameMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() === month;
}

export default function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  id,
  className = "",
  presets = ["today", "week", "month", "clear"],
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const rightMonth = { year: startMonth.month === 11 ? startMonth.year + 1 : startMonth.year, month: (startMonth.month + 1) % 12 };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const applyPreset = (preset: "today" | "week" | "month" | "clear") => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    if (preset === "clear") {
      onChange("", "");
      setOpen(false);
      return;
    }
    if (preset === "today") {
      onChange(todayStr, todayStr);
      setOpen(false);
      return;
    }
    if (preset === "week") {
      const mon = new Date(today);
      mon.setDate(today.getDate() - today.getDay());
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      onChange(toYMD(mon), toYMD(sun));
      setOpen(false);
      return;
    }
    if (preset === "month") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      onChange(toYMD(first), toYMD(last));
      setOpen(false);
    }
  };

  const handleDayClick = (ymd: string) => {
    if (selecting === "from") {
      onChange(ymd, value.to && ymd > value.to ? ymd : value.to);
      setSelecting("to");
    } else {
      if (ymd < value.from) {
        onChange(ymd, value.from);
      } else {
        onChange(value.from, ymd);
      }
      setSelecting("from");
      setOpen(false);
    }
  };

  const label =
    value.from && value.to
      ? value.from === value.to
        ? value.from
        : `${value.from} → ${value.to}`
      : placeholder;

  const leftDays = getDaysInMonth(startMonth.year, startMonth.month);
  const rightDays = getDaysInMonth(rightMonth.year, rightMonth.month);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goPrev = () =>
    setStartMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const goNext = () =>
    setStartMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const renderMonth = (
    year: number,
    month: number,
    days: Date[],
    navLabel: string,
    onPrev: () => void,
    onNext: () => void
  ) => (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-2 pb-2 dark:border-gray-700">
        <button
          type="button"
          onClick={onPrev}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          aria-label="Previous month"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{navLabel}</span>
        <button
          type="button"
          onClick={onNext}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          aria-label="Next month"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 pt-2">
        {weekDays.map((wd) => (
          <div key={wd} className="py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {wd}
          </div>
        ))}
        {days.map((d, i) => {
          const ymd = toYMD(d);
          const currentMonth = isSameMonth(d, year, month);
          const isFrom = value.from === ymd;
          const isTo = value.to === ymd;
          const inRange = isInRange(ymd, value.from, value.to);
          const isToday = ymd === toYMD(new Date());
          return (
            <button
              key={i}
              type="button"
              onClick={() => currentMonth && handleDayClick(ymd)}
              disabled={!currentMonth}
              className={`h-8 w-8 rounded text-sm ${
                !currentMonth
                  ? "text-gray-300 dark:text-gray-600 cursor-default"
                  : isFrom || isTo
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold"
                    : inRange
                      ? "bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-white"
                      : isToday
                        ? "ring-1 ring-gray-400 dark:ring-gray-500 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  const monthName = (y: number, m: number) =>
    new Date(y, m, 1).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => {
          setOpen((o) => {
            if (!o) setSelecting("from");
            return !o;
          });
        }}
        className="flex w-full min-w-[220px] items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-900 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-gray-600 dark:focus:ring-gray-600"
      >
        <span className={value.from && value.to ? "font-medium" : "text-gray-500 dark:text-gray-400"}>
          {label}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[320px] max-w-[420px] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
          {/* Quick select: Day, Week, Month, Clear – first so they're never "gone" */}
          {presets.length > 0 && (
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Quick select
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.includes("today") && (
                  <button
                    type="button"
                    onClick={() => applyPreset("today")}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Today
                  </button>
                )}
                {presets.includes("week") && (
                  <button
                    type="button"
                    onClick={() => applyPreset("week")}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    This week
                  </button>
                )}
                {presets.includes("month") && (
                  <button
                    type="button"
                    onClick={() => applyPreset("month")}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    This month
                  </button>
                )}
                {presets.includes("clear") && (
                  <button
                    type="button"
                    onClick={() => applyPreset("clear")}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Custom range: type dates or use calendar */}
          <div className="border-t border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Custom range
            </p>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="date"
                value={value.from}
                onChange={(e) => onChange(e.target.value, value.to)}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-gray-500 dark:focus:ring-gray-500"
                title="From date"
              />
              <span className="text-xs text-gray-400 dark:text-gray-500">to</span>
              <input
                type="date"
                value={value.to}
                onChange={(e) => onChange(value.from, e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-gray-500 dark:focus:ring-gray-500"
                title="To date"
              />
            </div>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Or pick on calendar
            </p>
            <div className="flex gap-4 overflow-x-auto">
              {renderMonth(
                startMonth.year,
                startMonth.month,
                leftDays,
                monthName(startMonth.year, startMonth.month),
                goPrev,
                goNext
              )}
              {renderMonth(
                rightMonth.year,
                rightMonth.month,
                rightDays,
                monthName(rightMonth.year, rightMonth.month),
                goPrev,
                goNext
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
