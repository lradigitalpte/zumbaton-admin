"use client";

import { useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useReportsOverview } from "@/hooks/useReports";

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
        <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 mt-2" />
      </div>
    </div>
    <div className="space-y-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-10 h-4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="w-16 h-4 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  </div>
);

const ActivitySkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-700 mt-1" />
            <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 mt-1" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ListItemSkeleton = () => (
  <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 animate-pulse">
    <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-600" />
    <div className="flex-1">
      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-600" />
      <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-600 mt-1" />
    </div>
    <div className="text-right">
      <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-600" />
      <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-600 mt-1" />
    </div>
  </div>
);

const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" /></td>
    <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></td>
    <td className="px-6 py-4"><div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></td>
    <td className="px-6 py-4"><div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></td>
    <td className="px-6 py-4"><div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></td>
    <td className="px-6 py-4"><div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></td>
  </tr>
);

// Default empty data for loading state
const defaultStats = {
  totalUsers: 0,
  activeUsers: 0,
  newUsersThisMonth: 0,
  userGrowth: 0,
  totalTokensSold: 0,
  totalRevenue: 0,
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
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter" | "year">("month");
  
  // Fetch real data from API
  const { data, isLoading, isFetching, error } = useReportsOverview(dateRange);
  
  // Use API data or defaults
  const stats = data?.stats || defaultStats;
  const monthlyData = data?.monthlyData || [];
  const topClasses = data?.topClasses || [];
  const topInstructors = data?.topInstructors || [];
  const recentActivity = data?.recentActivity || [];
  
  // Show loading when fetching (even if we have cached data)
  const showLoading = isLoading || isFetching;

  const maxRevenue = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.revenue)) : 1;

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
    csvRows.push(`Date Range: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`);
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
    csvRows.push(`Average Class Size,${stats.avgClassSize}`);
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
    
    const rangeLabel = dateRange.charAt(0).toUpperCase() + dateRange.slice(1);
    link.setAttribute('href', url);
    link.setAttribute('download', `reports-overview-${rangeLabel.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();
  
  const getAvatarColor = (name: string) => {
    const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-pink-500", "bg-cyan-500"];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case "class":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        );
      case "signup":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
        );
      case "noshow":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {showLoading && data && (
        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
          <div className="flex flex-col items-center gap-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg px-6 py-4 border border-gray-200 dark:border-gray-700">
            <svg className="h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Loading data...</p>
          </div>
        </div>
      )}
      
      <PageBreadCrumb pageTitle="Reports Overview" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports Overview</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Business insights and performance metrics
              {showLoading && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden relative">
            {showLoading && (
              <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                <svg className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
            {(["week", "month", "quarter", "year"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                disabled={showLoading}
                className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
                  dateRange === range
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                } ${showLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <button 
            onClick={handleExportReport}
            disabled={showLoading || !data}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics - Row 1 */}
      {showLoading && !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {stats.revenueGrowth > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {stats.revenueGrowth > 1000 ? '1000%+' : `${stats.revenueGrowth.toFixed(1)}%`}
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">${stats.totalRevenue.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{stats.totalTokensSold.toLocaleString()} tokens sold</p>
          </div>
        </div>

        {/* Total Users */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            {stats.userGrowth > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {stats.userGrowth > 1000 ? '1000%+' : `${stats.userGrowth.toFixed(1)}%`}
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalUsers.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{stats.activeUsers} active this month</p>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {stats.noShowRate}% no-show
            </span>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Attendance Rate</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.averageAttendance}%</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Avg {stats.avgClassSize} per class</p>
          </div>
        </div>

        {/* Classes */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {dateRange === 'week' ? 'This week' : 
               dateRange === 'quarter' ? 'This quarter' : 
               dateRange === 'year' ? 'This year' : 
               'This month'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Classes Held</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.classesThisMonth}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Peak: {stats.peakDay} {stats.peakTime}</p>
          </div>
        </div>
      </div>
      )}

      {/* Revenue Chart & Activity Feed */}
      {showLoading && !data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ChartSkeleton />
          <ActivitySkeleton />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Revenue Trend</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly revenue over time</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-indigo-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Attendance</span>
              </div>
            </div>
          </div>
          
          {/* Simple Bar Chart */}
          <div className="space-y-4">
            {monthlyData.map((data) => (
              <div key={data.month} className="flex items-center gap-4">
                <div className="w-10 text-sm font-medium text-gray-600 dark:text-gray-400">{data.month}</div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                    <div 
                      className="absolute inset-y-0 left-0 bg-linear-to-r from-indigo-500 to-purple-500 rounded-lg transition-all duration-500"
                      style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                    ></div>
                    <div 
                      className="absolute inset-y-0 left-0 h-2 top-3 bg-emerald-400/50 rounded-full"
                      style={{ width: `${(data.attendance / 800) * 100}%` }}
                    ></div>
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">${(data.revenue / 1000).toFixed(1)}k</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Row */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                ${(monthlyData.reduce((sum, d) => sum + d.revenue, 0) / 1000).toFixed(1)}k
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Monthly</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                ${(monthlyData.reduce((sum, d) => sum + d.revenue, 0) / monthlyData.length / 1000).toFixed(1)}k
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Attendance</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {monthlyData.reduce((sum, d) => sum + d.attendance, 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">New Users</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {monthlyData.reduce((sum, d) => sum + d.newUsers, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            <Link href="/tokens" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">View all</Link>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                {getActivityIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{activity.user}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activity.detail}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{activity.time}</p>
                </div>
                {activity.amount && (
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    +${activity.amount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Top Classes & Top Instructors */}
      {showLoading && !data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
            <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <ListItemSkeleton key={i} />)}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
            <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <ListItemSkeleton key={i} />)}
            </div>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Classes */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Classes</h3>
            <Link href="/classes" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">View all</Link>
          </div>
          <div className="space-y-3">
            {topClasses.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                No class data available for the selected period
              </div>
            ) : (
              topClasses.map((cls, index) => (
                <div
                  key={`class-${index}-${cls.name || 'unknown'}-${cls.instructor || 'unknown'}`}
                  className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm ${
                    index === 0 ? "bg-amber-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-amber-700" : "bg-gray-300"
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{cls.name || 'Untitled Class'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{cls.instructor || 'Unknown Instructor'}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{cls.attendance}</span>
                      <span className={`text-xs ${cls.growth > 10 ? "text-emerald-500" : "text-gray-400"}`}>
                        +{cls.growth}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">${cls.revenue}</p>
                  </div>
                  {cls.rating && (
                    <div className="flex items-center gap-1 text-amber-500">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-xs font-medium">{cls.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Instructors */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Instructors</h3>
            <Link href="/users/staff" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">View all</Link>
          </div>
          <div className="space-y-3">
            {topInstructors.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                No instructor data available for the selected period
              </div>
            ) : (
              topInstructors.map((instructor, index) => (
              <div
                key={`instructor-${instructor.id || index}-${instructor.name || 'unknown'}`}
                className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getAvatarColor(instructor.name)} text-white font-semibold text-sm`}>
                  {getInitials(instructor.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{instructor.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{instructor.classes} classes / {instructor.students} students</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">${instructor.revenue.toLocaleString()}</p>
                  <div className="flex items-center justify-end gap-1 text-amber-500">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {instructor.rating ? (
                      <span className="text-xs font-medium">{instructor.rating.toFixed(1)}</span>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}

      {/* Monthly Breakdown Table */}
      {showLoading && !data ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden animate-pulse">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-700 mt-2" />
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-3"><div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-700" /></th>
                <th className="px-6 py-3"><div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></th>
                <th className="px-6 py-3"><div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></th>
                <th className="px-6 py-3"><div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></th>
                <th className="px-6 py-3"><div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></th>
                <th className="px-6 py-3"><div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-700 ml-auto" /></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => <TableRowSkeleton key={i} />)}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Breakdown</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detailed performance by month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Attendance</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Classes</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">New Users</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Avg/Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {monthlyData.map((row, index) => {
                const prevRevenue = index > 0 ? monthlyData[index - 1].revenue : 0
                const revenueChange = prevRevenue > 0 
                  ? (((row.revenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
                  : null
                const avgPerClass = row.classes > 0 ? (row.attendance / row.classes).toFixed(1) : '0'
                
                return (
                <tr key={row.month} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900 dark:text-white">{row.month} {row.year || new Date().getFullYear()}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">${row.revenue.toLocaleString()}</span>
                    {revenueChange !== null && (
                      <span className={`ml-2 text-xs ${
                        row.revenue >= prevRevenue ? "text-emerald-500" : "text-red-500"
                      }`}>
                        {Number(revenueChange) >= 0 ? "+" : ""}{revenueChange}%
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row.attendance}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row.classes}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      +{row.newUsers}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">
                    {avgPerClass}
                  </td>
                </tr>
              )})}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                <td className="px-6 py-4 text-gray-900 dark:text-white">Total</td>
                <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400">
                  ${monthlyData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                  {monthlyData.reduce((sum, d) => sum + d.attendance, 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                  {monthlyData.reduce((sum, d) => sum + d.classes, 0)}
                </td>
                <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                  {monthlyData.reduce((sum, d) => sum + d.newUsers, 0)}
                </td>
                <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                  {(() => {
                    const totalAttendance = monthlyData.reduce((sum, d) => sum + d.attendance, 0)
                    const totalClasses = monthlyData.reduce((sum, d) => sum + d.classes, 0)
                    return totalClasses > 0 ? (totalAttendance / totalClasses).toFixed(1) : '0'
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
