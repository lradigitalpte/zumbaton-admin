import type { Metadata } from "next";
import Link from "next/link";
import { DashboardMetrics, TodaysClasses, RecentActivity, QuickActions } from "@/components/dashboard";
import React from "react";

export const metadata: Metadata = {
  title: "One Step Fitness Admin Dashboard",
  description: "One Step Fitness class management dashboard",
};

export default function Dashboard() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
          Managing{" "}
          <span className="mx-0.5 inline-flex h-7 w-9 translate-y-[-1px] items-center justify-center rounded-full bg-neutral-950 align-middle text-white">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </span>{" "}
          your studio and{" "}
          <span className="mx-0.5 inline-flex h-7 w-9 translate-y-[-1px] items-center justify-center rounded-full bg-[#E4F56C] align-middle text-neutral-950">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 3l2.2 5.2L21 10l-5.8 1.8L13 17l-2.2-5.2L5 10l5.8-1.8L13 3z" />
            </svg>
          </span>{" "}
          classes
        </h1>

        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label="Studio settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/80 bg-white text-neutral-800 shadow-[0_8px_20px_rgba(16,24,40,0.05)] transition-colors hover:bg-neutral-100 dark:border-white/10 dark:bg-gray-800 dark:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.22-1.14.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.49.4 1.04.72 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.22 1.14-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
            </svg>
          </Link>
          <Link
            href="/classes/new"
            className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            <span className="text-base leading-none">+</span>
            Create a New Class
          </Link>
        </div>
      </div>

      <DashboardMetrics />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.85fr)]">
        <TodaysClasses />
        <div className="grid gap-5">
          <QuickActions />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
