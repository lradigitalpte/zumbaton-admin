"use client";

import React from "react";
import Link from "next/link";
import { useDashboardMetrics, DashboardMetrics as DashboardMetricsType } from "@/hooks/useDashboard";
import { Capsules, formatMoney, PercentRing } from "./studio-ui";

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

function MembersIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TokenIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RevenueIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
    </svg>
  );
}

const cardBase =
  "flex min-h-[188px] flex-col rounded-[28px] p-5 transition-transform hover:-translate-y-0.5 sm:p-6";

function MetricSkeleton() {
  return <div className={`${cardBase} animate-pulse border border-neutral-200/80 bg-white dark:border-white/10 dark:bg-gray-800`} />;
}

export const DashboardMetrics = () => {
  const { data: metrics, isLoading, error } = useDashboardMetrics();
  const data = metrics || DEFAULT_METRICS;

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-white px-6 py-8 text-sm text-red-600 dark:border-red-900 dark:bg-gray-800 dark:text-red-400">
        Couldn&apos;t load studio numbers. Refresh the page to try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Link
        href="/users"
        className={`${cardBase} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-white/70">
          <MembersIcon />
          Active Members
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="text-4xl font-semibold leading-none tracking-tight">{data.activeMembers.toLocaleString()}</p>
          <PercentRing value={data.usersChange} />
        </div>
        <p className="mt-1 text-xs text-neutral-400">vs last month</p>
        <Capsules value={data.usersChange} />
      </Link>

      <Link
        href="/tokens"
        className={`${cardBase} border border-[#d5e45c] bg-[#E4F56C] text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]`}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <TokenIcon />
          Tokens Sold
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="text-4xl font-semibold leading-none tracking-tight">{data.tokensSold.toLocaleString()}</p>
          <PercentRing value={data.tokensChange} tone="lime" />
        </div>
        <p className="mt-1 text-xs text-neutral-950/55">this month</p>
        <Capsules value={data.tokensChange} tone="lime" />
      </Link>

      <Link
        href="/attendance"
        className={`${cardBase} border border-neutral-950 bg-neutral-950 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]`}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-white/70">
          <CheckIcon />
          Today&apos;s Attendance
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="text-4xl font-semibold leading-none tracking-tight">{data.attendanceToday}</p>
          <PercentRing value={data.attendanceRate} tone="light" />
        </div>
        <p className="mt-1 text-xs text-white/55">
          {data.classesToday} {data.classesToday === 1 ? "class" : "classes"} today
        </p>
        <Capsules value={data.attendanceRate} tone="light" />
      </Link>

      <Link
        href="/reports/revenue"
        className={`${cardBase} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-white/70">
          <RevenueIcon />
          Revenue
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="text-4xl font-semibold leading-none tracking-tight">{formatMoney(data.revenue)}</p>
          <PercentRing value={data.revenueChange} />
        </div>
        <p className="mt-1 text-xs text-neutral-400">this month</p>
        <Capsules value={data.revenueChange} />
      </Link>
    </div>
  );
};

export default DashboardMetrics;
