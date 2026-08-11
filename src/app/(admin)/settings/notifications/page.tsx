"use client";

import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { StaffNotificationPreferences } from "@/components/settings/StaffNotificationPreferences";
import { AlertEmailSettings } from "@/components/settings/AlertEmailSettings";

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Notification Settings" />

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-lg">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Alerts and personal notification preferences
          </p>
        </div>
      </div>

      <AlertEmailSettings />
      <StaffNotificationPreferences />
    </div>
  );
}
