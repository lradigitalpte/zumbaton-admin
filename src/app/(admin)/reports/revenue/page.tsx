"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StudioMenu from "@/components/ui/StudioMenu";
import { Capsules } from "@/components/dashboard/studio-ui";
import { useRevenueReport, type MonthlyRevenue, type RevenueSummary } from "@/hooks/useReports";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const metric = "flex min-h-[188px] flex-col rounded-[28px] p-5 sm:p-6";
const FULL_MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

function RevenueChart({
  rows,
  yMax,
  selectedMonth,
  onPick,
}: {
  rows: MonthlyRevenue[];
  yMax: number;
  selectedMonth: number | "all";
  onPick: (month: number) => void;
}) {
  const chartH = 220;
  return (
    <div className="overflow-x-auto pt-28 sm:overflow-visible sm:pt-0">
      <div className="flex min-w-[680px]">
        <div className="flex h-[220px] w-12 shrink-0 flex-col justify-between pr-2 text-right text-[11px] text-neutral-400">
          <span>{shortMoney(yMax)}</span>
          <span>{shortMoney(yMax / 2)}</span>
          <span>$0</span>
        </div>
        <div className="relative flex flex-1 justify-between">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px]">
            <div className="absolute inset-x-0 top-0 border-t border-neutral-200 dark:border-white/10" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200 dark:border-white/10" />
            <div className="absolute inset-x-0 bottom-0 border-t border-neutral-200 dark:border-white/10" />
          </div>
          {rows.map((row, index) => {
            const empty = row.total <= 0;
            const pkgH = empty ? 0 : Math.max(row.packages > 0 ? 8 : 0, (row.packages / yMax) * chartH);
            const classH = empty ? 0 : Math.max(row.classes > 0 ? 8 : 0, (row.classes / yMax) * chartH);
            const selected = selectedMonth !== "all" && row.monthNumber === selectedMonth;
            const tipSide = index === 0 ? "left-0" : index === rows.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <button
                key={`${row.month}-${row.year}`}
                type="button"
                onClick={() => row.monthNumber && onPick(row.monthNumber)}
                className="group relative flex min-w-0 flex-1 flex-col items-center hover:z-30"
              >
                <span className={`pointer-events-none absolute bottom-full z-30 mb-2 w-48 rounded-2xl bg-neutral-950 px-3 py-2.5 text-left text-white opacity-0 shadow-[0_12px_30px_rgba(16,24,40,0.18)] transition-opacity group-hover:opacity-100 ${tipSide}`}>
                  <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-[#E4F56C]">{FULL_MONTHS[row.monthNumber || 0] || row.month} {row.year}</span>
                  <span className="mt-1 block text-sm font-semibold">${Math.round(row.total).toLocaleString()}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/70">Packages ${Math.round(row.packages).toLocaleString()}</span>
                  <span className="block text-[11px] leading-4 text-white/70">Trials ${Math.round(row.classes).toLocaleString()}</span>
                  <span className="block text-[11px] leading-4 text-white/70">{row.transactions} payments · avg ${Math.round(row.avgOrder)}</span>
                </span>
                <span className="relative flex h-[220px] w-full items-end justify-center">
                  {empty ? (
                    <span className="h-[46%] w-7 rounded-[16px] border-2 border-dashed border-neutral-300 group-hover:border-neutral-950 dark:border-white/20" />
                  ) : (
                    <span className={`flex w-7 flex-col justify-end overflow-hidden rounded-[16px] ${selected ? "ring-2 ring-neutral-950 ring-offset-2 dark:ring-white dark:ring-offset-gray-800" : ""}`} style={{ height: pkgH + classH }}>
                      <span className="bg-neutral-950 dark:bg-white" style={{ height: classH }} />
                      <span className="bg-[#E4F56C]" style={{ height: pkgH }} />
                    </span>
                  )}
                  {!empty && (
                    <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold text-neutral-950 dark:text-white" style={{ bottom: pkgH + classH + 6 }}>
                      {shortMoney(row.total)}
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
const defaultSummary: RevenueSummary = {
  totalRevenue: 0,
  totalTransactions: 0,
  avgMonthlyRevenue: 0,
  growth: 0,
  thisMonth: 0,
  lastMonth: 0,
  prevPeriodRevenue: 0,
  avgOrderValue: 0,
  packageRevenue: 0,
  classRevenue: 0,
};

export default function RevenueReportPage() {
  const current = getCurrentSgtYearMonth();
  const [selectedYear, setSelectedYear] = useState(current.year);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");

  const { data, isLoading, isFetching, isError, error } = useRevenueReport({
    year: selectedYear,
    month: selectedMonth === "all" ? null : selectedMonth,
  });
  
  // Use API data or defaults
  const summary = data?.summary || defaultSummary;
  const monthlyRevenue = data?.monthlyRevenue || [];
  const packageSales = data?.packageSales || [];
  const topCustomers = data?.topCustomers || [];
  const recentTransactions = data?.recentTransactions || [];

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

  const totalRevenue = summary.totalRevenue;
  const totalTransactions = summary.totalTransactions;
  const avgMonthlyRevenue = summary.avgMonthlyRevenue;
  const maxRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map(m => m.total), 1) : 1;
  
  // Format growth properly (handle edge cases)
  const growth = isNaN(summary.growth) || !isFinite(summary.growth) 
    ? 0 
    : summary.growth > 1000 
      ? 1000 
      : summary.growth;

  const openMonth = (monthNumber: number) => {
    setSelectedMonth((currentMonth) => (currentMonth === monthNumber ? "all" : monthNumber));
  };

  const periodChange =
    summary.prevPeriodRevenue != null
      ? totalRevenue - summary.prevPeriodRevenue
      : null;

  // Export to CSV function
  const handleExportReport = () => {
    if (!data) {
      alert('No data to export');
      return;
    }

    // Prepare CSV content
    const csvRows: string[] = [];

    // Add header section
    csvRows.push('Revenue Report Export');
    csvRows.push(`Generated: ${new Date().toLocaleString()}`);
    csvRows.push(`Period: ${periodLabel}`);
    csvRows.push('');

    // Summary Section
    csvRows.push('SUMMARY');
    csvRows.push('Metric,Value');
    csvRows.push(`Total Revenue,$${totalRevenue.toLocaleString()}`);
    csvRows.push(`Total Transactions,${totalTransactions}`);
    csvRows.push(`Average Monthly Revenue,$${avgMonthlyRevenue.toLocaleString()}`);
    csvRows.push(`Average Order Value,$${summary.avgOrderValue.toLocaleString()}`);
    csvRows.push(`Growth,${growth.toFixed(1)}%`);
    csvRows.push(`This Month,$${summary.thisMonth.toLocaleString()}`);
    csvRows.push(`Last Month,$${summary.lastMonth.toLocaleString()}`);
    csvRows.push('');

    // Monthly Breakdown Section
    csvRows.push('MONTHLY BREAKDOWN');
    csvRows.push('Month,Packages,Classes,Total,Transactions,Avg Order');
    monthlyRevenue.forEach(row => {
      csvRows.push(
        `"${row.month}",$${row.packages.toLocaleString()},$${row.classes.toLocaleString()},$${row.total.toLocaleString()},${row.transactions},$${row.avgOrder}`
      );
    });
    csvRows.push('');

    // Package Sales Section
    csvRows.push('PACKAGE SALES');
    csvRows.push('Package Name,Sales,Revenue,Percentage');
    packageSales.forEach(pkg => {
      csvRows.push(
        `"${pkg.name.replace(/"/g, '""')}",${pkg.sales},$${pkg.revenue.toLocaleString()},${pkg.percentage}%`
      );
    });
    csvRows.push('');

    // Top Customers Section
    csvRows.push('TOP CUSTOMERS');
    csvRows.push('Rank,Name,Email,Purchases,Tokens,Spent');
    topCustomers.forEach((customer, index) => {
      csvRows.push(
        `${index + 1},"${customer.name.replace(/"/g, '""')}","${customer.email.replace(/"/g, '""')}",${customer.purchases},${customer.tokens},$${customer.spent}`
      );
    });
    csvRows.push('');

    // Recent Transactions Section
    csvRows.push('RECENT TRANSACTIONS');
    csvRows.push('User,Package,Amount,Method,Date');
    recentTransactions.forEach(tx => {
      csvRows.push(
        `"${tx.user.replace(/"/g, '""')}","${tx.package.replace(/"/g, '""')}",$${tx.amount},"${tx.method}","${formatDate(tx.date)}"`
      );
    });

    // Create CSV content
    const csvContent = csvRows.join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue-report-${selectedYear}${selectedMonth !== "all" ? `-${String(selectedMonth).padStart(2, "0")}` : ""}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-SG", {
      timeZone: "Asia/Singapore",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const money = (value: number) => `$${Math.round(value).toLocaleString()}`;
  const packageRevenue = summary.packageRevenue ?? 0;
  const classRevenue = summary.classRevenue ?? 0;
  const packageShare = totalRevenue > 0 ? Math.round((packageRevenue / totalRevenue) * 100) : 0;
  const bestMonth = monthlyRevenue.reduce<MonthlyRevenue | null>((best, row) => (!best || row.total > best.total ? row : best), null);
  const headline = selectedMonth === "all"
    ? bestMonth && bestMonth.total > 0
      ? `${bestMonth.month} led ${selectedYear} at ${money(bestMonth.total)}.`
      : `No payments in ${selectedYear} yet.`
    : `${periodLabel} · ${money(totalRevenue)} from ${totalTransactions} payments.`;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Revenue</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {showInitialLoading ? "Loading payments." : headline}
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
          <button onClick={handleExportReport} disabled={showInitialLoading || !data} className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">Export</button>
        </div>
      </div>

      {isError && (
        <div className="rounded-[28px] border border-red-200 bg-white px-6 py-8 text-sm text-red-600 dark:border-red-900 dark:bg-gray-800">
          {(error as Error)?.message || "Could not load revenue"}
        </div>
      )}

      {showInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className={`${metric} animate-pulse border border-neutral-200/80 bg-white dark:border-white/10 dark:bg-gray-800`} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`${metric} border border-[#d5e45c] bg-[#E4F56C] text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]`}>
              <p className="text-sm font-medium">Revenue</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{money(totalRevenue)}</p>
              <p className="mt-2 text-xs text-neutral-950/55">{packageShare}% packages · {100 - packageShare}% trials</p>
              <Capsules value={packageShare} tone="lime" />
            </div>
            <div className={`${metric} border border-neutral-950 bg-neutral-950 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]`}>
              <p className="text-sm font-medium text-white/70">Payments</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{totalTransactions}</p>
              <p className="mt-2 text-xs text-white/55">Avg {money(summary.avgOrderValue)} each</p>
            </div>
            <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
              <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Avg month</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{money(avgMonthlyRevenue)}</p>
              <p className="mt-2 text-xs text-neutral-400">Only months that had a payment</p>
            </div>
            <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
              <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Vs previous period</p>
              <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{periodChange == null ? "—" : `${periodChange >= 0 ? "+" : "−"}${money(Math.abs(periodChange))}`}</p>
              <p className="mt-2 text-xs text-neutral-400">{summary.prevPeriodRevenue ? `Previous ${money(summary.prevPeriodRevenue)}` : "Nothing collected before this period"}</p>
            </div>
          </div>

          <section className={`${card} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">{selectedYear} revenue</h2>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#E4F56C]" /> Packages</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-white" /> Trials and guests</span>
                </div>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 dark:bg-white/10 dark:text-white/80">{periodLabel}</span>
            </div>
            <p className="mt-3 text-sm text-neutral-500">Click a month to focus the cards. Click it again for the full year. Hover a column for the split.</p>
            <div className="mt-6">
              <RevenueChart rows={monthlyRevenue} yMax={axisMax(maxRevenue)} selectedMonth={selectedMonth} onPick={openMonth} />
            </div>
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <section className={`${card} p-5 sm:p-6`}>
              <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Package sales</h2>
              <p className="mt-1 text-sm text-neutral-500">Share of package revenue in {periodLabel}.</p>
              <ul className="mt-4 space-y-4">
                {packageSales.length === 0 ? <li className="py-6 text-sm text-neutral-500">No package sales in this period.</li> : packageSales.map((pkg) => (
                  <li key={pkg.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{pkg.name}</p>
                      <p className="shrink-0 text-sm font-semibold text-neutral-950 dark:text-white">{money(pkg.revenue)}</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-[#E4F56C]" style={{ width: `${Math.max(pkg.percentage, pkg.revenue > 0 ? 4 : 0)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{pkg.sales} {pkg.sales === 1 ? "sale" : "sales"} · {pkg.percentage}%</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${card} p-5 sm:p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Top customers</h2>
                  <p className="mt-1 text-sm text-neutral-500">What they paid in {periodLabel}.</p>
                </div>
                <Link href="/users" className="text-xs font-medium text-neutral-400">View all</Link>
              </div>
              <ul className="mt-2 divide-y divide-neutral-100 dark:divide-white/10">
                {topCustomers.length === 0 ? <li className="py-8 text-sm text-neutral-500">No payments in this period.</li> : topCustomers.map((customer, index) => (
                  <li key={`${customer.email}-${index}`} className="flex items-center gap-4 py-3.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index === 0 ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-950 text-[#E4F56C]"}`}>{index + 1}</span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700 dark:bg-white/10 dark:text-white">{getInitials(customer.name || "?")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{customer.name}</p>
                      <p className="truncate text-sm text-neutral-500">{customer.purchases} {customer.purchases === 1 ? "payment" : "payments"} · {customer.tokens} tokens</p>
                    </div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">{money(customer.spent)}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={`${card} p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Recent payments</h2>
              <Link href="/tokens" className="text-xs font-medium text-neutral-400">View all</Link>
            </div>
            <ul className="mt-2 divide-y divide-neutral-100 dark:divide-white/10">
              {recentTransactions.length === 0 ? <li className="py-8 text-sm text-neutral-500">No payments in this period.</li> : recentTransactions.map((tx) => (
                <li key={tx.id} className="flex items-center gap-4 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[11px] font-semibold text-[#E4F56C]">{getInitials(tx.user || "?")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{tx.user}</p>
                    <p className="truncate text-sm text-neutral-500">{tx.package} · {tx.method}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">+{money(tx.amount)}</p>
                    <p className="text-xs text-neutral-400">{formatDate(tx.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${card} overflow-hidden`}>
            <div className="px-5 py-5 sm:px-6">
              <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Monthly breakdown</h2>
              <p className="mt-1 text-sm text-neutral-500">Dollar change against the month before. Click a row to filter.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-y border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                  <tr>
                    <th className="px-5 py-3">Month</th>
                    <th className="px-5 py-3 text-right">Packages</th>
                    <th className="px-5 py-3 text-right">Trials</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">Vs last month</th>
                    <th className="px-5 py-3 text-right">Payments</th>
                    <th className="px-5 py-3 text-right">Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                  {monthlyRevenue.map((row, index) => {
                    const prev = index > 0 ? monthlyRevenue[index - 1] : null;
                    const delta = prev ? row.total - prev.total : null;
                    const selected = selectedMonth !== "all" && row.monthNumber === selectedMonth;
                    return (
                      <tr key={`${row.month}-${row.year}`} onClick={() => row.monthNumber && openMonth(row.monthNumber)} className={`cursor-pointer ${selected ? "bg-[#E4F56C]/40" : "hover:bg-neutral-50 dark:hover:bg-white/5"}`}>
                        <td className="px-5 py-3.5 font-semibold text-neutral-950 dark:text-white">{FULL_MONTHS[row.monthNumber || 0] || row.month} {row.year || selectedYear}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 dark:text-neutral-300">{money(row.packages)}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 dark:text-neutral-300">{money(row.classes)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-neutral-950 dark:text-white">{money(row.total)}</td>
                        <td className={`px-5 py-3.5 text-right ${delta !== null && delta < 0 ? "text-red-600" : "text-neutral-500"}`}>
                          {delta === null ? "—" : prev && prev.total === 0 && row.total > 0 ? "First" : `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}`}
                        </td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 dark:text-neutral-300">{row.transactions}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 dark:text-neutral-300">{money(row.avgOrder)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-neutral-200 font-semibold dark:border-white/10">
                    <td className="px-5 py-3.5">Year</td>
                    <td className="px-5 py-3.5 text-right">{money(monthlyRevenue.reduce((sum, row) => sum + row.packages, 0))}</td>
                    <td className="px-5 py-3.5 text-right">{money(monthlyRevenue.reduce((sum, row) => sum + row.classes, 0))}</td>
                    <td className="px-5 py-3.5 text-right">{money(monthlyRevenue.reduce((sum, row) => sum + row.total, 0))}</td>
                    <td />
                    <td className="px-5 py-3.5 text-right">{monthlyRevenue.reduce((sum, row) => sum + row.transactions, 0)}</td>
                    <td className="px-5 py-3.5 text-right">{money(summary.avgOrderValue)}</td>
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
