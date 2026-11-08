"use client";

import { Fragment, useState, useMemo } from "react";
import Link from "next/link";
import DateRangePicker from "@/components/common/DateRangePicker";
import { useTutorClasses } from "@/hooks/useTutor";

const SGT_TZ = "Asia/Singapore";

function toSgtYmd(d: Date): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SGT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

interface ClassItem {
  id: string;
  name: string;
  type: string;
  time: string;
  /** Minutes since midnight (SGT) — for correct ordering of same-day classes. */
  minutes: number;
  duration: number;
  room: string;
  date: string;
  enrolled: number;
  capacity: number;
  attended: number;
  status: "upcoming" | "completed" | "cancelled";
  _isParent?: boolean;
  _childInstances?: ClassItem[];
  _totalSessions?: number;
  recurrence_type?: "single" | "recurring" | "course" | null;
}

type View = "table" | "calendar";

const card =
  "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

const STATUS: Record<ClassItem["status"], { label: string; pill: string; chip: string }> = {
  upcoming: {
    label: "Upcoming",
    pill: "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950",
    chip: "bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950",
  },
  completed: {
    label: "Completed",
    pill: "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/60",
    chip: "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70",
  },
  cancelled: {
    label: "Cancelled",
    pill: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
    chip: "bg-red-50 text-red-600 line-through hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300",
  },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday (YYYY-MM-DD) of the week containing a YYYY-MM-DD date. */
function weekStartOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function addMonths(monthYmd: string, months: number): string {
  const [y, m] = monthYmd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
}

function dateParts(ymd: string) {
  const date = new Date(`${ymd}T12:00:00+08:00`);
  const fmt = (opts: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-SG", { ...opts, timeZone: SGT_TZ });
  return { weekday: fmt({ weekday: "short" }), day: fmt({ day: "numeric" }), month: fmt({ month: "short" }) };
}

function sgtMinutes(d: Date): number {
  const [h, m] = d
    .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: SGT_TZ })
    .split(":")
    .map(Number);
  return h * 60 + m;
}

function attendancePct(c: ClassItem) {
  return c.enrolled > 0 ? Math.round((c.attended / c.enrolled) * 100) : 0;
}

