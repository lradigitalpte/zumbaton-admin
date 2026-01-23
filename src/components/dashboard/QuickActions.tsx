"use client";

import React from "react";

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Check-In Users",
    description: "Manage today's class attendance",
    href: "/attendance",
    color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Add New Class",
    description: "Schedule a new class session",
    href: "/classes/new",
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  {
    title: "Manage Users",
    description: "View and edit user accounts",
    href: "/users",
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    title: "Sell Tokens",
    description: "Manual token adjustments",
    href: "/tokens",
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
];

export const QuickActions = () => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 md:px-6">
        <h3 className="font-semibold text-gray-800 dark:text-white/90">
          Quick Actions
        </h3>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <a
              key={action.title}
              href={action.href}
              className="flex flex-col items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-center group"
            >
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${action.color} mb-3`}>
                {action.icon}
              </div>
              <h4 className="font-medium text-sm text-gray-800 dark:text-white/90 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {action.title}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {action.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
