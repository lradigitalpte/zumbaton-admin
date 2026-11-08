"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTutorSchedule } from "@/hooks/useTutor";

const SGT = "Asia/Singapore";

const card =
  "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

function sgtYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SGT, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(ymd, -((dow + 6) % 7));
}

function fmt(ymd: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-SG", { ...opts, timeZone: SGT });
}

function hoursLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function TutorSchedulePage() {
  const todayYmd = sgtYmd(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayYmd));

  const { data, isLoading, error } = useTutorSchedule({ view: "week", date: weekStart });

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        const classes = (data?.schedule?.[date] || []).map((c) => ({ ...c, cancelled: c.status === "cancelled" }));
        return { date, classes };
      }),
    [weekStart, data?.schedule]
  );

  const active = days.flatMap((d) => d.classes.filter((c) => !c.cancelled));
  const totalClasses = active.length;
  const totalBookings = active.reduce((s, c) => s + c.booked, 0);
  const totalSpots = active.reduce((s, c) => s + (c.capacity || 0), 0);
  const teachingMinutes = active.reduce((s, c) => s + (c.duration || 0), 0);
  const fillRate = totalSpots ? Math.round((totalBookings / totalSpots) * 100) : 0;
  const byType = data?.summary?.byType || {};
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  const isThisWeek = weekStart === mondayOf(todayYmd);
  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
    return sameMonth
      ? `${fmt(weekStart, { day: "numeric" })}–${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`
      : `${fmt(weekStart, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  const nav = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setWeekStart(addDays(weekStart, -7))}
        aria-label="Previous week"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-white"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => setWeekStart(mondayOf(todayYmd))}
        disabled={isThisWeek}
        className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-white/10 dark:text-white"
      >
        This week
      </button>
      <button
        type="button"
        onClick={() => setWeekStart(addDays(weekStart, 7))}
        aria-label="Next week"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-white"
      >
        ›
      </button>
    </div>
  );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {isThisWeek ? "This week" : "Week of"} · {weekLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">My schedule</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">Your week at a glance, in Singapore time.</p>
        </div>
        {nav}
      </div>

      {error ? (
        <div className={`${card} px-6 py-14 text-center`}>
          <p className="text-base font-semibold text-neutral-950 dark:text-white">Couldn&apos;t load your schedule</p>
          <p className="mt-1 text-sm text-neutral-500">{error.message}</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <div className={`${card} p-4 sm:p-5`}>
              <p className="text-xs font-medium text-neutral-500 dark:text-white/60 sm:text-sm">Classes</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:mt-3 sm:text-4xl">
                {isLoading ? "…" : totalClasses}
              </p>
            </div>
            <div className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-4 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)] sm:p-5">
              <p className="text-xs font-medium sm:text-sm">Bookings</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight sm:mt-3 sm:text-4xl">{isLoading ? "…" : totalBookings}</p>
              <p className="mt-1 text-[11px] text-neutral-700">of {totalSpots} spots</p>
            </div>
            <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-4 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)] sm:p-5">
              <p className="text-xs font-medium text-white/60 sm:text-sm">Spots filled</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight sm:mt-3 sm:text-4xl">{isLoading ? "…" : `${fillRate}%`}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#E4F56C]" style={{ width: `${fillRate}%` }} />
              </div>
            </div>
            <div className={`${card} p-4 sm:p-5`}>
              <p className="text-xs font-medium text-neutral-500 dark:text-white/60 sm:text-sm">Teaching time</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:mt-3 sm:text-4xl">
                {isLoading ? "…" : hoursLabel(teachingMinutes)}
              </p>
            </div>
          </div>

          {/* Week */}
          <section className={`${card} overflow-hidden`}>
            {/* Desktop: 7 columns */}
            <div className={`hidden grid-cols-7 md:grid ${isLoading ? "animate-pulse" : ""}`}>
              {days.map((day, i) => {
                const isToday = day.date === todayYmd;
                return (
                  <div
                    key={day.date}
                    className={`min-h-[260px] border-neutral-100 dark:border-white/5 ${i < 6 ? "border-r" : ""} ${
                      isToday ? "bg-[#E4F56C]/15" : ""
                    }`}
                  >
                    <div className="border-b border-neutral-100 px-3 py-3 text-center dark:border-white/5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{fmt(day.date, { weekday: "short" })}</p>
                      <span
                        className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday ? "bg-[#E4F56C] text-neutral-950" : "text-neutral-900 dark:text-white"
                        }`}
                      >
                        {fmt(day.date, { day: "numeric" })}
                      </span>
                    </div>
                    <div className="space-y-2 p-2">
                      {day.classes.length === 0 ? (
                        <p className="pt-8 text-center text-[11px] text-neutral-300 dark:text-white/20">—</p>
                      ) : (
                        day.classes.map((c) => {
                          const pct = c.capacity ? Math.min(100, Math.round((c.booked / c.capacity) * 100)) : 0;
                          return (
                            <div
                              key={c.id}
                              className={`rounded-2xl p-2.5 ${
                                c.cancelled
                                  ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                                  : "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                              }`}
                            >
                              <p className={`text-xs font-bold ${c.cancelled ? "" : "text-[#E4F56C] dark:text-neutral-950"}`}>{c.time}</p>
                              <p className={`mt-0.5 text-[11px] font-semibold uppercase leading-tight tracking-wide ${c.cancelled ? "line-through" : ""}`}>
                                {c.title}
                              </p>
                              {c.cancelled ? (
                                <p className="mt-1 text-[10px] font-semibold">Cancelled</p>
                              ) : (
                                <>
                                  <p className="mt-1 text-[10px] opacity-60">
                                    {c.duration} min{c.location ? ` · ${c.location}` : ""}
                                  </p>
                                  <div className="mt-2 flex items-center gap-1.5">
                                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15 dark:bg-neutral-950/15">
                                      <div className="h-full rounded-full bg-[#E4F56C] dark:bg-neutral-950" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[10px] font-semibold">
                                      {c.booked}/{c.capacity}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Phone: agenda */}
            <ul className={`divide-y divide-neutral-100 dark:divide-white/5 md:hidden ${isLoading ? "animate-pulse" : ""}`}>
              {days.map((day) => {
                const isToday = day.date === todayYmd;
                return (
                  <li key={day.date} className={`flex gap-3 px-4 py-3 ${isToday ? "bg-[#E4F56C]/15" : ""}`}>
                    <div
                      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl leading-none ${
                        isToday
                          ? "bg-[#E4F56C] text-neutral-950"
                          : day.classes.length
                            ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                            : "bg-neutral-100 text-neutral-400 dark:bg-white/5"
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                        {isToday ? "Today" : fmt(day.date, { weekday: "short" })}
                      </span>
                      <span className="mt-0.5 text-base font-bold">{fmt(day.date, { day: "numeric" })}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 self-center">
                      {day.classes.length === 0 ? (
                        <p className="text-sm text-neutral-300 dark:text-white/20">No classes</p>
                      ) : (
                        day.classes.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`truncate text-xs font-semibold uppercase tracking-wide ${c.cancelled ? "text-red-500 line-through" : "text-neutral-950 dark:text-white"}`}>
                                {c.title}
                              </p>
                              <p className="text-[11px] text-neutral-500">
                                {c.time} · {c.duration} min{c.location ? ` · ${c.location}` : ""}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                c.cancelled ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-white/80"
                              }`}
                            >
                              {c.cancelled ? "Cancelled" : `${c.booked}/${c.capacity}`}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Class mix */}
          {types.length > 0 && (
            <section className={`${card} p-5 sm:p-6`}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-neutral-950 dark:text-white">Class mix</h2>
                <Link href="/tutor/classes" className="text-xs font-semibold text-neutral-500 hover:text-neutral-950 dark:hover:text-white">
                  All classes →
                </Link>
              </div>
              <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                {types.map(([type, count], i) => (
                  <div
                    key={type}
                    className={i === 0 ? "bg-neutral-950 dark:bg-white" : i === 1 ? "bg-[#C8DB3C]" : "bg-neutral-400"}
                    style={{ width: `${(count / Math.max(1, totalClasses)) * 100}%` }}
                    title={`${type}: ${count}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {types.map(([type, count], i) => (
                  <span key={type} className="flex items-center gap-2 text-xs capitalize text-neutral-600 dark:text-white/70">
                    <span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-neutral-950 dark:bg-white" : i === 1 ? "bg-[#C8DB3C]" : "bg-neutral-400"}`} />
                    <span className="font-semibold text-neutral-950 dark:text-white">{count}</span> {type}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
