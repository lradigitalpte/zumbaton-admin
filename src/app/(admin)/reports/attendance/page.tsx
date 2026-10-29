"use client";

import { useMemo, useState } from "react";
import StudioMenu from "@/components/ui/StudioMenu";
import BookingReportCharts from "@/components/reports/BookingReportCharts";
import { useAttendanceReport } from "@/hooks/useReports";
import type { BookingTotals, YearMonthSummary } from "@/hooks/useReports";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const metric = "flex min-h-[168px] flex-col rounded-[28px] p-5 sm:p-6";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const emptyTotals: BookingTotals = {
  totalClasses: 0,
  classesWithBookings: 0,
  totalBookings: 0,
  memberBookings: 0,
  trialBookings: 0,
};

function getCurrentSgtYearMonth() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  return {
    year: parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10),
    month: parseInt(parts.find((p) => p.type === "month")?.value || "1", 10),
  };
}

function normalizeRow(row: YearMonthSummary): YearMonthSummary {
  const totalBookings = Number(row.totalBookings ?? 0)
  const trialBookings = Number(row.trialBookings ?? 0)
  const memberBookings = Number(
    row.memberBookings ?? Math.max(0, totalBookings - trialBookings)
  )

  return {
    month: row.month,
    monthName: row.monthName,
    year: row.year,
    totalClasses: Number(row.totalClasses ?? 0),
    classesWithBookings: Number(row.classesWithBookings ?? 0),
    totalBookings,
    memberBookings,
    trialBookings,
  }
}

function sumRows(rows: YearMonthSummary[]): BookingTotals {
  return rows.reduce(
    (acc, row) => ({
      totalClasses: acc.totalClasses + row.totalClasses,
      classesWithBookings: acc.classesWithBookings + row.classesWithBookings,
      totalBookings: acc.totalBookings + row.totalBookings,
      memberBookings: acc.memberBookings + row.memberBookings,
      trialBookings: acc.trialBookings + row.trialBookings,
    }),
    { ...emptyTotals }
  )
}

function Count({ value, strong = false }: { value: number; strong?: boolean }) {
  const n = Number(value ?? 0);
  return (
    <span className={n === 0 ? "text-neutral-400" : strong ? "font-semibold text-neutral-950 dark:text-white" : "text-neutral-950 dark:text-white"}>
      {n}
    </span>
  );
}

