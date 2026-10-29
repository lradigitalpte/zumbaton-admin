"use client";

import React from "react";
import { useRecentActivity, RecentActivityItem } from "@/hooks/useDashboard";
import { StudioCard } from "./studio-ui";

const DOT: Record<RecentActivityItem["type"], string> = {
  booking: "bg-neutral-950 dark:bg-white",
  "check-in": "bg-[#E4F56C]",
  cancellation: "bg-neutral-300 dark:bg-white/30",
  purchase: "bg-neutral-950 ring-2 ring-[#E4F56C] dark:bg-white",
  "no-show": "border border-dashed border-neutral-400 bg-transparent",
};

export const RecentActivity = () => {
  const { data: activities, isLoading, error } = useRecentActivity();

  return (
    <StudioCard>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Recent Activity</h2>
        <span className="text-xs text-neutral-400">Last 24 hours</span>
      </div>

      <div className="mt-2">
        {error ? (
          <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">Couldn&apos;t load activity.</p>
        ) : isLoading ? (
          <div className="space-y-4 py-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex animate-pulse gap-3">
                <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-neutral-200 dark:bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 rounded-full bg-neutral-100 dark:bg-white/10" />
                  <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">No recent activity.</p>
        ) : (
          <ul>
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-start gap-3 border-b border-neutral-100 py-3 last:border-0 dark:border-white/10">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[activity.type]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-800 dark:text-white/90">
                    <span className="font-semibold">{activity.user}</span>{" "}
                    <span className="text-neutral-500 dark:text-white/50">{activity.description}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">{activity.time}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StudioCard>
  );
};

export default RecentActivity;
