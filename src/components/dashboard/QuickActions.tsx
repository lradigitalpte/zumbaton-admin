"use client";

import React from "react";
import Link from "next/link";

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Check-In Users",
    description: "Manage today's class attendance",
    href: "/attendance",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Add New Class",
    description: "Schedule a new class session",
    href: "/classes/new",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12M6 12h12" />
      </svg>
    ),
  },
  {
    title: "Manage Users",
    description: "View and edit user accounts",
    href: "/users",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M16 3.13a4 4 0 010 7.75M12 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    title: "Sell Tokens",
    description: "Manual token adjustments",
    href: "/tokens",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
];

export const QuickActions = () => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {QUICK_ACTIONS.map((action) => (
        <Link
          key={action.title}
          href={action.href}
          className="group flex min-h-[92px] items-center gap-3 rounded-[24px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] transition-colors hover:border-[#d5e45c] hover:bg-[#E4F56C] dark:border-white/10 dark:bg-gray-800 dark:hover:bg-[#E4F56C]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-800 group-hover:bg-neutral-950 group-hover:text-white dark:bg-white/10 dark:text-white dark:group-hover:bg-neutral-950">
            {action.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-950 group-hover:text-neutral-950 dark:text-white dark:group-hover:text-neutral-950">
              {action.title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-neutral-500 group-hover:text-neutral-800 dark:text-white/50 dark:group-hover:text-neutral-800">
              {action.description}
            </span>
          </span>
          <span aria-hidden className="text-neutral-400 group-hover:text-neutral-950 dark:group-hover:text-neutral-950">
            ↗
          </span>
        </Link>
      ))}
    </div>
  );
};

export default QuickActions;
