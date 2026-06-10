"use client";

import { useMemo, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MarketingReportCharts from "@/components/reports/MarketingReportCharts";
import { useMarketingReport } from "@/hooks/useReports";

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

const emptyBreakdown = {
  segment: "trial" as const,
  total: 0,
  withGender: 0,
  withAge: 0,
  genderCoverage: 0,
  ageCoverage: 0,
  avgAge: null,
  medianAge: null,
  kidsPct: 0,
  gender: [],
  ageGroups: [],
};

export default function MarketingReportPage() {
  const current = getCurrentSgtYearMonth();
  const [selectedYear, setSelectedYear] = useState(current.year);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");

  const { data, isLoading, isFetching, isError, error } = useMarketingReport({
    year: selectedYear,
    month: selectedMonth === "all" ? null : selectedMonth,
  });

  const showInitialLoading = isLoading && !data;
  const isRefetching = isFetching && !isLoading;

  const periodLabel =
    data?.periodLabel ||
    (selectedMonth === "all"
      ? `${selectedYear}`
      : `${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = current.year + 1; y >= current.year - 2; y--) years.push(y);
    return years;
  }, [current.year]);

  const summary = data?.summary;
  const trial = data?.trial || emptyBreakdown;
  const members = data?.members || { ...emptyBreakdown, segment: "member" as const };
  const combinedAgeGroups = data?.combinedAgeGroups || [];
  const monthlyTrend = data?.monthlyTrend || [];

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Marketing Report" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-violet-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {showInitialLoading ? "Loading..." : periodLabel}
              {isRefetching && (
                <span className="ml-2 text-violet-600 dark:text-violet-400">Updating...</span>
              )}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Age breakdown — trial guests vs registered members
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMonth}
            disabled={showInitialLoading}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedMonth(v === "all" ? "all" : parseInt(v, 10));
            }}
            className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="all">All months</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            disabled={showInitialLoading}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {(error as Error)?.message || "Failed to load marketing report"}
        </div>
      )}

      {showInitialLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Trial avg age"
            value={summary?.trialAvgAge ?? "—"}
            sub={`${summary?.trialUsers ?? 0} trials · ${summary?.trialAgeCoverage ?? 0}% have DOB`}
            color="emerald"
            isText
          />
          <MetricCard
            label="Member avg age"
            value={summary?.memberAvgAge ?? "—"}
            sub={`${summary?.members ?? 0} members · ${summary?.memberAgeCoverage ?? 0}% have DOB`}
            color="blue"
            isText
          />
          <MetricCard
            label="Trial kids (<13)"
            value={`${summary?.trialKidsPct ?? 0}%`}
            sub={`Median age ${summary?.trialMedianAge ?? "—"}`}
            color="amber"
            isText
          />
          <MetricCard
            label="Member kids (<13)"
            value={`${summary?.memberKidsPct ?? 0}%`}
            sub={`Median age ${summary?.memberMedianAge ?? "—"}`}
            color="purple"
            isText
          />
        </div>
      )}

      {!showInitialLoading && (
        <>
          <MarketingReportCharts
            trial={trial}
            members={members}
            combinedAgeGroups={combinedAgeGroups}
            monthlyTrend={monthlyTrend}
            selectedMonth={selectedMonth}
            onMonthClick={(month) => setSelectedMonth(month)}
          />

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Age breakdown table</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Side-by-side counts for {periodLabel}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-6 py-3">Age group</th>
                    <th className="px-6 py-3 text-right">Trial users</th>
                    <th className="px-6 py-3 text-right">% of trials</th>
                    <th className="px-6 py-3 text-right">Members</th>
                    <th className="px-6 py-3 text-right">% of members</th>
                    <th className="px-6 py-3 text-right">Combined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {combinedAgeGroups.map((row) => (
                    <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.label}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{row.trial}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-gray-500">{row.trialPct}%</td>
                      <td className="px-6 py-4 text-right tabular-nums text-blue-600 dark:text-blue-400">{row.members}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-gray-500">{row.membersPct}%</td>
                      <td className="px-6 py-4 text-right tabular-nums font-semibold">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                    <td className="px-6 py-4">With known age</td>
                    <td className="px-6 py-4 text-right text-emerald-600">{trial.withAge}</td>
                    <td className="px-6 py-4 text-right text-gray-500">{trial.ageCoverage}%</td>
                    <td className="px-6 py-4 text-right text-blue-600">{members.withAge}</td>
                    <td className="px-6 py-4 text-right text-gray-500">{members.ageCoverage}%</td>
                    <td className="px-6 py-4 text-right">{trial.withAge + members.withAge}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {data?.dataNotes && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">How age is calculated</p>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc list-inside">
                {data.dataNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  sub: string;
  color: "emerald" | "blue" | "purple" | "amber";
  isText?: boolean;
}) {
  const colors = {
    emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="mt-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`font-bold text-gray-900 dark:text-white ${isText ? "text-2xl" : "text-3xl"}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
      </div>
    </div>
  );
}
