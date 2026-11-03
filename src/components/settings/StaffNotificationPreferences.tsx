"use client";

import { useState } from "react";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type GranularNotificationPreferences,
} from "@/hooks/useNotificationPreferences";

type PreferenceKey = "booking_confirmation" | "booking_cancelled";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

const STAFF_NOTIFICATIONS: Array<{
  id: PreferenceKey;
  title: string;
  description: string;
  supportsEmail: boolean;
  supportsInApp: boolean;
}> = [
  {
    id: "booking_confirmation",
    title: "New class booking",
    description: "When a member books a class you teach or manage",
    supportsEmail: true,
    supportsInApp: true,
  },
  {
    id: "booking_cancelled",
    title: "Booking cancelled",
    description: "When a member cancels their booking. Email is not sent for this one.",
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
      aria-pressed={enabled}
      className={`relative inline-flex h-7 w-12 items-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 ${
        enabled ? "bg-[#E4F56C]" : "bg-neutral-300 dark:bg-white/20"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-neutral-950 transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
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
    return <div className={`${card} h-48 animate-pulse`} />;
  }

  if (error) {
    return (
      <div className={`${card} px-6 py-8 text-sm text-red-600`}>
        Could not load preferences. {error instanceof Error ? error.message : ""}
      </div>
    );
  }

  return (
    <div className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Your alerts</h2>
          <p className="mt-1 text-sm text-neutral-500">Turn email or in-app alerts on or off for your own account.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={updatePreferences.isPending}
          className="rounded-full bg-[#E4F56C] px-5 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
        >
          {updatePreferences.isPending ? "Saving…" : saveSuccess ? "Saved" : "Save changes"}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {STAFF_NOTIFICATIONS.map((item) => {
          const pref = preferences?.granular[item.id as keyof GranularNotificationPreferences];
          const emailEnabled = pref?.email ?? true;
          const inAppEnabled = pref?.push ?? true;

          return (
            <div key={item.id} className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-medium text-neutral-950 dark:text-white">{item.title}</p>
              <p className="mt-1 text-sm text-neutral-500">{item.description}</p>
              <div className="mt-4 flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Email</span>
                  {item.supportsEmail ? (
                    <Toggle enabled={emailEnabled} onChange={(value) => updateChannel(item.id, "email", value)} />
                  ) : (
                    <span className="text-xs text-neutral-400">Not sent</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">In-app</span>
                  {item.supportsInApp ? (
                    <Toggle enabled={inAppEnabled} onChange={(value) => updateChannel(item.id, "push", value)} />
                  ) : (
                    <span className="text-xs text-neutral-400">Not sent</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {updatePreferences.isError && (
        <p className="mt-3 text-sm text-red-600">{updatePreferences.error?.message || "Could not save preferences."}</p>
      )}
    </div>
  );
}
