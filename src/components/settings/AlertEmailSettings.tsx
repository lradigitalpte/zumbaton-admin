"use client";

import { useEffect, useState } from "react";
import {
  useNotificationAlertsSettings,
  useUpdateNotificationAlertsSettings,
} from "@/hooks/useNotificationAlerts";

export function AlertEmailSettings() {
  const { data, isLoading, error } = useNotificationAlertsSettings();
  const updateSettings = useUpdateNotificationAlertsSettings();
  const [emails, setEmails] = useState<string[]>([""]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (data) {
      setEmails(data.emails.length > 0 ? data.emails : [""]);
    }
  }, [data]);

  const addEmailRow = () => {
    setEmails((current) => [...current, ""]);
  };

  const removeEmailRow = (index: number) => {
    setEmails((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
  };

  const updateEmail = (index: number, value: string) => {
    setEmails((current) => current.map((email, i) => (i === index ? value : email)));
  };

  const handleSave = async () => {
    const cleaned = emails.map((email) => email.trim()).filter(Boolean);

    try {
      await updateSettings.mutateAsync({ emails: cleaned });
      setEmails(cleaned.length > 0 ? cleaned : [""]);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (saveError) {
      console.error("Failed to save alert emails:", saveError);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading recipients...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-800 dark:text-red-300">
          Could not load recipients. {error instanceof Error ? error.message : "Please try again."}
        </p>
      </div>
    );
  }

  const filledCount = emails.filter((email) => email.trim()).length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alert recipients</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Payment and booking alerts go to these emails only.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saveSuccess && (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Saved</span>
          )}
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateSettings.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {emails.map((email, index) => (
          <div
            key={index}
            className="group flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-gray-600 dark:bg-gray-700/30 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
          >
            <svg
              className="h-4 w-4 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <input
              type="email"
              value={email}
              onChange={(e) => updateEmail(index, e.target.value)}
              placeholder="email@onestepfitness.sg"
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none dark:text-white dark:placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => removeEmailRow(index)}
              aria-label="Remove email"
              className="rounded-lg p-2 text-gray-400 opacity-60 transition hover:bg-gray-200/80 hover:text-red-600 hover:opacity-100 group-focus-within:opacity-100 dark:hover:bg-gray-600 dark:hover:text-red-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addEmailRow}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add email
        </button>
      </div>

      {filledCount > 0 && (
        <div className="border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {filledCount} recipient{filledCount !== 1 ? "s" : ""} configured
          </p>
        </div>
      )}
    </div>
  );
}