export default function AttendanceReportPage() {
  const current = getCurrentSgtYearMonth();
  const [reportScope, setReportScope] = useState<"month" | "year">("month");
  const [selectedYear, setSelectedYear] = useState(current.year);
  const [selectedMonth, setSelectedMonth] = useState(current.month);
  const [bookedOnly, setBookedOnly] = useState(true);

  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || "";
  const loadingLabel = reportScope === "year" ? `${selectedYear}` : `${monthLabel} ${selectedYear}`;

  const { data, isLoading, isFetching, isError, error } = useAttendanceReport({
    year: selectedYear,
    month: selectedMonth,
    scope: reportScope,
  });

  const showInitialLoading = isLoading && !data;
  const isRefetching = isFetching && !isLoading;

  const totals = data?.totals ?? emptyTotals;
  const classSessions = data?.classSessions ?? [];
  const yearSummary = useMemo(
    () => (data?.yearSummary ?? []).map(normalizeRow),
    [data?.yearSummary]
  );
  const yearTotals = useMemo(() => {
    const fromApi = data?.yearTotals
    if (fromApi && fromApi.totalBookings > 0) {
      return {
        totalClasses: Number(fromApi.totalClasses ?? 0),
        classesWithBookings: Number(fromApi.classesWithBookings ?? 0),
        totalBookings: Number(fromApi.totalBookings ?? 0),
        memberBookings: Number(fromApi.memberBookings ?? 0),
        trialBookings: Number(fromApi.trialBookings ?? 0),
      }
    }
    return sumRows(yearSummary)
  }, [data?.yearTotals, yearSummary]);
  const displayTotals = reportScope === "year" ? yearTotals : {
    totalClasses: Number(totals.totalClasses ?? 0),
    classesWithBookings: Number(totals.classesWithBookings ?? 0),
    totalBookings: Number(totals.totalBookings ?? 0),
    memberBookings: Number(totals.memberBookings ?? Math.max(0, (totals.totalBookings ?? 0) - (totals.trialBookings ?? 0))),
    trialBookings: Number(totals.trialBookings ?? 0),
  };

  const sessions = useMemo(() => {
    if (!bookedOnly) return classSessions;
    return classSessions.filter((s) => s.hasBookings);
  }, [classSessions, bookedOnly]);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = current.year; y >= current.year - 2; y--) years.push(y);
    return years;
  }, [current.year]);

  const openMonth = (month: number) => {
    setReportScope("month");
    setSelectedMonth(month);
  };

  const exportCsv = () => {
    if (!data) return;
    const lines =
      reportScope === "year"
        ? [
            `Booking Report ${selectedYear}`,
            "Month,Classes Scheduled,Classes with Bookings,Member Bookings,Trial Bookings,Total Bookings",
            ...yearSummary.map((r) =>
              `${r.monthName},${r.totalClasses},${r.classesWithBookings},${r.memberBookings},${r.trialBookings},${r.totalBookings}`
            ),
          ]
        : [
            `Booking Report ${data.periodLabel}`,
            `Classes Scheduled,${totals.totalClasses}`,
            `Classes with Bookings,${totals.classesWithBookings}`,
            `Member Bookings,${totals.memberBookings}`,
            `Trial Bookings,${totals.trialBookings}`,
            `Total Bookings,${totals.totalBookings}`,
            "",
            "Date,Time,Class,Instructor,Member,Trial,Total",
            ...sessions.map((s) =>
              `"${s.dateLabel}","${s.timeLabel}","${s.title}","${s.instructor}",${s.memberBookings},${s.trialBookings},${s.totalBookings}`
            ),
          ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bookings-${selectedYear}${reportScope === "month" ? `-${String(selectedMonth).padStart(2, "0")}` : ""}.csv`;
    a.click();
  };

  const memberShare = displayTotals.totalBookings > 0
    ? Math.round((displayTotals.memberBookings / displayTotals.totalBookings) * 100)
    : 0;
  const trialShare = displayTotals.totalBookings > 0
    ? Math.round((displayTotals.trialBookings / displayTotals.totalBookings) * 100)
    : 0;
  const classShare = displayTotals.totalClasses > 0
    ? Math.round((displayTotals.classesWithBookings / displayTotals.totalClasses) * 100)
    : 0;
  const periodName = reportScope === "year" ? String(selectedYear) : (data?.periodLabel || loadingLabel);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Bookings</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            {showInitialLoading ? `Loading ${loadingLabel}.` : `${periodName}. Confirmed bookings only. Members are app and token users. Trials are guest website bookings.`}
            {isRefetching ? " Updating…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-neutral-100 p-1 dark:bg-white/10">
            {(["month", "year"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setReportScope(scope)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${reportScope === scope ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "text-neutral-500"}`}
              >
                {scope}
              </button>
            ))}
          </div>
          {reportScope === "month" && (
            <div className="w-40">
              <StudioMenu
                size="sm"
                value={String(selectedMonth)}
                onChange={(value) => setSelectedMonth(parseInt(value, 10))}
                placeholder="Month"
                options={MONTHS.map((month) => ({ value: String(month.value), label: month.label }))}
              />
            </div>
          )}
          <div className="w-28">
            <StudioMenu
              size="sm"
              value={String(selectedYear)}
              onChange={(value) => setSelectedYear(parseInt(value, 10))}
              placeholder="Year"
              options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
            />
          </div>
          <button
            type="button"
            disabled={!data}
            onClick={exportCsv}
            className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
          >
            Export
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-[28px] border border-red-200 bg-white px-6 py-8 text-sm text-red-600 dark:border-red-900 dark:bg-gray-800">
          {(error as Error)?.message || "Could not load bookings"}
        </div>
      )}

      {showInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className={`${metric} animate-pulse border border-neutral-200/80 bg-white dark:border-white/10 dark:bg-gray-800`} />)}
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`${metric} border border-[#d5e45c] bg-[#E4F56C] text-neutral-950`}>
              <p className="text-sm font-medium">Bookings</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{displayTotals.totalBookings}</p>
              <p className="mt-2 text-xs text-neutral-950/60">{displayTotals.memberBookings} members + {displayTotals.trialBookings} trials</p>
            </div>
            <div className={`${metric} border border-neutral-950 bg-neutral-950 text-white`}>
              <p className="text-sm font-medium text-white/70">Members</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{displayTotals.memberBookings}</p>
              <p className="mt-2 text-xs text-white/50">{memberShare}% of bookings · app and token users</p>
            </div>
            <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
              <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Trials</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{displayTotals.trialBookings}</p>
              <p className="mt-2 text-xs text-neutral-400">{trialShare}% of bookings · guest website</p>
            </div>
            <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
              <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Classes booked</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{displayTotals.classesWithBookings}</p>
              <p className="mt-2 text-xs text-neutral-400">{classShare}% of {displayTotals.totalClasses} scheduled</p>
            </div>
          </div>

          <BookingReportCharts
            yearSummary={yearSummary}
            displayTotals={displayTotals}
            periodLabel={periodName}
            reportScope={reportScope}
            selectedMonth={selectedMonth}
            classSessions={sessions}
            onMonthClick={openMonth}
          />

          {reportScope === "month" && (
            <section className={`${card} overflow-hidden`}>
              <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Classes in {data.periodLabel}</h2>
                  <p className="mt-1 text-sm text-neutral-500">Drafts and cancelled classes are left out.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookedOnly((current) => !current)}
                  className={`rounded-full px-3.5 py-2 text-xs font-semibold ${bookedOnly ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"}`}
                >
                  {bookedOnly ? "With bookings" : "All classes"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-y border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Class</th>
                      <th className="px-5 py-3">Instructor</th>
                      <th className="px-5 py-3 text-right">Member</th>
                      <th className="px-5 py-3 text-right">Trial</th>
                      <th className="px-5 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-neutral-500">
                          {bookedOnly ? `No bookings in ${data.periodLabel}` : `No classes scheduled in ${data.periodLabel}`}
                        </td>
                      </tr>
                    ) : (
                      sessions.map((session) => (
                        <tr key={session.id}>
                          <td className="px-5 py-3.5 text-neutral-600 dark:text-white/70">{session.dateLabel}</td>
                          <td className="px-5 py-3.5 text-neutral-600 dark:text-white/70">{session.timeLabel}</td>
                          <td className="px-5 py-3.5 font-semibold text-neutral-950 dark:text-white">{session.title}</td>
                          <td className="px-5 py-3.5 text-neutral-600 dark:text-white/70">{session.instructor}</td>
                          <td className="px-5 py-3.5 text-right"><Count value={session.memberBookings} /></td>
                          <td className="px-5 py-3.5 text-right"><Count value={session.trialBookings} /></td>
                          <td className="px-5 py-3.5 text-right"><Count value={session.totalBookings} strong /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className={`${card} overflow-hidden`}>
            <div className="px-5 py-5 sm:px-6">
              <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">{selectedYear} by month</h2>
              <p className="mt-1 text-sm text-neutral-500">Click a month to open its class list.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-y border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                  <tr>
                    <th className="px-5 py-3">Month</th>
                    <th className="px-5 py-3 text-right">Scheduled</th>
                    <th className="px-5 py-3 text-right">Booked</th>
                    <th className="px-5 py-3 text-right">Member</th>
                    <th className="px-5 py-3 text-right">Trial</th>
                    <th className="px-5 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                  {yearSummary.map((row) => {
                    const selected = reportScope === "month" && row.month === selectedMonth;
                    return (
                      <tr
                        key={row.month}
                        onClick={() => openMonth(row.month)}
                        className={`cursor-pointer ${selected ? "bg-[#E4F56C]/40" : "hover:bg-neutral-50 dark:hover:bg-white/5"}`}
                      >
                        <td className="px-5 py-3.5 font-semibold text-neutral-950 dark:text-white">
                          {row.monthName}
                          {selected && <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Viewing</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right"><Count value={row.totalClasses} /></td>
                        <td className="px-5 py-3.5 text-right"><Count value={row.classesWithBookings} /></td>
                        <td className="px-5 py-3.5 text-right"><Count value={row.memberBookings} /></td>
                        <td className="px-5 py-3.5 text-right"><Count value={row.trialBookings} /></td>
                        <td className="px-5 py-3.5 text-right"><Count value={row.totalBookings} strong /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-neutral-200 font-semibold dark:border-white/10">
                    <td className="px-5 py-3.5">{selectedYear} total</td>
                    <td className="px-5 py-3.5 text-right">{yearTotals.totalClasses}</td>
                    <td className="px-5 py-3.5 text-right">{yearTotals.classesWithBookings}</td>
                    <td className="px-5 py-3.5 text-right">{yearTotals.memberBookings}</td>
                    <td className="px-5 py-3.5 text-right">{yearTotals.trialBookings}</td>
                    <td className="px-5 py-3.5 text-right">{yearTotals.totalBookings}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className={`${card} px-5 py-5 sm:px-6`}>
            <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">How bookings are counted</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-500">
              <li>Only confirmed bookings are counted, whether they were paid or a token was committed.</li>
              <li>Members are people booking from the app or with a token. Trials are guest bookings from the website.</li>
              <li>Token purchases are not bookings, so they do not appear here.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
