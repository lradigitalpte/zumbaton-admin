"use client";

import { useState, useEffect, useMemo } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useNotificationPreferences, useUpdateNotificationPreferences, GranularNotificationPreferences } from "@/hooks/useNotificationPreferences";

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  email: boolean;
  push: boolean;
  sms: boolean;
}

export default function NotificationSettingsPage() {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { data: preferences, isLoading, error } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  // Define notification structure - matches our implemented notification types
  const notificationDefinitions = useMemo(() => ({
    booking: [
      { id: "booking_confirmation", title: "Booking Confirmation", description: "When someone books a class (you get notified)" },
      { id: "booking_cancelled", title: "Booking Cancelled", description: "When someone cancels their booking" },
      { id: "booking_reminder", title: "Class Reminder", description: "Reminder 2 hours before class starts" },
      { id: "waitlist_promotion", title: "Waitlist Promotion", description: "When a user is moved from waitlist to confirmed" },
      { id: "no_show_warning", title: "No-Show Warning", description: "When a user misses their class" },
      { id: "class_cancelled", title: "Class Cancelled", description: "When a class is cancelled by admin" },
    ],
    token: [
      { id: "token_purchase", title: "Token Purchase", description: "When tokens are purchased" },
      { id: "token_balance_low", title: "Low Token Alert", description: "When token balance drops below threshold" },
      { id: "package_expiring", title: "Package Expiry Warning", description: "When token package is about to expire" },
    ],
    system: [
      { id: "welcome", title: "Welcome Message", description: "Welcome notification for new users" },
      { id: "payment_successful", title: "Payment Confirmation", description: "After a successful payment" },
      { id: "general", title: "General Announcements", description: "System-wide announcements and updates" },
    ],
  }), []);

  // Convert preferences to notification settings format
  const bookingNotifications = useMemo<NotificationSetting[]>(() => 
    notificationDefinitions.booking.map(def => ({
      ...def,
      email: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.email ?? true,
      push: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.push ?? true,
      sms: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.sms ?? false,
    })), [preferences, notificationDefinitions]
  );

  const tokenNotifications = useMemo<NotificationSetting[]>(() => 
    notificationDefinitions.token.map(def => ({
      ...def,
      email: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.email ?? true,
      push: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.push ?? true,
      sms: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.sms ?? false,
    })), [preferences, notificationDefinitions]
  );

  const systemNotifications = useMemo<NotificationSetting[]>(() => 
    notificationDefinitions.system.map(def => ({
      ...def,
      email: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.email ?? true,
      push: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.push ?? true,
      sms: preferences?.granular[def.id as keyof GranularNotificationPreferences]?.sms ?? false,
    })), [preferences, notificationDefinitions]
  );

  const updateNotification = (
    type: "booking" | "token" | "system",
    id: string,
    channel: "email" | "push" | "sms",
    value: boolean
  ) => {
    if (!preferences) return;

    // Update preferences optimistically
    const updatedGranular = {
      ...preferences.granular,
      [id]: {
        ...preferences.granular[id as keyof GranularNotificationPreferences],
        [channel]: value,
      },
    };

    // Save to backend (fire and forget for better UX)
    updatePreferences.mutate({
      granular: updatedGranular,
    });
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      await updatePreferences.mutateAsync({
        emailEnabled: preferences.emailEnabled,
        pushEnabled: preferences.pushEnabled,
        smsEnabled: preferences.smsEnabled,
        bookingReminders: preferences.bookingReminders,
        marketingEmails: preferences.marketingEmails,
        granular: preferences.granular,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const NotificationTable = ({
    title,
    description,
    items,
    type,
  }: {
    title: string;
    description: string;
    items: NotificationSetting[];
    type: "booking" | "token" | "system";
  }) => (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Notification
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </div>
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Push
                </div>
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  SMS
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <button
                      onClick={() => updateNotification(type, item.id, "email", !item.email)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        item.email ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        item.email ? "translate-x-5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <button
                      onClick={() => updateNotification(type, item.id, "push", !item.push)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        item.push ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        item.push ? "translate-x-5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <button
                      onClick={() => updateNotification(type, item.id, "sms", !item.sms)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        item.sms ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        item.sms ? "translate-x-5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Notification Settings" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Choose how you want to be notified
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={updatePreferences.isPending || isLoading}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {updatePreferences.isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {/* Quick Toggle All */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Enable or disable all notifications at once</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                if (!preferences) return;
                const allEnabled = Object.keys(preferences.granular).reduce((acc, key) => {
                  acc[key] = { email: true, push: true, sms: true };
                  return acc;
                }, {} as any);
                try {
                  await updatePreferences.mutateAsync({ granular: allEnabled });
                } catch (error) {
                  console.error('Failed to enable all:', error);
                }
              }}
              className="px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={async () => {
                if (!preferences) return;
                const allDisabled = Object.keys(preferences.granular).reduce((acc, key) => {
                  acc[key] = { email: false, push: false, sms: false };
                  return acc;
                }, {} as any);
                try {
                  await updatePreferences.mutateAsync({ granular: allDisabled });
                } catch (error) {
                  console.error('Failed to disable all:', error);
                }
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              Disable All
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading notification preferences...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-300">
            Failed to load preferences: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      ) : (
      <>
      {/* Notification Tables */}
      <div className="space-y-6">
        <NotificationTable
          title="Booking Notifications"
          description="Notifications related to class bookings and attendance"
          items={bookingNotifications}
          type="booking"
        />

        <NotificationTable
          title="Token Notifications"
          description="Notifications related to token purchases and balance"
          items={tokenNotifications}
          type="token"
        />

        <NotificationTable
          title="System Notifications"
          description="General system alerts and reports"
          items={systemNotifications}
          type="system"
        />
      </div>

      {/* SMS Info */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex items-start gap-3">
          <svg className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">SMS Notifications</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              SMS notifications incur additional charges based on your plan. Currently, SMS is available for critical alerts only. 
              <a href="#" className="underline hover:no-underline ml-1">View pricing</a>
            </p>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
