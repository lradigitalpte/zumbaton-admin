"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type {
  CombinedAgeGroup,
  DemographicBreakdown,
  MonthlyAudienceTrend,
} from "@/hooks/useReports";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const TRIAL_COLOR = "#10b981";
const MEMBER_COLOR = "#3b82f6";

type MarketingReportChartsProps = {
  trial: DemographicBreakdown;
  members: DemographicBreakdown;
  combinedAgeGroups: CombinedAgeGroup[];
  monthlyTrend: MonthlyAudienceTrend[];
  selectedMonth: number | "all";
  onMonthClick?: (month: number) => void;
};

export default function MarketingReportCharts({
  trial,
  members,
  combinedAgeGroups,
  monthlyTrend,
  selectedMonth,
  onMonthClick,
}: MarketingReportChartsProps) {
  const ageLabels = combinedAgeGroups.map((g) => g.shortLabel);
  const hasAgeData = combinedAgeGroups.some((g) => g.trial > 0 || g.members > 0);

  const comparisonOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    colors: [TRIAL_COLOR, MEMBER_COLOR],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 6,
        dataLabels: { position: "top" },
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -18,
      style: { fontSize: "11px", colors: ["#374151"] },
      formatter: (val: number) => (val > 0 ? String(val) : ""),
    },
    xaxis: {
      categories: ageLabels,
      labels: {
        style: { fontSize: "11px", colors: "#6b7280" },
        rotate: -25,
      },
    },
    yaxis: {
      labels: { style: { fontSize: "11px", colors: "#9ca3af" } },
      title: { text: "People", style: { fontSize: "11px", color: "#9ca3af" } },
    },
    legend: { position: "top", fontSize: "12px" },
    grid: { borderColor: "#f3f4f6", strokeDashArray: 4 },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val: number, opts) => {
          const row = combinedAgeGroups[opts.dataPointIndex];
          if (!row) return String(val);
          const pct = opts.seriesIndex === 0 ? row.trialPct : row.membersPct;
          return `${val} (${pct}% of ${opts.seriesIndex === 0 ? "trials" : "members"} with age)`;
        },
      },
    },
  };

  const trialAgeLabels = trial.ageGroups
    .filter((g) => g.key !== "unknown" && g.count > 0)
    .map((g) => g.label.replace(/ \(.*\)/, ""));
  const trialAgeSeries = trial.ageGroups
    .filter((g) => g.key !== "unknown" && g.count > 0)
    .map((g) => g.count);

  const memberAgeLabels = members.ageGroups
    .filter((g) => g.key !== "unknown" && g.count > 0)
    .map((g) => g.label.replace(/ \(.*\)/, ""));
  const memberAgeSeries = members.ageGroups
    .filter((g) => g.key !== "unknown" && g.count > 0)
    .map((g) => g.count);

  const donutOptions = (labels: string[], title: string): ApexOptions => ({
    chart: { type: "donut", toolbar: { show: false }, fontFamily: "inherit" },
    labels,
    colors: ["#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#64748b"],
    legend: { position: "bottom", fontSize: "11px" },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val.toFixed(0)}%`,
    },
    title: {
      text: title,
      align: "left",
      style: { fontSize: "13px", fontWeight: 600 },
    },
    plotOptions: { pie: { donut: { size: "60%" } } },
  });

  const trendOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "inherit",
      events: {
        dataPointSelection: (_e, _ctx, config) => {
          const month = monthlyTrend[config.dataPointIndex]?.monthNumber;
          if (month) onMonthClick?.(month);
        },
      },
    },
    colors: [TRIAL_COLOR, MEMBER_COLOR],
    plotOptions: { bar: { columnWidth: "45%", borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: monthlyTrend.map((m) => m.month),
      labels: { style: { fontSize: "11px", colors: "#9ca3af" } },
    },
    legend: { position: "top", fontSize: "12px" },
    grid: { borderColor: "#f3f4f6", strokeDashArray: 4 },
  };

  return (
    <div className="space-y-6">
      {hasAgeData && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Age comparison</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Trial guests vs members in the same age bands
          </p>
          <ReactApexChart
            type="bar"
            height={340}
            options={comparisonOptions}
            series={[
              { name: "Trial users", data: combinedAgeGroups.map((g) => g.trial) },
              { name: "Members", data: combinedAgeGroups.map((g) => g.members) },
            ]}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          {trialAgeSeries.length > 0 ? (
            <ReactApexChart
              type="donut"
              height={300}
              options={donutOptions(
                trialAgeLabels,
                `Trial age mix (${trial.withAge} with DOB)`
              )}
              series={trialAgeSeries}
            />
          ) : (
            <p className="text-sm text-gray-500 py-16 text-center">No trial age data</p>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2">
              <p className="text-gray-500">Avg</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">{trial.avgAge ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2">
              <p className="text-gray-500">Median</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">{trial.medianAge ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2">
              <p className="text-gray-500">Kids &lt;13</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">{trial.kidsPct ?? 0}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          {memberAgeSeries.length > 0 ? (
            <ReactApexChart
              type="donut"
              height={300}
              options={donutOptions(
                memberAgeLabels,
                `Member age mix (${members.withAge} with DOB)`
              )}
              series={memberAgeSeries}
            />
          ) : (
            <p className="text-sm text-gray-500 py-16 text-center">No member age data</p>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <p className="text-gray-500">Avg</p>
              <p className="font-bold text-blue-700 dark:text-blue-300">{members.avgAge ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <p className="text-gray-500">Median</p>
              <p className="font-bold text-blue-700 dark:text-blue-300">{members.medianAge ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <p className="text-gray-500">Kids &lt;13</p>
              <p className="font-bold text-blue-700 dark:text-blue-300">{members.kidsPct ?? 0}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Signups over time</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Trial bookings vs new members · click a month to filter
        </p>
        <ReactApexChart
          type="bar"
          height={240}
          options={trendOptions}
          series={[
            { name: "Trial bookings", data: monthlyTrend.map((m) => m.trialBookings) },
            { name: "New members", data: monthlyTrend.map((m) => m.newMembers) },
          ]}
        />
        {selectedMonth !== "all" && (
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
            Stats above are filtered — chart shows full year for context
          </p>
        )}
      </div>
    </div>
  );
}
