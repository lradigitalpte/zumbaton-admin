"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function parseYMD(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
}

function toYMD(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayYMD() {
  const now = new Date();
  return toYMD(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function StudioDate({
  id,
  value,
  onChange,
  ariaLabel = "Choose a date",
  placeholder = "Choose a date",
  disabled = false,
  block = false,
  clearable = false,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  block?: boolean;
  clearable?: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pickingYear, setPickingYear] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0 });
  const current = value || "";
  const selected = parseYMD(current);
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? parseYMD(todayYMD())!;
    return { year: base.year, month: base.month };
  });

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const node = buttonRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const panelWidth = 320;
      const panelHeight = 430;
      const below = window.innerHeight - rect.bottom;
      const openUp = below < panelHeight && rect.top > below;
      setBox({
        top: openUp ? Math.max(8, rect.top - 8 - panelHeight) : rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open, pickingYear]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = selected
    ? new Date(selected.year, selected.month, selected.day).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : placeholder;

  const firstWeekday = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: { day: number; inMonth: boolean; ymd: string }[] = [];
  const prevDays = new Date(cursor.year, cursor.month, 0).getDate();
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = prevDays - i;
    const date = new Date(cursor.year, cursor.month - 1, day);
    cells.push({ day, inMonth: false, ymd: toYMD(date.getFullYear(), date.getMonth(), date.getDate()) });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true, ymd: toYMD(cursor.year, cursor.month, day) });
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    const date = new Date(cursor.year, cursor.month + 1, day);
    cells.push({ day: date.getDate(), inMonth: false, ymd: toYMD(date.getFullYear(), date.getMonth(), date.getDate()) });
  }

  const today = todayYMD();
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const yearStart = Math.floor(cursor.year / 12) * 12;

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const panel = open && mounted ? createPortal(
    <div
      ref={panelRef}
      data-studio-date=""
      style={{ top: box.top, left: box.left }}
      className="fixed z-[100002] w-[320px] rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_24px_60px_rgba(16,24,40,0.16)] dark:border-white/10 dark:bg-gray-800"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => (pickingYear ? setCursor({ ...cursor, year: cursor.year - 12 }) : shiftMonth(-1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-lg text-neutral-950 dark:bg-white/10 dark:text-white"
          aria-label={pickingYear ? "Previous years" : "Previous month"}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setPickingYear((current) => !current)}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10"
        >
          {pickingYear ? `${yearStart} – ${yearStart + 11}` : monthLabel}
        </button>
        <button
          type="button"
          onClick={() => (pickingYear ? setCursor({ ...cursor, year: cursor.year + 12 }) : shiftMonth(1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-lg text-neutral-950 dark:bg-white/10 dark:text-white"
          aria-label={pickingYear ? "Next years" : "Next month"}
        >
          ›
        </button>
      </div>
      {pickingYear ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, index) => yearStart + index).map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => {
                setCursor({ year, month: cursor.month });
                setPickingYear(false);
              }}
              className={`rounded-full py-2.5 text-sm font-semibold ${year === cursor.year ? "bg-[#E4F56C] text-neutral-950" : "text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10"}`}
            >
              {year}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const isSelected = cell.ymd === current;
              const isToday = cell.ymd === today;
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => {
                    onChange(cell.ymd);
                    setOpen(false);
                  }}
                  className={`flex h-9 items-center justify-center rounded-full text-sm font-semibold ${
                    isSelected
                      ? "bg-[#E4F56C] text-neutral-950"
                      : isToday
                        ? "bg-neutral-950 text-white"
                        : cell.inMonth
                          ? "text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10"
                          : "text-neutral-300 hover:bg-neutral-50 dark:text-white/25"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="mt-3 flex gap-2">
        {clearable && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="flex-1 rounded-full border border-neutral-200 py-2.5 text-sm font-semibold text-neutral-950 dark:border-white/10 dark:text-white"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const now = todayYMD();
            const parsed = parseYMD(now)!;
            setCursor({ year: parsed.year, month: parsed.month });
            setPickingYear(false);
            onChange(now);
            setOpen(false);
          }}
          className="flex-1 rounded-full bg-neutral-950 py-2.5 text-sm font-semibold text-white"
        >
          Today
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={block ? "relative w-full" : "relative"}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (selected) setCursor({ year: selected.year, month: selected.month });
          setPickingYear(false);
          setOpen((current) => !current);
        }}
        className={`inline-flex items-center gap-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
          block
            ? "h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 dark:border-white/10 dark:bg-white/5"
            : "h-12 rounded-full border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5"
        } ${selected ? "font-semibold text-neutral-950 dark:text-white" : "text-neutral-400"}`}
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {panel}
    </div>
  );
}
