"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { BookingTotals, ClassSession, YearMonthSummary } from "@/hooks/useReports";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MEMBER_COLOR = "#3b82f6";
const TRIAL_COLOR = "#10b981";
const SCHEDULED_COLOR = "#94a3b8";
const BOOKED_CLASS_COLOR = "#6366f1";

function shortMonth(name: string) {
  return name.slice(0, 3);
}

function classLabel(s: ClassSession) {
  const title = s.title.length > 22 ? `${s.title.slice(0, 20)}…` : s.title;
  if (s.id === "guest-placeholder-bookings") return "Guest / custom";
  return `${s.dateLabel.replace(/, \d{4}$/, "")} · ${title}`;
}

type BookingReportChartsProps = {
  yearSummary: YearMonthSummary[];
  displayTotals: BookingTotals;
  periodLabel: string;
  reportScope: "month" | "year";
  selectedMonth: number;
  classSessions: ClassSession[];
  onMonthClick?: (month: number) => void;
};

export default function BookingReportCharts({
  yearSummary,
  displayTotals,
  periodLabel,
  reportScope,
  selectedMonth,
  classSessions,
  onMonthClick,
}: BookingReportChartsProps) {
  const months = yearSummary.map((r) => shortMonth(r.monthName));
  const hasYearData = yearSummary.some((r) => r.totalBookings > 0);

  const monthlyStackedOptions: ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      toolbar: { show: false },
      fontFamily: "inherit",
      events: {
        dataPointSelection: (_e, _ctx, config) => {
          const month = yearSummary[config.dataPointIndex]?.month;
          if (month) onMonthClick?.(month);
        },
      },
    },
    colors: [MEMBER_COLOR, TRIAL_COLOR],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last",
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    xaxis: {
      categories: months,
      labels: {
        style: { colors: "#9ca3af", fontSize: "11px" },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#9ca3af", fontSize: "11px" },
        formatter: (v) => Math.floor(v).toString(),
      },
      min: 0,
      forceNiceScale: true,
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      markers: { size: 6 },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (v) => `${v} bookings` },
    },
    annotations: {
      xaxis: reportScope === "month"
        ? [{
            x: shortMonth(yearSummary.find((r) => r.month === selectedMonth)?.monthName || ""),
            borderColor: MEMBER_COLOR,
            strokeDashArray: 0,
            label: {
              text: "Viewing",
              style: { color: "#fff", background: MEMBER_COLOR, fontSize: "10px" },
            },
          }]
        : [],
    },
  };

  const monthlyStackedSeries = [
    { name: "Member", data: yearSummary.map((r) => r.memberBookings) },
    { name: "Trial", data: yearSummary.map((r) => r.trialBookings) },
  ];

  const scheduledData = yearSummary.map((r) => r.totalClasses);
  const bookedClassData = yearSummary.map((r) => r.classesWithBookings);
  const maxBookedClasses = Math.max(...bookedClassData, 1);
  const bookedAxisMax = Math.max(8, Math.ceil(maxBookedClasses * 1.35));

  const classesComboOptions: ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: false },
      fontFamily: "inherit",
      zoom: { enabled: false },
      events: {
        dataPointSelection: (_e, _ctx, config) => {
          const month = yearSummary[config.dataPointIndex]?.month;
          if (month) onMonthClick?.(month);
        },
        markerClick: (_e, _ctx, config) => {
          const month = yearSummary[config.dataPointIndex]?.month;
          if (month) onMonthClick?.(month);
        },
      },
    },
    colors: [SCHEDULED_COLOR, BOOKED_CLASS_COLOR],
    fill: {
      opacity: [0.85, 1],
      type: ["solid", "solid"],
    },
    stroke: { width: [0, 3], curve: "smooth" },
    markers: {
      size: [0, 5],
      strokeWidth: 0,
      hover: { size: 7 },
    },
    dataLabels: {
      enabled: true,
      enabledOnSeries: [1],
      formatter: (val: number) => (Number(val) > 0 ? String(val) : ""),
      style: { fontSize: "10px", fontWeight: 600, colors: [BOOKED_CLASS_COLOR] },
      background: { enabled: false },
      offsetY: -8,
    },
    plotOptions: {
      bar: {
        columnWidth: "45%",
        borderRadius: 4,
        borderRadiusApplication: "end",
      },
    },
    xaxis: {
      categories: months,
      labels: { style: { colors: "#9ca3af", fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      {
        title: {
          text: "Classes scheduled",
          style: { color: "#9ca3af", fontSize: "11px", fontWeight: 500 },
        },
        labels: {
          style: { colors: "#9ca3af", fontSize: "11px" },
          formatter: (v) => Math.floor(v).toString(),
        },
        min: 0,
        forceNiceScale: true,
      },
      {
        opposite: true,
        title: {
          text: "Classes with bookings",
          style: { color: BOOKED_CLASS_COLOR, fontSize: "11px", fontWeight: 600 },
        },
        labels: {
          style: { colors: BOOKED_CLASS_COLOR, fontSize: "11px" },
          formatter: (v) => Math.floor(v).toString(),
        },
        min: 0,
        max: bookedAxisMax,
        tickAmount: Math.min(bookedAxisMax, 6),
      },
    ],
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
      padding: { right: 12 },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
    },
    tooltip: {
      shared: true,
      intersect: false,
      custom: ({ series, dataPointIndex, w }) => {
        const month = w.globals.labels[dataPointIndex] as string;
        const scheduled = series[0]?.[dataPointIndex] ?? 0;
        const booked = series[1]?.[dataPointIndex] ?? 0;
        const fillRate =
          scheduled > 0 ? Math.round((booked / scheduled) * 100) : 0;
        return `<div class="px-3 py-2 text-xs shadow-lg rounded-lg border border-gray-200 bg-white dark:bg-gray-800">
          <p class="font-semibold text-gray-900 dark:text-white mb-1">${month}</p>
          <p class="text-gray-600 dark:text-gray-300">${scheduled} classes scheduled</p>
          <p style="color:${BOOKED_CLASS_COLOR}">${booked} classes with bookings</p>
          <p class="text-gray-500 mt-1">${fillRate}% had at least one booking</p>
          <p class="text-indigo-500 mt-1 text-[10px]">Click to view month</p>
        </div>`;
      },
    },
    annotations: {
      xaxis:
        reportScope === "month"
          ? [
              {
                x: shortMonth(
                  yearSummary.find((r) => r.month === selectedMonth)?.monthName || ""
                ),
                borderColor: BOOKED_CLASS_COLOR,
                strokeDashArray: 4,
                label: {
                  text: "Viewing",
                  style: {
                    color: "#fff",
                    background: BOOKED_CLASS_COLOR,
                    fontSize: "10px",
                  },
                },
              },
            ]
          : [],
    },
  };

  const classesComboSeries = [
    { name: "Classes scheduled", type: "column", data: scheduledData },
    { name: "Classes with bookings", type: "line", data: bookedClassData },
  ];

  const mixTotal = displayTotals.memberBookings + displayTotals.trialBookings;
  const donutOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit" },
    colors: [MEMBER_COLOR, TRIAL_COLOR],
    labels: ["Member", "Trial"],
    dataLabels: {
      enabled: mixTotal > 0,
      formatter: (val: number) => `${Math.round(val)}%`,
      style: { fontSize: "11px", fontWeight: 600 },
    },
    legend: {
      position: "bottom",
      fontSize: "12px",
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            name: { show: true, fontSize: "12px" },
            value: {
              show: true,
              fontSize: "22px",
              fontWeight: 700,
              formatter: (v) => v,
            },
            total: {
              show: true,
              label: "Total",
              fontSize: "12px",
              formatter: () => String(displayTotals.totalBookings),
            },
          },
        },
      },
    },
    tooltip: {
      y: { formatter: (v) => `${v} bookings` },
    },
  };

  const bookedSessions = classSessions
    .filter((s) => s.hasBookings)
    .sort((a, b) => b.totalBookings - a.totalBookings)
    .slice(0, 8);

  const classBarOptions: ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    colors: [MEMBER_COLOR, TRIAL_COLOR],
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "70%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last",
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => (Number(val) > 0 ? String(val) : ""),
      style: { fontSize: "10px", fontWeight: 600, colors: ["#fff"] },
    },
    xaxis: {
      categories: bookedSessions.map(classLabel),
      labels: { style: { colors: "#9ca3af", fontSize: "11px" } },
      min: 0,
    },
    yaxis: {
      labels: {
        style: { colors: "#6b7280", fontSize: "11px", fontWeight: 500 },
        maxWidth: 200,
      },
    },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 4 },
    legend: { position: "top", horizontalAlign: "right", fontSize: "12px" },
    tooltip: {
      y: { formatter: (v) => `${v} bookings` },
    },
  };

  const classBarSeries = [
    { name: "Member", data: bookedSessions.map((s) => s.memberBookings) },
    { name: "Trial", data: bookedSessions.map((s) => s.trialBookings) },
  ];

  const chartHeight = 280;
  const classChartHeight = Math.max(200, bookedSessions.length * 44);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bookings by month</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Member + trial stacked · click a month to drill down
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MEMBER_COLOR }} />
                Member
              </span>
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TRIAL_COLOR }} />
                Trial
              </span>
            </div>
          </div>
          {hasYearData ? (
            <ReactApexChart
              type="bar"
              height={chartHeight}
              options={monthlyStackedOptions}
              series={monthlyStackedSeries}
            />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
              No booking data for this year yet
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Booking mix</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{periodLabel}</p>
          {mixTotal > 0 ? (
            <ReactApexChart
              type="donut"
              height={chartHeight}
              options={donutOptions}
              series={[displayTotals.memberBookings, displayTotals.trialBookings]}
            />
          ) : (
            <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <span>No bookings in this period</span>
              <span className="text-xs">Member 0 · Trial 0</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Classes scheduled vs booked</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Grey bars = scheduled (left scale) · Purple line = with bookings (right scale) · hover or click a month
            </p>
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
              Scheduled
            </span>
            <span className="flex items-center gap-1.5" style={{ color: BOOKED_CLASS_COLOR }}>
              <span className="h-0.5 w-3 rounded" style={{ background: BOOKED_CLASS_COLOR }} />
              With bookings
            </span>
          </div>
        </div>
        <ReactApexChart
          type="line"
          height={280}
          options={classesComboOptions}
          series={classesComboSeries}
        />
      </div>

      {reportScope === "month" && bookedSessions.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Top classes in {periodLabel}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Member vs trial bookings per class
          </p>
          <ReactApexChart
            type="bar"
            height={classChartHeight}
            options={classBarOptions}
            series={classBarSeries}
          />
        </div>
      )}
    </div>
  );
}
