"use client";

import { useState } from "react";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type GranularNotificationPreferences,
} from "@/hooks/useNotificationPreferences";

type PreferenceKey = "booking_confirmation" | "booking_cancelled";

const STAFF_NOTIFICATIONS: Array<{
  id: PreferenceKey;
  title: string;
  description: string;
  supportsEmail: boolean;
  supportsInApp: boolean;
}> = [
  {
    id: "booking_confirmation",
    title: "New Class Booking",
    description: "When a member books a class you teach or manage",
    supportsEmail: true,
    supportsInApp: true,
  },
  {
    id: "booking_cancelled",
    title: "Booking Cancelled",
    description: "When a member cancels their booking",
    supportsEmail: false,
    supportsInApp: true,
  },
];

function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        enabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function StaffNotificationPreferences() {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { data: preferences, isLoading, error } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const updateChannel = (
    id: PreferenceKey,
    channel: "email" | "push",
    value: boolean
  ) => {
    if (!preferences) return;

    const updatedGranular = {
      ...preferences.granular,
      [id]: {
        ...preferences.granular[id],
        [channel]: value,
      },
    };

    updatePreferences.mutate({ granular: updatedGranular });
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      await updatePreferences.mutateAsync({ granular: preferences.granular });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (saveError) {
      console.error("Failed to save notification preferences:", saveError);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading notification preferences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-800 dark:text-red-300">
          Failed to load preferences: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your alerts</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Turn off email or in-app alerts for your own account.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Saved
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={updatePreferences.isPending}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updatePreferences.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  Notification
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  Email
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  In-app
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {STAFF_NOTIFICATIONS.map((item) => {
                const pref = preferences?.granular[item.id as keyof GranularNotificationPreferences];
                const emailEnabled = pref?.email ?? true;
                const inAppEnabled = pref?.push ?? true;

                return (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {item.supportsEmail ? (
                          <Toggle
                            enabled={emailEnabled}
                            onChange={(value) => updateChannel(item.id, "email", value)}
                          />
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {item.supportsInApp ? (
                          <Toggle
                            enabled={inAppEnabled}
                            onChange={(value) => updateChannel(item.id, "push", value)}
                          />
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">N/A</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