export default function TutorClassesPage() {
  const todayYmd = toSgtYmd(new Date());
  const thisWeek = weekStartOf(todayYmd);

  const [view, setView] = useState<View>("table");
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [month, setMonth] = useState<string>(`${todayYmd.slice(0, 7)}-01`);
  const [selectedDay, setSelectedDay] = useState<string>(todayYmd);

  // Calendar grid: Monday on/before the 1st, through the Sunday on/after month end.
  const gridStart = weekStartOf(month);
  const monthEnd = addDays(addMonths(month, 1), -1);
  const gridEnd = addDays(weekStartOf(monthEnd), 6);

  // One query; its parameters follow the current view.
  const { data, isLoading, error } = useTutorClasses(
    view === "calendar"
      ? {
          status: "all",
          limit: 500,
          startDate: new Date(`${gridStart}T00:00:00+08:00`).toISOString(),
          endDate: new Date(`${gridEnd}T23:59:59.999+08:00`).toISOString(),
        }
      : {
          status: filter === "all" ? "all" : filter === "upcoming" ? "upcoming" : "past",
          limit: 50,
          startDate: dateRange.from ? new Date(`${dateRange.from}T00:00:00+08:00`).toISOString() : undefined,
          endDate: dateRange.to ? new Date(`${dateRange.to}T23:59:59.999+08:00`).toISOString() : undefined,
        }
  );

  // Transform API data to component format
  const classes: ClassItem[] = useMemo(() => {
    if (!data?.classes) return [];

    const now = new Date();
    const fmtTime = (d: Date) => d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: SGT_TZ });
    const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Class");

    const toItem = (cls: any, children: ClassItem[] = []): ClassItem => {
      const t = new Date(cls.scheduled_at);
      return {
        id: cls.id,
        name: cls.title,
        type: cap(cls.class_type),
        time: fmtTime(t),
        minutes: sgtMinutes(t),
        duration: cls.duration_minutes,
        room: cls.room_name || cls.location || "TBD",
        date: toSgtYmd(t),
        enrolled: cls.bookedCount || 0,
        capacity: cls.capacity,
        attended: cls.attendedCount || 0,
        status: cls.status === "cancelled" ? "cancelled" : t < now ? "completed" : "upcoming",
        _isParent: cls._isParent || false,
        _childInstances: children,
        _totalSessions: cls._totalSessions || 0,
        recurrence_type: (cls.recurrence_type as "single" | "recurring" | "course" | null) || "single",
      };
    };

    return data.classes.map((cls) => toItem(cls, (cls._childInstances || []).map((child: any) => toItem(child))));
  }, [data]);

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T12:00:00+08:00`);
    if (isNaN(date.getTime())) return "TBD";
    if (dateStr === todayYmd) return "Today";
    if (dateStr === addDays(todayYmd, 1)) return "Tomorrow";
    if (dateStr === addDays(todayYmd, -1)) return "Yesterday";
    return date.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", timeZone: SGT_TZ });
  };

  // Upcoming: soonest first. Completed: newest first.
  // All: upcoming soonest first, then past newest first.
  const sortedClasses = useMemo(() => {
    const chrono = (a: ClassItem, b: ClassItem) => a.date.localeCompare(b.date) || a.minutes - b.minutes;
    if (filter === "upcoming") return [...classes].sort(chrono);
    if (filter === "past") return [...classes].sort((a, b) => chrono(b, a));
    const future = classes.filter((c) => c.status === "upcoming").sort(chrono);
    const past = classes.filter((c) => c.status !== "upcoming").sort((a, b) => chrono(b, a));
    return [...future, ...past];
  }, [classes, filter]);

  const weeks = useMemo(() => {
    const map = new Map<string, ClassItem[]>();
    for (const cls of sortedClasses) {
      const key = weekStartOf(cls.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cls);
    }
    return [...map.entries()].map(([start, items]) => ({ start, items }));
  }, [sortedClasses]);

  // Calendar: every individual session (series are expanded into their sessions), by day.
  const byDay = useMemo(() => {
    const map = new Map<string, ClassItem[]>();
    const sessions = classes.flatMap((c) => (c._isParent && c._childInstances?.length ? c._childInstances : [c]));
    const seen = new Set<string>();
    for (const s of sessions) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    for (const list of map.values()) list.sort((a, b) => a.minutes - b.minutes);
    return map;
  }, [classes]);

  const gridDays = useMemo(() => {
    const days: string[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
    return days;
  }, [gridStart, gridEnd]);

  const weekLabel = (start: string) => {
    if (start === thisWeek) return "This week";
    if (start === addDays(thisWeek, 7)) return "Next week";
    if (start === addDays(thisWeek, -7)) return "Last week";
    const s = dateParts(start);
    const e = dateParts(addDays(start, 6));
    return s.month === e.month ? `${s.day}–${e.day} ${s.month}` : `${s.day} ${s.month} – ${e.day} ${e.month}`;
  };

  const stats = useMemo(() => ({
    totalClasses: data?.meta?.total || classes.length,
    upcoming: classes.filter(c => c.status === "upcoming").length,
    completed: classes.filter(c => c.status === "completed").length,
    totalBookings: classes.reduce((sum, c) => sum + c.enrolled, 0),
  }), [data, classes]);

  const toggleParent = (id: string) =>
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const monthLabel = new Date(`${month}T12:00:00+08:00`).toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
    timeZone: SGT_TZ,
  });

  const goToMonth = (m: string) => {
    setMonth(m);
    setSelectedDay(m.slice(0, 7) === todayYmd.slice(0, 7) ? todayYmd : m);
  };

  const header = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">My classes</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">Your schedule, bookings and attendance.</p>
    </div>
  );

  if (error) {
    return (
      <div className="min-w-0 space-y-5">
        {header}
        <div className={`${card} px-6 py-14 text-center`}>
          <p className="text-base font-semibold text-neutral-950 dark:text-white">Couldn&apos;t load your classes</p>
          <p className="mt-1 text-sm text-neutral-500">{error.message}</p>
        </div>
      </div>
    );
  }

  /** Booked (upcoming) or came (completed) — text + mini bar. */
  const Bookings = ({ c }: { c: ClassItem }) => {
    if (c.status === "cancelled") return <span className="text-sm text-neutral-300 dark:text-white/20">—</span>;
    const completed = c.status === "completed";
    const pct = completed ? attendancePct(c) : c.capacity > 0 ? Math.min(100, Math.round((c.enrolled / c.capacity) * 100)) : 0;
    return (
      <div className="w-28">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
          {completed ? `${c.attended}/${c.enrolled}` : `${c.enrolled}/${c.capacity}`}
          <span className="ml-1 text-[11px] font-medium text-neutral-400">{completed ? `came · ${pct}%` : "booked"}</span>
        </p>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${completed ? "bg-neutral-400" : "bg-neutral-950 dark:bg-[#E4F56C]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  const DateCell = ({ c }: { c: ClassItem }) => {
    const p = dateParts(c.date);
    const isToday = c.date === todayYmd;
    const past = c.status !== "upcoming";
    return (
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${
            isToday
              ? "bg-[#E4F56C] text-neutral-950"
              : past
                ? "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/60"
                : "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
          }`}
        >
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{isToday ? "Today" : p.weekday}</span>
          <span className="mt-0.5 text-base font-bold">{p.day}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{c.time}</p>
          <p className="text-[11px] text-neutral-400">
            {p.month} · {c.duration} min
          </p>
        </div>
      </div>
    );
  };

  const SeriesBadge = ({ c }: { c: ClassItem }) => {
    const isSeries = c._isParent && (c.recurrence_type === "recurring" || c.recurrence_type === "course");
    if (!isSeries) return null;
    const hasChildren = (c._childInstances?.length ?? 0) > 0;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) toggleParent(c.id);
        }}
        className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-white/15 dark:text-white/70"
      >
        {c.recurrence_type === "course" ? "Course" : "Series"}
        {(c._totalSessions ?? 0) > 0 ? ` · ${c._totalSessions}` : ""}
        {hasChildren ? (expandedParents.has(c.id) ? " ▴" : " ▾") : ""}
      </button>
    );
  };

  /** Desktop table row (also used for expanded series sessions). */
  const DesktopRow = ({ c, child = false }: { c: ClassItem; child?: boolean }) => (
    <tr
      onClick={() => setSelectedClass(c)}
      className={`cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-white/5 ${c.status === "cancelled" ? "opacity-60" : ""} ${
        child ? "bg-neutral-50/60 dark:bg-white/[0.02]" : ""
      }`}
    >
      <td className={`whitespace-nowrap py-3 pr-4 ${child ? "pl-12" : "pl-6"}`}>
        <DateCell c={c} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{c.name}</span>
          <SeriesBadge c={c} />
        </div>
        <p className="text-[11px] text-neutral-400">{c.type}</p>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-white/80">
        {c.room && c.room !== "TBD" && c.room !== "TBA" ? c.room : <span className="text-neutral-300 dark:text-white/20">—</span>}
      </td>
      <td className="px-4 py-3">
        <Bookings c={c} />
      </td>
      <td className="whitespace-nowrap py-3 pl-4 pr-6">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS[c.status].pill}`}>{STATUS[c.status].label}</span>
      </td>
    </tr>
  );

  /** Mobile row: same columns, stacked. */
  const MobileRow = ({ c, child = false }: { c: ClassItem; child?: boolean }) => (
    <li
      onClick={() => setSelectedClass(c)}
      className={`flex cursor-pointer items-center gap-3 py-3 pr-4 transition active:bg-neutral-50 dark:active:bg-white/5 ${
        child ? "bg-neutral-50/60 pl-8 dark:bg-white/[0.02]" : "pl-4"
      } ${c.status === "cancelled" ? "opacity-60" : ""}`}
    >
      <DateCell c={c} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{c.name}</span>
          <SeriesBadge c={c} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[c.status].pill}`}>{STATUS[c.status].label}</span>
          {c.status !== "cancelled" && (
            <span className="text-[11px] font-semibold text-neutral-600 dark:text-white/70">
              {c.status === "completed" ? `${c.attended}/${c.enrolled} came` : `${c.enrolled}/${c.capacity} booked`}
            </span>
          )}
        </div>
      </div>
    </li>
  );

  const emptyText =
    filter === "upcoming"
      ? "You don't have any upcoming classes scheduled."
      : filter === "past"
        ? "You haven't completed any classes yet."
        : "You don't have any classes assigned yet.";

  const selectedDayClasses = byDay.get(selectedDay) ?? [];

  const calendar = (
    <div className="border-t border-neutral-100 dark:border-white/5">
      {/* Month nav */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-neutral-950 dark:text-white">{monthLabel}</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => goToMonth(addMonths(month, -1))}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-white"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goToMonth(`${todayYmd.slice(0, 7)}-01`)}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => goToMonth(addMonths(month, 1))}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-white"
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-y border-neutral-100 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:border-white/5 sm:text-[11px]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      {/* Days */}
      <div className={`grid grid-cols-7 ${isLoading ? "animate-pulse" : ""}`}>
        {gridDays.map((day, i) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const isToday = day === todayYmd;
          const isSelected = day === selectedDay;
          const list = byDay.get(day) ?? [];
          const dayNum = Number(day.slice(8));
          return (
            <div
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`min-h-[56px] cursor-pointer border-neutral-100 p-1 transition dark:border-white/5 md:min-h-[112px] md:p-1.5 ${
                i % 7 !== 6 ? "border-r" : ""
              } ${i < gridDays.length - 7 ? "border-b" : ""} ${inMonth ? "" : "bg-neutral-50/70 dark:bg-white/[0.02]"} ${
                isSelected ? "md:bg-transparent bg-neutral-100 dark:bg-white/10" : "hover:bg-neutral-50 dark:hover:bg-white/5"
              }`}
            >
              <div className="flex justify-center md:justify-start">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? "bg-[#E4F56C] text-neutral-950"
                      : inMonth
                        ? "text-neutral-800 dark:text-white/80"
                        : "text-neutral-300 dark:text-white/25"
                  }`}
                >
                  {dayNum}
                </span>
              </div>

              {/* Phone: dots */}
              {list.length > 0 && (
                <div className="mt-1 flex justify-center gap-0.5 md:hidden">
                  {list.slice(0, 3).map((c) => (
                    <span
                      key={c.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        c.status === "upcoming" ? "bg-neutral-950 dark:bg-[#E4F56C]" : c.status === "cancelled" ? "bg-red-400" : "bg-neutral-300"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Desktop: class chips */}
              <div className="mt-1 hidden space-y-1 md:block">
                {list.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClass(c);
                    }}
                    title={`${c.time} · ${c.name} · ${c.status === "completed" ? `${c.attended}/${c.enrolled} came` : `${c.enrolled}/${c.capacity} booked`}`}
                    className={`block w-full truncate rounded-lg px-1.5 py-1 text-left text-[11px] font-semibold transition ${STATUS[c.status].chip}`}
                  >
                    <span className="opacity-70">{c.time}</span> {c.name}
                  </button>
                ))}
                {list.length > 3 && (
                  <p className="px-1.5 text-[10px] font-semibold text-neutral-400">+{list.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Phone: selected day's classes */}
      <div className="border-t border-neutral-100 dark:border-white/5 md:hidden">
        <p className="bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-500 dark:bg-white/[0.03]">{formatDate(selectedDay)}</p>
        {selectedDayClasses.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">No classes this day</p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-white/5">
            {selectedDayClasses.map((c) => (
              <MobileRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const table =
    weeks.length === 0 ? (
      <div className="border-t border-neutral-100 px-6 py-14 text-center dark:border-white/5">
        <p className="text-base font-semibold text-neutral-950 dark:text-white">No classes found</p>
        <p className="mt-1 text-sm text-neutral-500">{emptyText}</p>
      </div>
    ) : (
      <>
        {/* Desktop / tablet: real table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-y border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-400 dark:border-white/5">
              <tr>
                <th className="py-2.5 pl-6 pr-4 font-semibold">When</th>
                <th className="px-4 py-2.5 font-semibold">Class</th>
                <th className="px-4 py-2.5 font-semibold">Room</th>
                <th className="px-4 py-2.5 font-semibold">Bookings</th>
                <th className="py-2.5 pl-4 pr-6 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {weeks.map((week) => (
                <Fragment key={week.start}>
                  <tr className="bg-neutral-50 dark:bg-white/[0.03]">
                    <td colSpan={5} className="px-6 py-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          week.start === thisWeek ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                        }`}
                      >
                        {weekLabel(week.start)}
                      </span>
                      <span className="ml-2 text-[11px] text-neutral-400">
                        {week.items.length} class{week.items.length === 1 ? "" : "es"}
                      </span>
                    </td>
                  </tr>
                  {week.items.map((c) => (
                    <Fragment key={c.id}>
                      <DesktopRow c={c} />
                      {expandedParents.has(c.id) && c._childInstances?.map((s) => <DesktopRow key={s.id} c={s} child />)}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone: stacked rows */}
        <div className="border-t border-neutral-100 dark:border-white/5 md:hidden">
          {weeks.map((week) => (
            <div key={week.start}>
              <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 dark:bg-white/[0.03]">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    week.start === thisWeek ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                  }`}
                >
                  {weekLabel(week.start)}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {week.items.length} class{week.items.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="divide-y divide-neutral-100 dark:divide-white/5">
                {week.items.map((c) => (
                  <Fragment key={c.id}>
                    <MobileRow c={c} />
                    {expandedParents.has(c.id) && c._childInstances?.map((s) => <MobileRow key={s.id} c={s} child />)}
                  </Fragment>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </>
    );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {header}

      {/* Stats (follow the current view: the filter, or the calendar month) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className={`${card} p-4 sm:p-5`}>
          <p className="text-xs font-medium text-neutral-500 dark:text-white/60 sm:text-sm">{view === "calendar" ? "Classes this month" : "Total classes"}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:mt-3 sm:text-4xl">
            {isLoading ? "…" : stats.totalClasses}
          </p>
        </div>
        <div className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-4 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)] sm:p-5">
          <p className="text-xs font-medium sm:text-sm">Upcoming</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:mt-3 sm:text-4xl">{isLoading ? "…" : stats.upcoming}</p>
        </div>
        <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-4 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)] sm:p-5">
          <p className="text-xs font-medium text-white/60 sm:text-sm">Completed</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:mt-3 sm:text-4xl">{isLoading ? "…" : stats.completed}</p>
        </div>
        <div className={`${card} p-4 sm:p-5`}>
          <p className="text-xs font-medium text-neutral-500 dark:text-white/60 sm:text-sm">Total bookings</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:mt-3 sm:text-4xl">
            {isLoading ? "…" : stats.totalBookings}
          </p>
        </div>
      </div>

      {/* Classes */}
      <section className={`${card} min-w-0 overflow-hidden`}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            {/* View switch */}
            <div className="inline-flex shrink-0 gap-1 self-start rounded-full bg-neutral-950 p-1 dark:bg-white/10">
              {(["table", "calendar"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
                    view === v ? "bg-[#E4F56C] text-neutral-950" : "text-white/70 hover:text-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {view === "table" && (
              <div className="-mx-1 overflow-x-auto px-1">
                <div className="inline-flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5">
                  {[
                    { id: "all", label: "All" },
                    { id: "upcoming", label: "Upcoming" },
                    { id: "past", label: "Completed" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id as typeof filter)}
                      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                        filter === tab.id
                          ? "bg-white text-neutral-950 shadow-sm dark:bg-gray-700 dark:text-white"
                          : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {view === "table" && (
            <div className="w-full sm:w-64">
              <DateRangePicker value={dateRange} onChange={(from, to) => setDateRange({ from, to })} placeholder="Any date" />
            </div>
          )}
        </div>

        {view === "calendar" ? (
          calendar
        ) : isLoading ? (
          <div className="space-y-2 border-t border-neutral-100 p-5 dark:border-white/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-neutral-100 dark:bg-white/10" />
            ))}
          </div>
        ) : (
          table
        )}
      </section>

      {/* Class detail — bottom sheet on mobile, centred dialog on larger screens */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedClass(null)} />
          <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-xl dark:bg-gray-800 sm:max-w-lg sm:rounded-[28px] sm:p-6">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200 dark:bg-white/20 sm:hidden" />
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{selectedClass.name}</h2>
                <p className="text-sm text-neutral-500">{selectedClass.type}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                aria-label="Close"
                className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-neutral-50 p-3.5 dark:bg-white/5">
                <p className="text-[11px] font-medium text-neutral-500">When</p>
                <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{formatDate(selectedClass.date)}</p>
                <p className="text-xs text-neutral-500">{selectedClass.time} · {selectedClass.duration} min</p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3.5 dark:bg-white/5">
                <p className="text-[11px] font-medium text-neutral-500">Where</p>
                <p className="mt-1 truncate text-sm font-semibold text-neutral-950 dark:text-white">{selectedClass.room || "TBA"}</p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3.5 dark:bg-white/5">
                <p className="text-[11px] font-medium text-neutral-500">Booked</p>
                <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                  {selectedClass.enrolled}/{selectedClass.capacity}
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3.5 dark:bg-white/5">
                <p className="text-[11px] font-medium text-neutral-500">Status</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS[selectedClass.status].pill}`}>
                  {STATUS[selectedClass.status].label}
                </span>
              </div>
            </div>

            {selectedClass.status === "completed" && (
              <div className="mt-3 rounded-2xl bg-neutral-950 p-4 text-white dark:bg-white/10">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-white/60">Attendance</p>
                  <p className="text-2xl font-semibold tracking-tight">{attendancePct(selectedClass)}%</p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#E4F56C]" style={{ width: `${attendancePct(selectedClass)}%` }} />
                </div>
                <p className="mt-2 text-xs text-white/60">
                  {selectedClass.attended} came · {Math.max(0, selectedClass.enrolled - selectedClass.attended)} didn&apos;t
                </p>
              </div>
            )}

            <Link
              href={`/tutor/students?class=${selectedClass.id}`}
              className="mt-5 block rounded-full bg-neutral-950 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
            >
              View students
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
