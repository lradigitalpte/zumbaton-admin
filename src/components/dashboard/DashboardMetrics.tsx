"use client";

import React from "react";
import Badge from "../ui/badge/Badge";
import { ArrowUpIcon, ArrowDownIcon } from "@/icons";
import { useDashboardMetrics, DashboardMetrics as DashboardMetricsType } from "@/hooks/useDashboard";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color?: "blue" | "green" | "orange" | "purple" | "red";
  isLoading?: boolean;
}

const MetricCard = ({ title, value, change, changeLabel, icon, color = "blue", isLoading }: MetricCardProps) => {
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${colorClasses[color]}`}>
        {icon}
      </div>

      <div className="flex items-end justify-between mt-5">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {title}
          </span>
          {isLoading ? (
            <div className="mt-2 h-7 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          ) : (
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {value}
            </h4>
          )}
        </div>
        {!isLoading && change !== undefined && (
          <Badge color={change >= 0 ? "success" : "error"}>
            {change >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
            {Math.abs(change)}%
          </Badge>
        )}
        {!isLoading && changeLabel && !change && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{changeLabel}</span>
        )}
      </div>
    </div>
  );
};

// Fallback data for when API hasn't loaded yet
const DEFAULT_METRICS: DashboardMetricsType = {
  activeMembers: 0,
  usersChange: 0,
  tokensSold: 0,
  tokensChange: 0,
  classesToday: 0,
  attendanceToday: 0,
  attendanceRate: 0,
  revenue: 0,
  revenueChange: 0,
};

export const DashboardMetrics = () => {
  const { data: metrics, isLoading, error } = useDashboardMetrics();
  
  const data = metrics || DEFAULT_METRICS;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-red-600 dark:text-red-400">Failed to load metrics. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6">
      {/* Active Members */}
      <MetricCard
        title="Active Members"
        value={data.activeMembers.toLocaleString()}
        change={data.usersChange}
        color="blue"
        isLoading={isLoading}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
      />

      {/* Tokens Sold */}
      <MetricCard
        title="Tokens Sold (This Month)"
        value={data.tokensSold.toLocaleString()}
        change={data.tokensChange}
        color="green"
        isLoading={isLoading}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        }
      />

      {/* Today's Attendance */}
      <MetricCard
        title="Today's Attendance"
        value={`${data.attendanceToday} / ${data.classesToday} classes`}
        changeLabel={`${data.attendanceRate}% rate`}
        color="orange"
        isLoading={isLoading}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      {/* Revenue */}
      <MetricCard
        title="Revenue (This Month)"
        value={`$${data.revenue.toLocaleString()}`}
        change={data.revenueChange}
        color="purple"
        isLoading={isLoading}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
};

export default DashboardMetrics;
