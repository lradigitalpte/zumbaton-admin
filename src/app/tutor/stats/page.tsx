"use client";

import { useTutorStats } from "@/hooks/useTutor";

const card =
  "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

function Change({ value, unit = "%", dark = false }: { value: number; unit?: string; dark?: boolean }) {
  if (!value) return <span className={`text-[11px] ${dark ? "text-white/50" : "text-neutral-400"}`}>same as last month</span>;
  const up = value > 0;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        up
          ? dark
            ? "bg-[#E4F56C] text-neutral-950"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : dark
            ? "bg-white/10 text-white/70"
            : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(value)}
      {unit} vs last month
    </span>
  );
}

export default function TutorStatsPage() {
  const { data, isLoading, error } = useTutorStats();

  const header = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">My stats</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">How your classes are doing, in Singapore time.</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-5">
        {header}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${card} h-32 animate-pulse`} />)}
        </div>
        <div className={`${card} h-72 animate-pulse`} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-w-0 space-y-5">
        {header}
        <div className={`${card} px-6 py-14 text-center`}>
          <p className="text-base font-semibold text-neutral-950 dark:text-white">Couldn&apos;t load your stats</p>
          <p className="mt-1 text-sm text-neutral-500">{error?.message}</p>
        </div>
      </div>
    );
  }

  const o = data.overview;
  const monthly = data.monthlyPerformance || [];
  const maxBooked = Math.max(1, ...monthly.map((m) => m.booked ?? m.students));
  const types = Object.entries(data.byClassType || {}).sort((a, b) => b[1].classes - a[1].classes);
  const top = data.topStudents || [];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {header}

      {/* This month */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className={`${card} p-4 sm:p-5`}>
          <p className="text-xs font-medium text-neutral-500 dark:text-white/60 sm:text-sm">Classes this month</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">{data.thisMonth.classes}</p>
          <div className="mt-2"><Change value={data.changes.classesChange} /></div>
        </div>
        <div className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-4 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)] sm:p-5">
          <p className="text-xs font-medium sm:text-sm">Students this month</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{data.thisMonth.students}</p>
          <p className="mt-2 text-[11px] font-semibold text-neutral-700">
            {data.changes.studentsChange === 0
              ? "same as last month"
              : `${data.changes.studentsChange > 0 ? "▲" : "▼"} ${Math.abs(data.changes.studentsChange)}% vs last month`}
          </p>
        </div>
        <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-4 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)] sm:p-5">
          <p className="text-xs font-medium text-white/60 sm:text-sm">Attendance this month</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{data.thisMonth.attendanceRate}%</p>
          <div className="mt-2"><Change value={data.changes.attendanceRateChange} unit=" pts" dark /></div>
        </div>
        <div className={`${card} p-4 sm:p-5`}>
          <p className="text-xs font-medium text-neutral-500 dark:text-white/60 sm:text-sm">Classes taught</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">{o.totalClassesTaught}</p>
          <p className="mt-2 text-[11px] text-neutral-400">all time</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Monthly chart */}
        <section className={`${card} min-w-0 p-5 sm:p-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">Last 6 months</h2>
            <div className="flex items-center gap-4 text-[11px] text-neutral-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neutral-200 dark:bg-white/20" /> Booked</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neutral-950 dark:bg-[#E4F56C]" /> Came</span>
            </div>
          </div>
          <div className="mt-5 flex h-48 items-end gap-2 sm:gap-4">
            {monthly.map((m, i) => {
              const booked = m.booked ?? m.students;
              const came = m.attended ?? 0;
              const isCurrent = i === monthly.length - 1;
              return (
                <div key={`${m.month}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] font-semibold tabular-nums text-neutral-700 dark:text-white/80">{booked || ""}</span>
                  <div
                    className="relative w-full max-w-[44px] overflow-hidden rounded-xl bg-neutral-200 dark:bg-white/15"
                    style={{ height: `${(booked / maxBooked) * 100}%`, minHeight: booked ? 6 : 3 }}
                    title={`${m.month}: ${m.classes} classes · ${booked} booked · ${came} came · ${m.attendance}% attendance`}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-xl bg-neutral-950 dark:bg-[#E4F56C]"
                      style={{ height: `${booked ? (came / booked) * 100 : 0}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${isCurrent ? "text-neutral-950 dark:text-white" : "text-neutral-400"}`}>{m.month}</span>
                  <span className="text-[10px] text-neutral-400">{m.classes} cls</span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-5 dark:border-white/5 sm:grid-cols-4">
            {[
              ["Students", o.uniqueStudents],
              ["Avg class size", o.avgClassSize],
              ["Spots filled", `${o.capacityUtilization}%`],
              ["Attendance", `${o.attendanceRate}%`],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-[11px] text-neutral-500">{label}</p>
                <p className="mt-0.5 text-xl font-semibold text-neutral-950 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
          {(o.guestBookings ?? 0) > 0 && (
            <p className="mt-3 text-[11px] text-neutral-400">
              Plus {o.guestBookings} guest/trial booking{o.guestBookings === 1 ? "" : "s"} without a member account (not counted as students).
            </p>
          )}
        </section>

        <aside className="min-w-0 space-y-5">
          {/* Top students */}
          <section className={`${card} overflow-hidden`}>
            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">Top students</h2>
              <p className="text-xs text-neutral-500">By classes attended</p>
            </div>
            {top.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-neutral-400">No attendance recorded yet</p>
            ) : (
              <ol className="mt-3 divide-y divide-neutral-100 dark:divide-white/5">
                {top.map((s, i) => (
                  <li key={s.id ?? `${s.name}-${i}`} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/70"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{s.name}</p>
                      <p className="text-[11px] text-neutral-500">
                        Came {s.classes}
                        {s.noShows ? ` · ${s.noShows} no-show${s.noShows === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-neutral-950 dark:text-white">{s.attendance}%</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* By class type */}
          <section className={`${card} p-5 sm:p-6`}>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">By class type</h2>
            {types.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400">No classes yet</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {types.map(([type, t]) => (
                  <li key={type}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold capitalize text-neutral-950 dark:text-white">{type}</span>
                      <span className="text-xs text-neutral-500">
                        {t.classes} classes · {t.students} students
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                        <div className="h-full rounded-full bg-neutral-950 dark:bg-[#E4F56C]" style={{ width: `${t.attendanceRate}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs font-semibold text-neutral-950 dark:text-white">{t.attendanceRate}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
