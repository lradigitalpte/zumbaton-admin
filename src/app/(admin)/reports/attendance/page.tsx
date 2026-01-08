"use client";

import { useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useAttendanceReport } from "@/hooks/useReports";

// Skeleton Components
const MetricCardSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-700"></div>
      <div className="flex-1">
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  </div>
);

const ChartSkeleton = () => (
  <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="space-y-4">
      {[...Array(7)].map((_, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      ))}
    </div>
  </div>
);

const ListSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-2">
          <div className="flex items-center gap-3">
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="flex gap-1">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              ))}
            </div>
          </div>
          <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      ))}
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden animate-pulse">
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
    <div className="p-6">
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div>
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Default empty data for loading state
const defaultTotals = {
  totalBooked: 0,
  totalAttended: 0,
  totalNoShows: 0,
  totalCancelled: 0,
  overallRate: 0,
  noShowRate: 0,
};

export default function AttendanceReportPage() {
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter" | "year">("month");
  const [viewMode, setViewMode] = useState<"overview" | "classes" | "users">("overview");

  // Fetch real data from API
  const { data, isLoading, isFetching, error } = useAttendanceReport(dateRange);
  
  // Use API data or defaults
  const totals = data?.totals || defaultTotals;
  const weeklyData = data?.weeklyData || [];
  const timeSlotData = data?.timeSlotData || [];
  const classPerformance = data?.classPerformance || [];
  const frequentNoShows = data?.frequentNoShows || [];
  const monthlyTrends = data?.monthlyTrends || [];

  // Show loading when fetching (even if we have cached data)
  const showLoading = isLoading || isFetching;

  const overallRate = totals.overallRate;
  const noShowRate = totals.noShowRate;

  const maxAttendance = weeklyData.length > 0 ? Math.max(...weeklyData.map(d => d.booked)) : 1;

  // Get best and worst time slots (only consider slots with actual bookings/attendance)
  const slotsWithData = timeSlotData.filter(slot => slot.avgAttendance > 0 || slot.rate > 0);
  const bestTimeSlot = slotsWithData.length > 0 
    ? slotsWithData.reduce((best, current) => {
        // Prefer higher rate, but if rates are equal, prefer more classes
        if (current.rate > best.rate) return current;
        if (current.rate === best.rate && current.classes > best.classes) return current;
        return best;
      })
    : null;
  const worstTimeSlot = slotsWithData.length > 0 
    ? slotsWithData.reduce((worst, current) => {
        // Prefer lower rate, but if rates are equal, prefer fewer classes
        if (current.rate < worst.rate) return current;
        if (current.rate === worst.rate && current.classes < worst.classes) return current;
        return worst;
      })
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
    csvRows.push('Attendance Report Export');
    csvRows.push(`Generated: ${new Date().toLocaleString()}`);
    csvRows.push(`Date Range: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`);
    csvRows.push('');

    // Totals Section
    csvRows.push('TOTALS');
    csvRows.push('Metric,Value');
    csvRows.push(`Total Bookings,${totals.totalBooked}`);
    csvRows.push(`Attended,${totals.totalAttended}`);
    csvRows.push(`No-Shows,${totals.totalNoShows}`);
    csvRows.push(`Cancelled,${totals.totalCancelled}`);
    csvRows.push(`Attendance Rate,${totals.overallRate}%`);
    csvRows.push(`No-Show Rate,${totals.noShowRate}%`);
    csvRows.push('');

    // Weekly Breakdown Section
    csvRows.push('WEEKLY BREAKDOWN');
    csvRows.push('Day,Classes,Booked,Attended,No-Shows,Cancelled,Rate');
    weeklyData.forEach(day => {
      csvRows.push(
        `"${day.day}",${day.classes},${day.booked},${day.attended},${day.noShows},${day.cancelled},${day.rate}%`
      );
    });
    csvRows.push('');

    // Time Slot Performance Section
    csvRows.push('TIME SLOT PERFORMANCE');
    csvRows.push('Time Slot,Classes,Avg Attendance,Rate');
    timeSlotData.forEach(slot => {
      csvRows.push(
        `"${slot.slot}",${slot.classes},${slot.avgAttendance},${slot.rate}%`
      );
    });
    csvRows.push('');

    // Class Performance Section
    csvRows.push('CLASS PERFORMANCE');
    csvRows.push('Class Name,Instructor,Total Classes,Avg Attendance,Capacity,Fill Rate,No-Show Rate');
    classPerformance.forEach(cls => {
      csvRows.push(
        `"${cls.name.replace(/"/g, '""')}","${cls.instructor.replace(/"/g, '""')}",${cls.totalClasses},${cls.avgAttendance},${cls.capacity},${cls.rate}%,${cls.noShowRate}%`
      );
    });
    csvRows.push('');

    // Frequent No-Shows Section
    csvRows.push('FREQUENT NO-SHOWS');
    csvRows.push('Name,Email,No-Shows,Total Bookings,Rate,Last No-Show');
    frequentNoShows.forEach(user => {
      csvRows.push(
        `"${user.name.replace(/"/g, '""')}","${user.email.replace(/"/g, '""')}",${user.noShows},${user.totalBookings},${user.rate}%,"${user.lastNoShow}"`
      );
    });
    csvRows.push('');

    // Monthly Trends Section
    csvRows.push('MONTHLY TRENDS');
    csvRows.push('Month,Attended,No-Shows,Cancelled,Rate');
    monthlyTrends.forEach(month => {
      csvRows.push(
        `"${month.month}",${month.attendance},${month.noShows},${month.cancellations},${month.rate}%`
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
    link.setAttribute('download', `attendance-report-${rangeLabel.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
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

  const getRateColor = (rate: number) => {
    if (rate >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (rate >= 80) return "text-blue-600 dark:text-blue-400";
    if (rate >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getRateBg = (rate: number) => {
    if (rate >= 90) return "bg-emerald-100 dark:bg-emerald-900/30";
    if (rate >= 80) return "bg-blue-100 dark:bg-blue-900/30";
    if (rate >= 70) return "bg-amber-100 dark:bg-amber-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {showLoading && data && (
        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
          <div className="flex flex-col items-center gap-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg px-6 py-4 border border-gray-200 dark:border-gray-700">
            <svg className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Loading data...</p>
          </div>
        </div>
      )}
      
      <PageBreadCrumb pageTitle="Attendance Report" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-cyan-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Class attendance analytics and patterns
              {showLoading && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
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
                <svg className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
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
                    ? "bg-blue-600 text-white"
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
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      {showLoading && !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.totalBooked.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Attended</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totals.totalAttended.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Attendance Rate</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{overallRate}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">No-Shows</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totals.totalNoShows}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Cancelled</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totals.totalCancelled}</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex gap-2">
        {[
          { value: "overview", label: "Overview" },
          { value: "classes", label: "By Class" },
          { value: "users", label: "No-Show Users" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setViewMode(tab.value as typeof viewMode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === tab.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {viewMode === "overview" && (
        <>
          {/* Weekly Breakdown & Time Slots */}
          {showLoading && !data ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ChartSkeleton />
              <ListSkeleton />
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Weekly Breakdown */}
            <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weekly Breakdown</h3>
              <div className="space-y-4">
                {weeklyData.map((data) => (
                  <div key={data.day} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-24">{data.day}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-500">{data.classes} classes</span>
                        <span className={`font-semibold ${getRateColor(data.rate)}`}>{data.rate}%</span>
                      </div>
                    </div>
                    <div className="flex h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                      <div 
                        className="bg-emerald-500 transition-all duration-500 flex items-center justify-center"
                        style={{ width: `${(data.attended / maxAttendance) * 100}%` }}
                        title={`Attended: ${data.attended}`}
                      >
                        <span className="text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {data.attended}
                        </span>
                      </div>
                      <div 
                        className="bg-red-400 transition-all duration-500 flex items-center justify-center"
                        style={{ width: `${(data.noShows / maxAttendance) * 100}%` }}
                        title={`No-shows: ${data.noShows}`}
                      >
                        <span className="text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {data.noShows}
                        </span>
                      </div>
                      <div 
                        className="bg-amber-400 transition-all duration-500 flex items-center justify-center"
                        style={{ width: `${(data.cancelled / maxAttendance) * 100}%` }}
                        title={`Cancelled: ${data.cancelled}`}
                      >
                        <span className="text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {data.cancelled}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-emerald-500"></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Attended</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-red-400"></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">No-Shows</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-amber-400"></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Cancelled</span>
                </div>
              </div>
            </div>

            {/* Time Slot Performance */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Peak Times</h3>
              <div className="space-y-3">
                {timeSlotData.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No time slot data available for the selected period
                  </div>
                ) : (
                  timeSlotData.slice(0, 6).map((slot) => (
                    <div key={slot.slot} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-sm font-medium text-gray-600 dark:text-gray-400">{slot.slot}</div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {slot.classes} {slot.classes === 1 ? 'class' : 'classes'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${getRateColor(slot.rate)}`}>{slot.rate}%</span>
                        <p className="text-xs text-gray-400">avg {slot.avgAttendance} per class</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {timeSlotData.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {bestTimeSlot && bestTimeSlot.rate > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Best time</span>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {bestTimeSlot.slot} - {bestTimeSlot.rate}%
                      </span>
                    </div>
                  )}
                  {worstTimeSlot && worstTimeSlot.rate < (bestTimeSlot?.rate || 100) && worstTimeSlot.rate >= 0 && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Needs improvement</span>
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {worstTimeSlot.slot} - {worstTimeSlot.rate}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Monthly Trends */}
          {showLoading && !data ? (
            <TableSkeleton />
          ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Trends</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Attended</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">No-Shows</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cancelled</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Rate</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pl-4">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {monthlyTrends.map((month, index) => (
                    <tr key={month.month} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-3 font-medium text-gray-900 dark:text-white">{month.month} {month.year || new Date().getFullYear()}</td>
                      <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{month.attendance.toLocaleString()}</td>
                      <td className="py-3 text-right text-red-500">{month.noShows}</td>
                      <td className="py-3 text-right text-amber-500">{month.cancellations}</td>
                      <td className="py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getRateBg(month.rate)} ${getRateColor(month.rate)}`}>
                          {month.rate}%
                        </span>
                      </td>
                      <td className="py-3 pl-4">
                        <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${month.rate >= 90 ? "bg-emerald-500" : month.rate >= 85 ? "bg-blue-500" : "bg-amber-500"}`}
                            style={{ width: `${month.rate}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      )}

      {viewMode === "classes" && (
        showLoading && !data ? (
          <TableSkeleton />
        ) : (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Class Performance</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Attendance metrics by class type</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Instructor</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Classes</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Avg Attendance</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Capacity</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Fill Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">No-Show %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {classPerformance.map((cls) => (
                  <tr key={cls.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900 dark:text-white">{cls.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${getAvatarColor(cls.instructor)} text-white text-xs font-semibold`}>
                          {getInitials(cls.instructor)}
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{cls.instructor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{cls.totalClasses}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{cls.avgAttendance}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{cls.capacity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getRateBg(cls.rate)} ${getRateColor(cls.rate)}`}>
                        {cls.rate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${cls.noShowRate > 7 ? "text-red-500" : "text-gray-500"}`}>
                        {cls.noShowRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )
      )}

      {viewMode === "users" && (
        showLoading && !data ? (
          <TableSkeleton />
        ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Frequent No-Shows</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Users with highest no-show rates ({dateRange === 'week' ? 'this week' : 
                dateRange === 'quarter' ? 'this quarter' : 
                dateRange === 'year' ? 'this year' : 
                'this month'})
              </p>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">Export list</button>
          </div>
          <div className="space-y-3">
            {frequentNoShows.map((user, index) => (
              <div
                key={user.email}
                className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-center w-8 text-sm font-bold text-gray-400">
                  #{index + 1}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getAvatarColor(user.name)} text-white font-semibold text-sm`}>
                  {getInitials(user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{user.noShows}</p>
                  <p className="text-xs text-gray-400">no-shows</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{user.totalBookings}</p>
                  <p className="text-xs text-gray-400">bookings</p>
                </div>
                <div className="text-center px-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    user.rate > 25 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}>
                    {user.rate}%
                  </span>
                </div>
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500 transition-colors">
                  View Profile
                </button>
              </div>
            ))}
          </div>
        </div>
        )
      )}
    </div>
  );
}
