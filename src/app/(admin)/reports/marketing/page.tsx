"use client";

import { useMemo, useState } from "react";
import StudioMenu from "@/components/ui/StudioMenu";
import MarketingReportCharts from "@/components/reports/MarketingReportCharts";
import { useMarketingReport } from "@/hooks/useReports";

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
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Marketing</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            {showInitialLoading ? "Loading ages." : `${periodLabel}. Trial guests beside members who joined in the same period.`}
            {isRefetching ? " Updating…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <StudioMenu
              size="sm"
              value={selectedMonth === "all" ? "all" : String(selectedMonth)}
              disabled={showInitialLoading}
              onChange={(value) => setSelectedMonth(value === "all" ? "all" : parseInt(value, 10))}
              placeholder="Month"
              options={[{ value: "all", label: "All months" }, ...MONTHS.map((m) => ({ value: String(m.value), label: m.label }))]}
            />
          </div>
          <div className="w-28">
            <StudioMenu
              size="sm"
              value={String(selectedYear)}
              disabled={showInitialLoading}
              onChange={(value) => setSelectedYear(parseInt(value, 10))}
              placeholder="Year"
              options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          {selectedMonth !== "all" && (
            <button onClick={() => setSelectedMonth("all")} className="rounded-full bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:bg-white/10 dark:text-white">All months</button>
          )}
        </div>
      </div>

      {isError && (
        <div className="rounded-[28px] border border-red-200 bg-white px-6 py-8 text-sm text-red-600 dark:border-red-900 dark:bg-gray-800">
          {(error as Error)?.message || "Could not load marketing"}
        </div>
      )}

      {showInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className={`${metric} animate-pulse border border-neutral-200/80 bg-white dark:border-white/10 dark:bg-gray-800`} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`${metric} border border-[#d5e45c] bg-[#E4F56C] text-neutral-950`}>
              <p className="text-sm font-medium">Trial average age</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{summary?.trialAvgAge ?? "—"}</p>
              <p className="mt-2 text-xs text-neutral-950/60">{summary?.trialUsers ?? 0} trials · {summary?.trialAgeCoverage ?? 0}% have a date of birth</p>
            </div>
            <div className={`${metric} border border-neutral-950 bg-neutral-950 text-white`}>
              <p className="text-sm font-medium text-white/70">Member average age</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{summary?.memberAvgAge ?? "—"}</p>
              <p className="mt-2 text-xs text-white/55">{summary?.members ?? 0} members · {summary?.memberAgeCoverage ?? 0}% have a date of birth</p>
            </div>
            <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
              <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Trial kids under 13</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{summary?.trialKidsPct ?? 0}%</p>
              <p className="mt-2 text-xs text-neutral-400">Median age {summary?.trialMedianAge ?? "—"}</p>
            </div>
            <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
              <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Member kids under 13</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{summary?.memberKidsPct ?? 0}%</p>
              <p className="mt-2 text-xs text-neutral-400">Median age {summary?.memberMedianAge ?? "—"}</p>
            </div>
          </div>

          <MarketingReportCharts
            combinedAgeGroups={combinedAgeGroups}
            monthlyTrend={monthlyTrend}
            selectedMonth={selectedMonth}
            onMonthClick={(month) => setSelectedMonth((currentMonth) => (currentMonth === month ? "all" : month))}
          />

          <section className={`${card} overflow-hidden`}>
            <div className="px-5 py-5 sm:px-6">
              <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Age breakdown</h2>
              <p className="mt-1 text-sm text-neutral-500">Side by side for {periodLabel}. Percents are of people whose age is known.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-y border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                  <tr>
                    <th className="px-5 py-3">Age group</th>
                    <th className="px-5 py-3 text-right">Trials</th>
                    <th className="px-5 py-3 text-right">Trial share</th>
                    <th className="px-5 py-3 text-right">Members</th>
                    <th className="px-5 py-3 text-right">Member share</th>
                    <th className="px-5 py-3 text-right">Combined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                  {combinedAgeGroups.map((row) => (
                    <tr key={row.key}>
                      <td className="px-5 py-3.5 font-semibold text-neutral-950 dark:text-white">{row.label}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-950 dark:text-white">{row.trial}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-500">{row.trialPct}%</td>
                      <td className="px-5 py-3.5 text-right text-neutral-950 dark:text-white">{row.members}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-500">{row.membersPct}%</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-neutral-950 dark:text-white">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-neutral-200 font-semibold dark:border-white/10">
                    <td className="px-5 py-3.5">With known age</td>
                    <td className="px-5 py-3.5 text-right">{trial.withAge}</td>
                    <td className="px-5 py-3.5 text-right text-neutral-500">{trial.ageCoverage}%</td>
                    <td className="px-5 py-3.5 text-right">{members.withAge}</td>
                    <td className="px-5 py-3.5 text-right text-neutral-500">{members.ageCoverage}%</td>
                    <td className="px-5 py-3.5 text-right">{trial.withAge + members.withAge}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {data?.dataNotes && (
            <section className={`${card} px-5 py-5 sm:px-6`}>
              <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">How age is counted</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-neutral-500">
                {data.dataNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
