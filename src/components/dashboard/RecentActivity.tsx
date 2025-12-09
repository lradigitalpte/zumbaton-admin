"use client";

import React from "react";
import { useRecentActivity, RecentActivityItem } from "@/hooks/useDashboard";

const getActivityIcon = (type: RecentActivityItem["type"]) => {
  const iconClasses = {
    booking: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    "check-in": "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    cancellation: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    purchase: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    "no-show": "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  };

  const icons = {
    booking: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    "check-in": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    cancellation: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    purchase: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    "no-show": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${iconClasses[type]}`}>
      {icons[type]}
    </div>
  );
};

const ActivitySkeleton = () => (
  <div className="flex items-start gap-3 animate-pulse">
    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
    <div className="flex-1">
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mt-1.5" />
    </div>
  </div>
);

export const RecentActivity = () => {
  const { data: activities, isLoading, error } = useRecentActivity();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 md:px-6">
        <h3 className="font-semibold text-gray-800 dark:text-white/90">
          Recent Activity
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">Last 24 hours</span>
      </div>

      <div className="p-5 md:p-6">
        {error ? (
          <div className="text-center py-8 text-red-500 dark:text-red-400">
            Failed to load activity. Please try again.
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <ActivitySkeleton key={i} />
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No recent activity.
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                {getActivityIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    <span className="font-medium">{activity.user}</span>{" "}
                    <span className="text-gray-500 dark:text-gray-400">{activity.description}</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentActivity;
