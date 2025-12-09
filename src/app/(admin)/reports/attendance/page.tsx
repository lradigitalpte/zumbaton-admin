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
  const { data, isLoading, error } = useAttendanceReport(dateRange);
  
  // Use API data or defaults
  const totals = data?.totals || defaultTotals;
  const weeklyData = data?.weeklyData || [];
  const timeSlotData = data?.timeSlotData || [];
  const classPerformance = data?.classPerformance || [];
  const frequentNoShows = data?.frequentNoShows || [];
  const monthlyTrends = data?.monthlyTrends || [];

  const overallRate = totals.overallRate;
  const noShowRate = totals.noShowRate;

  const maxAttendance = weeklyData.length > 0 ? Math.max(...weeklyData.map(d => d.booked)) : 1;

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
    <div className="space-y-6">
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
              {isLoading && <span className="ml-2 text-blue-500">(Loading...)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            {(["week", "month", "quarter", "year"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  dateRange === range
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      {isLoading ? (
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
          {isLoading ? (
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
                {timeSlotData.slice(0, 6).map((slot) => (
                  <div key={slot.slot} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-16 text-sm font-medium text-gray-600 dark:text-gray-400">{slot.slot}</div>
                      <div className="flex -space-x-1">
                        {[...Array(Math.min(slot.classes, 4))].map((_, i) => (
                          <div key={i} className="h-2 w-2 rounded-full bg-blue-400 border border-white dark:border-gray-800"></div>
                        ))}
                        {slot.classes > 4 && (
                          <span className="text-xs text-gray-400 ml-1">+{slot.classes - 4}</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${getRateColor(slot.rate)}`}>{slot.rate}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Best time</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">5:00 PM - 93%</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Needs improvement</span>
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">6:00 AM - 86%</span>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Monthly Trends */}
          {isLoading ? (
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
                      <td className="py-3 font-medium text-gray-900 dark:text-white">{month.month} 2024</td>
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
        isLoading ? (
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
        isLoading ? (
          <TableSkeleton />
        ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Frequent No-Shows</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Users with highest no-show rates</p>
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
          <div className="mt-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Recommendation</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Consider implementing a warning system for users with no-show rates above 25%. 
                  You may also want to require prepaid bookings for repeat offenders.
                </p>
              </div>
            </div>
          </div>
        </div>
        )
      )}
    </div>
  );
}
