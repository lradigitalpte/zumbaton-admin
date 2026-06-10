"use client";

import { useMemo, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import BookingReportCharts from "@/components/reports/BookingReportCharts";
import { useAttendanceReport } from "@/hooks/useReports";
import type { BookingTotals, YearMonthSummary } from "@/hooks/useReports";

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

const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-200";
const thR = `${th} text-right`;
const td = "px-4 py-3 text-gray-800 dark:text-gray-100";
const tdR = "px-4 py-3 text-right tabular-nums text-gray-800 dark:text-gray-100";
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

function Num({ value, bold = false }: { value: number; bold?: boolean }) {
  const n = Number(value ?? 0)
  return (
    <span className={n === 0
      ? "text-gray-500 dark:text-gray-400"
      : bold
        ? "font-bold text-gray-900 dark:text-white"
        : "font-medium text-gray-900 dark:text-gray-100"
    }>
      {n}
    </span>
  )
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

  const loading = isLoading || isFetching;
  const ready = !loading && !!data;

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

  const SummaryCards = ({ t, label }: { t: BookingTotals; label: string }) => (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { k: "Classes Scheduled", v: t.totalClasses },
          { k: "Classes Booked", v: t.classesWithBookings },
          { k: "Member Bookings", v: t.memberBookings, sub: "App / token users" },
          { k: "Trial Bookings", v: t.trialBookings, sub: "Guest / website" },
          { k: "Total Bookings", v: t.totalBookings, bold: true },
        ].map((c) => (
          <div key={c.k} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.k}</p>
            <p className={`text-2xl font-bold mt-1 ${c.bold ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
              {ready ? c.v : "—"}
            </p>
            {c.sub && <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>
      {ready && t.totalBookings > 0 && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
          {t.totalBookings} total = {t.memberBookings} member + {t.trialBookings} trial
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Attendance Report" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Booking Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {loading ? `Loading ${loadingLabel}...` : ready ? data.periodLabel : "Select a period"}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-2xl">
            Counts confirmed bookings only (paid or token committed). Member = app/token users.
            Trial = guest website bookings. Token purchases are not counted here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            {(["month", "year"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => setReportScope(s)}
                className={`px-3 py-2 text-sm font-medium capitalize ${reportScope === s ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
              >
                {s}
              </button>
            ))}
          </div>
          {reportScope === "month" && (
            <select
              value={selectedMonth}
              disabled={loading}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}
          <select
            value={selectedYear}
            disabled={loading}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={loading || !data}
            onClick={exportCsv}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Export
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/25 dark:text-blue-200">
          Loading {loadingLabel}...
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {(error as Error)?.message || "Failed to load"}
        </div>
      )}

      {ready && (
        <>
          <SummaryCards
            t={displayTotals}
            label={reportScope === "year" ? `${selectedYear} totals` : `${data.periodLabel} totals`}
          />

          <BookingReportCharts
            yearSummary={yearSummary}
            displayTotals={displayTotals}
            periodLabel={reportScope === "year" ? String(selectedYear) : data.periodLabel}
            reportScope={reportScope}
            selectedMonth={selectedMonth}
            classSessions={sessions}
            onMonthClick={openMonth}
          />

          {reportScope === "month" && (
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Classes in {data.periodLabel}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Member = app/token booking · Trial = guest website booking · Excludes drafts and cancelled
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={bookedOnly} onChange={(e) => setBookedOnly(e.target.checked)} className="rounded" />
                  Only classes with bookings
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-600">
                      <th className={th}>Date</th>
                      <th className={th}>Time</th>
                      <th className={th}>Class</th>
                      <th className={th}>Instructor</th>
                      <th className={thR}>Member</th>
                      <th className={thR}>Trial</th>
                      <th className={thR}>Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                          {bookedOnly
                            ? `No bookings in ${data.periodLabel}`
                            : `No classes scheduled in ${data.periodLabel}`}
                        </td>
                      </tr>
                    ) : (
                      sessions.map((s) => (
                        <tr key={s.id} className={s.hasBookings ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}>
                          <td className={td}>{s.dateLabel}</td>
                          <td className={td}>{s.timeLabel}</td>
                          <td className={`${td} font-medium`}>{s.title}</td>
                          <td className={td}>{s.instructor}</td>
                          <td className={tdR}><Num value={s.memberBookings} /></td>
                          <td className={tdR}><Num value={s.trialBookings} /></td>
                          <td className={tdR}><Num value={s.totalBookings} bold /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedYear} by month</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Click a month to view its class list</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm table-fixed">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-600">
                    <th className={`${th} w-[22%]`}>Month</th>
                    <th className={`${thR} w-[16%]`}>Classes Scheduled</th>
                    <th className={`${thR} w-[14%]`}>Classes Booked</th>
                    <th className={`${thR} w-[14%]`}>Member</th>
                    <th className={`${thR} w-[14%]`}>Trial</th>
                    <th className={`${thR} w-[14%]`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {yearSummary.map((row) => {
                    const selected = reportScope === "month" && row.month === selectedMonth;
                    return (
                      <tr
                        key={row.month}
                        onClick={() => openMonth(row.month)}
                        className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${selected ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500" : ""}`}
                      >
                        <td className={`${td} font-medium`}>
                          {row.monthName}
                          {selected && <span className="ml-2 text-xs text-blue-600">(viewing)</span>}
                        </td>
                        <td className={tdR}><Num value={row.totalClasses} /></td>
                        <td className={tdR}><Num value={row.classesWithBookings} /></td>
                        <td className={tdR}><Num value={row.memberBookings} /></td>
                        <td className={tdR}><Num value={row.trialBookings} /></td>
                        <td className={tdR}><Num value={row.totalBookings} bold /></td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-100 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-500">
                    <td className={`${td} font-bold`}>{selectedYear} Total</td>
                    <td className={tdR}><Num value={yearTotals.totalClasses} bold /></td>
                    <td className={tdR}><Num value={yearTotals.classesWithBookings} bold /></td>
                    <td className={tdR}><Num value={yearTotals.memberBookings} bold /></td>
                    <td className={tdR}><Num value={yearTotals.trialBookings} bold /></td>
                    <td className={tdR}><Num value={yearTotals.totalBookings} bold /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
