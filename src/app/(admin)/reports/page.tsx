"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StudioMenu from "@/components/ui/StudioMenu";
import { Capsules, PercentRing } from "@/components/dashboard/studio-ui";
import { useReportsOverview, type MonthlyData } from "@/hooks/useReports";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const metric = "flex min-h-[188px] flex-col rounded-[28px] p-5 sm:p-6";

function axisMax(n: number) {
  if (n <= 0) return 4;
  const padded = n * 1.18;
  const pow = Math.pow(10, Math.floor(Math.log10(padded)));
  const normal = padded / pow;
  const nice = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10;
  return nice * pow;
}

function shortMoney(n: number) {
  if (n >= 1000) {
    const thousands = n / 1000;
    const body = thousands >= 10 ? String(Math.round(thousands)) : thousands.toFixed(1).replace(/\.0$/, "");
    return `$${body}k`;
  }
  return `$${Math.round(n)}`;
}

function MonthChart({
  rows,
  getValue,
  format,
  yMax,
  selectedMonth,
  onPick,
  tone,
}: {
  rows: MonthlyData[];
  getValue: (row: MonthlyData) => number;
  format: (value: number) => string;
  yMax: number;
  selectedMonth: number | "all";
  onPick: (month: number) => void;
  tone: "lime" | "ink";
}) {
  const chartH = 220;
  const names = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (
    <div className="overflow-x-auto pt-24 sm:overflow-visible sm:pt-0">
      <div className="min-w-[680px] px-1">
      <div className="flex">
        <div className="flex h-[220px] w-12 shrink-0 flex-col justify-between pr-2 text-right text-[11px] text-neutral-400">
          <span>{format(yMax)}</span>
          <span>{format(yMax / 2)}</span>
          <span>{format(0)}</span>
        </div>
        <div className="relative flex flex-1 justify-between">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px]">
            <div className="absolute inset-x-0 top-0 border-t border-neutral-200 dark:border-white/10" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200 dark:border-white/10" />
            <div className="absolute inset-x-0 bottom-0 border-t border-neutral-200 dark:border-white/10" />
          </div>
          {rows.map((row, index) => {
            const value = getValue(row);
            const empty = value <= 0;
            const barH = empty ? 0 : Math.max(18, (value / yMax) * chartH);
            const selected = selectedMonth !== "all" && row.monthNumber === selectedMonth;
            const fill = tone === "lime"
              ? selected ? "bg-neutral-950 dark:bg-white" : "bg-[#E4F56C]"
              : selected ? "bg-[#E4F56C]" : "bg-neutral-950 dark:bg-white";
            const perClass = row.classes > 0 ? (row.attendance / row.classes).toFixed(1) : "0";
            const tipSide = index === 0 ? "left-0" : index === rows.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <button
                key={`${row.month}-${row.year}`}
                type="button"
                onClick={() => row.monthNumber && onPick(row.monthNumber)}
                className="group relative flex min-w-0 flex-1 flex-col items-center hover:z-30"
              >
                <span className={`pointer-events-none absolute bottom-full z-30 mb-2 w-44 rounded-2xl bg-neutral-950 px-3 py-2.5 text-left text-white opacity-0 shadow-[0_12px_30px_rgba(16,24,40,0.18)] transition-opacity group-hover:opacity-100 ${tipSide}`}>
                  <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-[#E4F56C]">{names[row.monthNumber || 0] || row.month} {row.year}</span>
                  <span className="mt-1 block text-sm font-semibold">${Math.round(row.revenue).toLocaleString()}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/70">{row.attendance} booked · {row.classes} classes</span>
                  <span className="block text-[11px] leading-4 text-white/70">+{row.newUsers} new · {perClass} per class</span>
                </span>
                <span className="relative flex h-[220px] w-full items-end justify-center">
                  {empty ? (
                    <span className="h-[46%] w-7 rounded-[16px] border-2 border-dashed border-neutral-300 group-hover:border-neutral-950 dark:border-white/20" />
                  ) : (
                    <span className={`w-7 rounded-[16px] ${fill}`} style={{ height: barH }} />
                  )}
                  {!empty && (
                    <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold text-neutral-950 dark:text-white" style={{ bottom: barH + 6 }}>
                      {format(value)}
                    </span>
                  )}
                </span>
                <span className={`mt-3 text-xs font-medium ${selected ? "text-neutral-950 dark:text-white" : "text-neutral-500 group-hover:text-neutral-950 dark:group-hover:text-white"}`}>{row.month}</span>
              </button>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}

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

// Default empty data for loading state
const defaultStats = {
  totalUsers: 0,
  activeUsers: 0,
  newUsersThisMonth: 0,
  userGrowth: 0,
  totalTokensSold: 0,
  totalRevenue: 0,
  packageRevenue: 0,
  trialRevenue: 0,
  paymentCount: 0,
  totalBookings: 0,
  revenueGrowth: 0,
  classesThisMonth: 0,
  totalClasses: 0,
  averageAttendance: 0,
  noShowRate: 0,
  topInstructor: "N/A",
  avgClassSize: 0,
  peakDay: "N/A",
  peakTime: "N/A",
};

export default function ReportsPage() {
  const current = getCurrentSgtYearMonth();
  const [selectedYear, setSelectedYear] = useState(current.year);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");

  const { data, isLoading, isFetching, isError, error } = useReportsOverview({
    year: selectedYear,
    month: selectedMonth === "all" ? null : selectedMonth,
  });

  const stats = data?.stats || defaultStats;
  const monthlyData = data?.monthlyData || [];
  const topClasses = data?.topClasses || [];
  const topInstructors = data?.topInstructors || [];
  const recentActivity = data?.recentActivity || [];

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

  const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue), 1);
  const maxBookings = Math.max(...monthlyData.map((d) => d.attendance), 1);

  const openMonth = (monthNumber: number) => {
    setSelectedMonth((current) => (current === monthNumber ? "all" : monthNumber));
  };

  // Export to CSV function
  const handleExportReport = () => {
    if (!data) {
      alert('No data to export');
      return;
    }

    // Prepare CSV content
    const csvRows: string[] = [];

    // Add header section
    csvRows.push('Reports Overview Export');
    csvRows.push(`Generated: ${new Date().toLocaleString()}`);
    csvRows.push(`Period: ${periodLabel}`);
    csvRows.push('');

    // Key Metrics Section
    csvRows.push('KEY METRICS');
    csvRows.push('Metric,Value');
    csvRows.push(`Total Revenue,$${stats.totalRevenue.toLocaleString()}`);
    csvRows.push(`Total Tokens Sold,${stats.totalTokensSold.toLocaleString()}`);
    csvRows.push(`Total Users,${stats.totalUsers.toLocaleString()}`);
    csvRows.push(`Active Users,${stats.activeUsers}`);
    csvRows.push(`New Users This Period,${stats.newUsersThisMonth}`);
    csvRows.push(`User Growth,${stats.userGrowth.toFixed(1)}%`);
    csvRows.push(`Classes Held,${stats.classesThisMonth}`);
    csvRows.push(`Average Attendance,${stats.averageAttendance}%`);
    csvRows.push(`No-Show Rate,${stats.noShowRate}%`);
    const bookingsPerClass = stats.classesThisMonth > 0 ? ((stats.totalBookings ?? 0) / stats.classesThisMonth).toFixed(1) : "0";
    csvRows.push(`Average Class Size,${bookingsPerClass}`);
    csvRows.push(`Peak Day,${stats.peakDay}`);
    csvRows.push(`Peak Time,${stats.peakTime}`);
    csvRows.push('');

    // Monthly Breakdown Section
    csvRows.push('MONTHLY BREAKDOWN');
    csvRows.push('Month,Revenue,Attendance,Classes,New Users,Avg/Class');
    monthlyData.forEach(row => {
      const avgPerClass = row.classes > 0 ? (row.attendance / row.classes).toFixed(1) : '0';
      csvRows.push(
        `"${row.month} ${row.year || new Date().getFullYear()}",$${row.revenue.toLocaleString()},${row.attendance},${row.classes},${row.newUsers},${avgPerClass}`
      );
    });
    csvRows.push('');

    // Top Classes Section
    csvRows.push('TOP CLASSES');
    csvRows.push('Rank,Class Name,Instructor,Attendance,Growth,Revenue');
    topClasses.forEach((cls, index) => {
      csvRows.push(
        `${index + 1},"${cls.name.replace(/"/g, '""')}","${cls.instructor.replace(/"/g, '""')}",${cls.attendance},${cls.growth}%,$${cls.revenue}`
      );
    });
    csvRows.push('');

    // Top Instructors Section
    csvRows.push('TOP INSTRUCTORS');
    csvRows.push('Rank,Name,Classes,Students,Revenue,Rating');
    topInstructors.forEach((instructor, index) => {
      csvRows.push(
        `${index + 1},"${instructor.name.replace(/"/g, '""')}",${instructor.classes},${instructor.students},$${instructor.revenue.toLocaleString()},${instructor.rating ? instructor.rating.toFixed(1) : 'N/A'}`
      );
    });
    csvRows.push('');

    // Recent Activity Section
    csvRows.push('RECENT ACTIVITY');
    csvRows.push('Type,User,Detail,Time,Amount');
    recentActivity.forEach(activity => {
      csvRows.push(
        `"${activity.type}","${activity.user.replace(/"/g, '""')}","${activity.detail.replace(/"/g, '""')}","${activity.time}",${activity.amount ? `$${activity.amount}` : 'N/A'}`
      );
    });

    // Create CSV content
    const csvContent = csvRows.join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `reports-overview-${selectedYear}${selectedMonth !== "all" ? `-${String(selectedMonth).padStart(2, "0")}` : ""}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const money = (value: number) => `$${Math.round(value).toLocaleString()}`;

  const packageRevenue = stats.packageRevenue ?? 0;
  const trialRevenue = stats.trialRevenue ?? 0;
  const paymentCount = stats.paymentCount ?? 0;
  const bookings = stats.totalBookings ?? 0;
  const classesHeld = stats.classesThisMonth;
  const perClass = classesHeld > 0 ? bookings / classesHeld : 0;
  const packageShare = stats.totalRevenue > 0 ? Math.round((packageRevenue / stats.totalRevenue) * 100) : 0;
  const trialShare = stats.totalRevenue > 0 ? Math.round((trialRevenue / stats.totalRevenue) * 100) : 0;
  const stillConfirmed = Math.max(0, 100 - stats.averageAttendance - stats.noShowRate);
  const yearRevenue = monthlyData.reduce((sum, row) => sum + row.revenue, 0);
  const yearBookings = monthlyData.reduce((sum, row) => sum + row.attendance, 0);
  const yearClasses = monthlyData.reduce((sum, row) => sum + row.classes, 0);
  const yearNewUsers = monthlyData.reduce((sum, row) => sum + row.newUsers, 0);
  const bestMonth = monthlyData.reduce<(typeof monthlyData)[number] | null>((best, row) => {
    if (!best || row.revenue > best.revenue) return row;
    return best;
  }, null);
  const leadInstructor = topInstructors[0];

  const headline = selectedMonth === "all"
    ? bestMonth && bestMonth.revenue > 0
      ? `${bestMonth.month} led ${selectedYear} at ${money(bestMonth.revenue)}.`
      : `No payments in ${selectedYear} yet.`
    : `${periodLabel} · ${money(stats.totalRevenue)} from ${paymentCount} payments.`;

  const activityLabel: Record<string, string> = {
    purchase: "Paid",
    class: "Class",
    signup: "Joined",
    noshow: "No-show",
  };
  const memberFill = stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {showInitialLoading ? "Loading studio numbers." : headline}
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
          <button
            onClick={handleExportReport}
            disabled={showInitialLoading || !data}
            className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Export
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-[28px] border border-red-200 bg-white px-6 py-8 text-sm text-red-600 dark:border-red-900 dark:bg-gray-800">
          {(error as Error)?.message || "Could not load reports"}
        </div>
      )}

      {showInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className={`${metric} animate-pulse border border-neutral-200/80 bg-white dark:border-white/10 dark:bg-gray-800`} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
              <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Members</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{stats.totalUsers.toLocaleString()}</p>
              <p className="mt-2 text-xs text-neutral-400">{stats.activeUsers} booked · {stats.newUsersThisMonth} joined</p>
              <Capsules value={memberFill} />
            </div>
            <div className={`${metric} border border-[#d5e45c] bg-[#E4F56C] text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]`}>
              <p className="text-sm font-medium">Revenue</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{money(stats.totalRevenue)}</p>
              <p className="mt-2 text-xs text-neutral-950/55">{paymentCount} payments · {packageShare}% packages</p>
              <Capsules value={packageShare} tone="lime" />
            </div>
            <div className={`${metric} border border-neutral-950 bg-neutral-950 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]`}>
              <p className="text-sm font-medium text-white/70">Checked in</p>
              <div className="mt-5 flex items-end justify-between gap-3">
                <p className="text-4xl font-semibold leading-none tracking-tight">{stats.averageAttendance}%</p>
                <PercentRing value={stats.averageAttendance} tone="light" />
              </div>
              <p className="mt-2 text-xs text-white/55">{stats.noShowRate}% no-show · {stillConfirmed}% still confirmed</p>
              <Capsules value={stats.averageAttendance} tone="light" />
            </div>
            <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
              <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Classes held</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{classesHeld}</p>
              <p className="mt-2 text-xs text-neutral-400">{perClass.toFixed(1)} bookings each · {stats.peakDay} {stats.peakTime}</p>
            </div>
          </div>

          <section className={`${card} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">{selectedYear} revenue</h2>
                <p className="mt-3 text-sm text-neutral-500">Click a month. Click it again for the full year. Dashed columns had no payments.</p>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 dark:bg-white/10 dark:text-white/80">{periodLabel}</span>
            </div>
            <div className="mt-6">
              <MonthChart
                rows={monthlyData}
                getValue={(row) => row.revenue}
                format={shortMoney}
                yMax={axisMax(maxRevenue)}
                selectedMonth={selectedMonth}
                onPick={openMonth}
                tone="lime"
              />
            </div>
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <section className={`${card} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">{selectedYear} bookings</h2>
                  <p className="mt-2 text-sm text-neutral-500">Confirmed, attended, and no-show, counted on the day they were booked.</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-white" />
                  Bookings
                </span>
              </div>
              <div className="mt-6">
                <MonthChart
                  rows={monthlyData}
                  getValue={(row) => row.attendance}
                  format={(value) => String(Math.round(value))}
                  yMax={axisMax(maxBookings)}
                  selectedMonth={selectedMonth}
                  onPick={openMonth}
                  tone="ink"
                />
              </div>
            </section>

            <div className="grid gap-5">
              <section className={`${card} p-5 sm:p-6`}>
                <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Revenue split</h2>
                <div className="mt-5 flex h-14 overflow-hidden rounded-[18px] bg-neutral-100 dark:bg-white/10">
                  <div className="bg-[#E4F56C]" style={{ width: `${packageShare}%` }} />
                  <div className="bg-neutral-950 dark:bg-white" style={{ width: `${trialShare}%` }} />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-neutral-500"><span className="h-2.5 w-2.5 rounded-full bg-[#E4F56C]" /> Packages</span><span className="font-semibold text-neutral-950 dark:text-white">{money(packageRevenue)}</span></p>
                  <p className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-neutral-500"><span className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-white" /> Trials and guests</span><span className="font-semibold text-neutral-950 dark:text-white">{money(trialRevenue)}</span></p>
                </div>
                <p className="mt-4 text-xs text-neutral-400">{stats.totalTokensSold.toLocaleString()} tokens came with package payments. Spending a token later is not new revenue.</p>
              </section>

              <section className={`${card} p-5 sm:p-6`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Recent activity</h2>
                  <Link href="/tokens" className="text-xs font-medium text-neutral-400">View all</Link>
                </div>
                <ul className="mt-2 divide-y divide-neutral-100 dark:divide-white/10">
                  {recentActivity.length === 0 && <li className="py-6 text-sm text-neutral-500">Nothing in this period.</li>}
                  {recentActivity.slice(0, 5).map((activity, index) => (
                    <li key={`${activity.user}-${activity.time}-${index}`} className="flex items-center gap-3 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[11px] font-semibold text-[#E4F56C]">{getInitials(activity.user || "?")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{activity.user}</p>
                        <p className="truncate text-xs text-neutral-500">{activityLabel[activity.type] || activity.type} · {activity.time}</p>
                      </div>
                      {activity.amount ? <span className="text-sm font-semibold text-neutral-950 dark:text-white">+{money(activity.amount)}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={`${card} p-5 sm:p-6`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Top classes</h2>
                <Link href="/classes" className="text-xs font-medium text-neutral-400">View all</Link>
              </div>
              <ul className="mt-2 divide-y divide-neutral-100 dark:divide-white/10">
                {topClasses.length === 0 ? <li className="py-8 text-sm text-neutral-500">No bookings in this period.</li> : topClasses.map((cls, index) => (
                  <li key={`${cls.name}-${index}`} className="flex items-center gap-4 py-3.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index === 0 ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"}`}>{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{cls.name}</p>
                      <p className="truncate text-sm text-neutral-500">{cls.instructor} · {cls.attendance} booked</p>
                    </div>
                    {cls.revenue > 0 && <p className="text-sm font-semibold text-neutral-950 dark:text-white">{money(cls.revenue)}</p>}
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${card} p-5 sm:p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Top instructors</h2>
                  {leadInstructor && <p className="mt-1 text-xs text-neutral-400">{leadInstructor.name} leads this period</p>}
                </div>
                <Link href="/users/staff" className="text-xs font-medium text-neutral-400">View all</Link>
              </div>
              <ul className="mt-2 divide-y divide-neutral-100 dark:divide-white/10">
                {topInstructors.length === 0 ? <li className="py-8 text-sm text-neutral-500">No instructor data in this period.</li> : topInstructors.map((instructor, index) => (
                  <li key={instructor.id || index} className="flex items-center gap-4 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[11px] font-semibold text-[#E4F56C]">{getInitials(instructor.name || "?")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{instructor.name}</p>
                      <p className="text-sm text-neutral-500">{instructor.classes} classes · {instructor.students} students</p>
                    </div>
                    {instructor.revenue > 0 && <p className="text-sm font-semibold text-neutral-950 dark:text-white">{money(instructor.revenue)}</p>}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={`${card} overflow-hidden`}>
            <div className="px-5 py-5 sm:px-6">
              <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Monthly breakdown</h2>
              <p className="mt-1 text-sm text-neutral-500">Dollar change against the month before. Click a row to filter the cards above.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                  <tr>
                    <th className="px-5 py-3">Month</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                    <th className="px-5 py-3 text-right">Vs last month</th>
                    <th className="px-5 py-3 text-right">Bookings</th>
                    <th className="px-5 py-3 text-right">Classes</th>
                    <th className="px-5 py-3 text-right">New</th>
                    <th className="px-5 py-3 text-right">Per class</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                  {monthlyData.map((row, index) => {
                    const prev = index > 0 ? monthlyData[index - 1] : null;
                    const delta = prev ? row.revenue - prev.revenue : null;
                    const isSelected = selectedMonth !== "all" && row.monthNumber === selectedMonth;
                    const share = yearRevenue > 0 ? Math.round((row.revenue / yearRevenue) * 100) : 0;
                    return (
                      <tr key={`${row.month}-${row.year}`} onClick={() => row.monthNumber && openMonth(row.monthNumber)} className={`cursor-pointer ${isSelected ? "bg-[#E4F56C]/40" : "hover:bg-neutral-50 dark:hover:bg-white/5"}`}>
                        <td className="px-5 py-3.5 font-semibold text-neutral-950 dark:text-white">
                          {row.month} {row.year || selectedYear}
                          {share > 0 && <span className="ml-2 text-[11px] font-medium text-neutral-400">{share}%</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-neutral-950 dark:text-white">{money(row.revenue)}</td>
                        <td className={`px-5 py-3.5 text-right ${delta !== null && delta < 0 ? "text-red-600" : "text-neutral-500"}`}>
                          {delta === null ? "—" : prev && prev.revenue === 0 && row.revenue > 0 ? "First" : `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}`}
                        </td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 dark:text-neutral-300">{row.attendance}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 dark:text-neutral-300">{row.classes}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 dark:text-neutral-300">+{row.newUsers}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 dark:text-neutral-300">{row.classes > 0 ? (row.attendance / row.classes).toFixed(1) : "0"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-neutral-200 font-semibold dark:border-white/10">
                    <td className="px-5 py-3.5">Year</td>
                    <td className="px-5 py-3.5 text-right">{money(yearRevenue)}</td>
                    <td />
                    <td className="px-5 py-3.5 text-right">{yearBookings.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right">{yearClasses}</td>
                    <td className="px-5 py-3.5 text-right">{yearNewUsers}</td>
                    <td className="px-5 py-3.5 text-right">{yearClasses > 0 ? (yearBookings / yearClasses).toFixed(1) : "0"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
