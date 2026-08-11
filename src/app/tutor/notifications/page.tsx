"use client";

import { useState } from "react";
import { useTutorNotifications, markNotificationsRead, clearAllNotifications } from "@/hooks/useTutor";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StaffNotificationPreferences } from "@/components/settings/StaffNotificationPreferences";

export default function TutorNotificationsPage() {
  const { data, isLoading, error } = useTutorNotifications();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"preferences" | "history">("preferences");

  const markReadMutation = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutor', 'notifications'] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutor', 'notifications'] });
    },
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading && activeTab === "history") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error && activeTab === "history") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Failed to load notifications</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage booking alerts and view your notification history
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("preferences")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "preferences"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Preferences
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          History
          {(data?.unreadCount || 0) > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full">
              {data?.unreadCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "preferences" && <StaffNotificationPreferences />}

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data?.notifications.length || 0} notifications
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => markReadMutation.mutate(undefined)}
                disabled={markReadMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 disabled:opacity-50"
              >
                Mark all as read
              </button>
              <button
                onClick={() => clearAllMutation.mutate()}
                disabled={clearAllMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 disabled:opacity-50"
              >
                Clear all
              </button>
            </div>
          </div>

          {data?.notifications && data.notifications.length > 0 ? (
            <div className="space-y-3">
              {data.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    notification.read
                      ? "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                      : "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`font-medium ${notification.read ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white"}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {notification.message}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No notifications</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                You&apos;re all caught up.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
