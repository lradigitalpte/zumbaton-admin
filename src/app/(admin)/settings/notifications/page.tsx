"use client";

import { useState } from "react";
import { StaffNotificationPreferences } from "@/components/settings/StaffNotificationPreferences";
import { AlertEmailSettings } from "@/components/settings/AlertEmailSettings";

const tabs = [
  { id: "recipients" as const, label: "Recipients", caption: "Who gets the studio copies of payments, bookings, and trials." },
  { id: "mine" as const, label: "Your alerts", caption: "Email and in-app alerts for your own account." },
];

export default function NotificationSettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("recipients");
  const current = tabs.find((item) => item.id === tab) ?? tabs[0];

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Notifications</h1>
        <p className="mt-1 max-w-xl text-sm text-neutral-500">{current.caption}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              tab === item.id
                ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={tab === "recipients" ? "" : "hidden"}>
        <AlertEmailSettings />
      </div>
      <div className={tab === "mine" ? "" : "hidden"}>
        <StaffNotificationPreferences />
      </div>
    </div>
  );
}
