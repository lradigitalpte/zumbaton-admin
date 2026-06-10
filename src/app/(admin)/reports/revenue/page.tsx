"use client";

import { useMemo, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useRevenueReport, type RevenueSummary } from "@/hooks/useReports";

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

// Skeleton components
const MetricCardSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
    </div>
    <div className="mt-4">
      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700 mt-2" />
      <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700 mt-2" />
    </div>
  </div>
);

const ChartSkeleton = () => (
  <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 mt-2" />
      </div>
    </div>
    <div className="space-y-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="h-6 w-full rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  </div>
);

const ListSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  </div>
);

const CustomerSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
          <div className="w-8 h-4 rounded bg-gray-200 dark:bg-gray-600" />
          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600" />
          <div className="flex-1">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-600" />
            <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-600 mt-1" />
          </div>
          <div className="text-right">
            <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-600" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden animate-pulse">
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-700 mt-2" />
    </div>
    <table className="w-full">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800/50">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <th key={i} className="px-6 py-3"><div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700" /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <tr key={i}>
            {[1, 2, 3, 4, 5, 6, 7].map((j) => (
              <td key={j} className="px-6 py-4"><div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

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
    setSelectedMonth(monthNumber);
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
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();
  
  const getAvatarColor = (name: string) => {
    const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-pink-500", "bg-cyan-500"];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="space-y-6 relative">
      <PageBreadCrumb pageTitle="Revenue Report" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {showInitialLoading ? "Loading..." : periodLabel}
              {isRefetching && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">Updating...</span>
              )}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Succeeded payments by payment date · click a month row to filter
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
          <button 
            onClick={handleExportReport}
            disabled={showInitialLoading || !data}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {(error as Error)?.message || "Failed to load revenue report"}
        </div>
      )}

      {/* Key Metrics */}
      {showInitialLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {growth > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {growth > 1000 ? '1000%+' : `${growth.toFixed(1)}%`}
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">${totalRevenue.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{periodLabel}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              ${(summary.packageRevenue ?? 0).toLocaleString()} packages · ${(summary.classRevenue ?? 0).toLocaleString()} trials/guest
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Transactions</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalTransactions}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Avg ${totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(0) : 0}/order</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Monthly</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">${avgMonthlyRevenue.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Months with revenue in {periodLabel}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">vs Previous Period</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {periodChange != null
                ? `${periodChange >= 0 ? "+" : ""}$${periodChange.toLocaleString()}`
                : "—"}
            </p>
            {summary.prevPeriodRevenue != null && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Previous: ${summary.prevPeriodRevenue.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Revenue Chart & Package Breakdown */}
      {showInitialLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ChartSkeleton />
          <ListSkeleton />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly Revenue Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Revenue</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{selectedYear} · click a month to filter</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Packages</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Classes</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {monthlyRevenue.map((data) => {
              const isSelected = selectedMonth !== "all" && data.monthNumber === selectedMonth;
              const packagesWidth = data.total > 0 ? (data.packages / maxRevenue) * 100 : 0;
              const classesWidth = data.total > 0 ? (data.classes / maxRevenue) * 100 : 0;
              const formatAmount = (amount: number) => {
                if (amount === 0) return '$0';
                if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
                return `$${amount.toLocaleString()}`;
              };
              
              return (
                <button
                  key={data.month}
                  type="button"
                  onClick={() => data.monthNumber && openMonth(data.monthNumber)}
                  className={`group w-full text-left rounded-lg p-1 -m-1 transition-colors ${
                    isSelected ? "bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{data.month}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">${data.total.toLocaleString()}</span>
                  </div>
                  <div className="flex h-6 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                    {data.packages > 0 && (
                      <div 
                        className="bg-linear-to-r from-emerald-400 to-emerald-500 transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${packagesWidth}%` }}
                      >
                        <span className="text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatAmount(data.packages)}
                        </span>
                      </div>
                    )}
                    {data.classes > 0 && (
                      <div 
                        className="bg-linear-to-r from-blue-400 to-blue-500 transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${classesWidth}%` }}
                      >
                        <span className="text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatAmount(data.classes)}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Package Revenue</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                ${(summary.packageRevenue ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Class Fees</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                ${(summary.classRevenue ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gray-100 dark:bg-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Avg Order Value</p>
              <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                ${summary.avgOrderValue}
              </p>
            </div>
          </div>
        </div>

        {/* Package Breakdown */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Package Sales</h3>
          <div className="space-y-4">
            {packageSales.map((pkg, index) => {
              const colors = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-pink-500"];
              return (
                <div key={pkg.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[140px]">{pkg.name}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">${pkg.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div 
                        className={`h-full ${colors[index]} rounded-full transition-all duration-500`}
                        style={{ width: `${pkg.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{pkg.percentage}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{pkg.sales} sales</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Top Customers & Recent Transactions */}
      {showInitialLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CustomerSkeleton />
          <CustomerSkeleton />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Customers */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Customers</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Spending in {periodLabel}</p>
            </div>
            <button className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">View all</button>
          </div>
          <div className="space-y-3">
            {topCustomers.map((customer, index) => (
              <div
                key={customer.email}
                className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-center w-8 text-sm font-bold text-gray-400">
                  #{index + 1}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getAvatarColor(customer.name)} text-white font-semibold text-sm`}>
                  {getInitials(customer.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {customer.purchases} payment{customer.purchases !== 1 ? "s" : ""}
                    {customer.tokens > 0 ? ` · ${customer.tokens} tokens` : " · trial/guest"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">${customer.spent}</p>
                  <p className="text-xs text-gray-400">in period</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">In {periodLabel}</p>
            </div>
            <button className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">View all</button>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{tx.user}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{tx.package} - {tx.method}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">+${tx.amount}</p>
                  <p className="text-xs text-gray-400">{formatDate(tx.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Monthly Breakdown Table */}
      {showInitialLoading ? (
        <TableSkeleton />
      ) : (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Breakdown</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedYear} · click a row to filter all stats above
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Packages</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Classes</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Transactions</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Avg Order</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {monthlyRevenue.map((row, index) => {
                const prevRevenue = index > 0 ? monthlyRevenue[index - 1].total : 0;
                let growthPct = 0;
                if (index > 0) {
                  if (prevRevenue > 0) {
                    growthPct = ((row.total - prevRevenue) / prevRevenue) * 100;
                    // Cap at reasonable values
                    growthPct = Math.min(growthPct, 1000);
                  } else if (row.total > 0) {
                    // If previous was 0 but current has revenue, show 100% growth
                    growthPct = 100;
                  }
                }
                const isSelected = selectedMonth !== "all" && row.monthNumber === selectedMonth;
                return (
                  <tr
                    key={row.month}
                    onClick={() => row.monthNumber && openMonth(row.monthNumber)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{row.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">${row.packages.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">${row.classes.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-emerald-600 dark:text-emerald-400">${row.total.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row.transactions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">${row.avgOrder}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {index > 0 && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          growthPct >= 0
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {growthPct >= 0 ? "+" : ""}{growthPct > 1000 ? "1000%+" : `${growthPct.toFixed(1)}%`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                <td className="px-6 py-4 text-gray-900 dark:text-white">
                  Total{selectedMonth !== "all" ? ` (${periodLabel})` : ` (${selectedYear})`}
                </td>
                <td className="px-6 py-4 text-right text-gray-900 dark:text-white">${(summary.packageRevenue ?? 0).toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-gray-900 dark:text-white">${(summary.classRevenue ?? 0).toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400">${totalRevenue.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-gray-900 dark:text-white">{totalTransactions}</td>
                <td className="px-6 py-4 text-right text-gray-900 dark:text-white">${summary.avgOrderValue}</td>
                <td className="px-6 py-4 text-right"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
