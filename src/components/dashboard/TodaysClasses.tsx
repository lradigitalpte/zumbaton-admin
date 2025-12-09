"use client";

import React from "react";
import Badge from "../ui/badge/Badge";
import { useTodaysClasses, TodaysClass } from "@/hooks/useDashboard";

const getStatusBadge = (status: TodaysClass["status"]) => {
  switch (status) {
    case "completed":
      return <Badge color="success" size="sm">Completed</Badge>;
    case "in-progress":
      return <Badge color="warning" size="sm">In Progress</Badge>;
    case "upcoming":
      return <Badge color="info" size="sm">Upcoming</Badge>;
  }
};

const ClassItemSkeleton = () => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div>
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse" />
      </div>
    </div>
    <div className="flex items-center gap-6">
      <div>
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="w-24 h-1.5 mt-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>
  </div>
);

export const TodaysClasses = () => {
  const { data: classes, isLoading, error } = useTodaysClasses();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 md:px-6">
        <h3 className="font-semibold text-gray-800 dark:text-white/90">
          Today&apos;s Classes
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </span>
      </div>

      <div className="p-5 md:p-6">
        {error ? (
          <div className="text-center py-8 text-red-500 dark:text-red-400">
            Failed to load classes. Please try again.
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <ClassItemSkeleton key={i} />
            ))}
          </div>
        ) : !classes || classes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No classes scheduled for today.
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-brand-50 dark:bg-brand-900/20">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {classItem.time.split(" ")[1]}
                    </span>
                    <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                      {classItem.time.split(" ")[0]}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-white/90">
                      {classItem.title}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {classItem.instructor}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {classItem.status === "completed" 
                        ? `${classItem.checkedIn}/${classItem.booked} attended`
                        : `${classItem.booked}/${classItem.capacity} booked`
                      }
                    </p>
                    <div className="w-24 h-1.5 mt-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          classItem.status === "completed" 
                            ? "bg-green-500" 
                            : "bg-brand-500"
                        }`}
                        style={{ 
                          width: `${classItem.status === "completed" 
                            ? (classItem.booked > 0 ? (classItem.checkedIn / classItem.booked) * 100 : 0)
                            : (classItem.capacity > 0 ? (classItem.booked / classItem.capacity) * 100 : 0)
                          }%` 
                        }}
                      />
                    </div>
                  </div>
                  {getStatusBadge(classItem.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodaysClasses;
