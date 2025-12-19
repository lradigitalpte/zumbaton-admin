"use client";

import { useState, useEffect } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useAuth } from "@/context/AuthContext";

interface CronJob {
  name: string;
  displayName: string;
  description: string;
  frequency: string;
  cron: string;
  category: "notifications" | "maintenance" | "cleanup";
  apiParam: string;
}

interface JobResult {
  jobName: string;
  success: boolean;
  duration: number;
  details: Record<string, unknown>;
  error?: string;
}

interface RunHistory {
  jobName: string;
  timestamp: Date;
  success: boolean;
  duration: number;
  details?: Record<string, unknown>;
  error?: string;
}

const CRON_JOBS: CronJob[] = [
  // Notification Jobs
  {
    name: "sendClassReminders",
    displayName: "Class Reminders",
    description: "Sends reminder notifications 2 hours before class to students and tutors",
    frequency: "Every 15 minutes",
    cron: "*/15 * * * *",
    category: "notifications",
    apiParam: "class-reminders",
  },
  {
    name: "sendTokenExpiryWarnings",
    displayName: "Token Expiry Warnings",
    description: "Warns users whose token packages expire in 3 days",
    frequency: "Daily at 9:00 AM",
    cron: "0 9 * * *",
    category: "notifications",
    apiParam: "token-warnings",
  },
  {
    name: "sendTokenBalanceLowWarnings",
    displayName: "Low Token Balance Alerts",
    description: "Warns users when their token balance drops below 3",
    frequency: "Daily at 10:00 AM",
    cron: "0 10 * * *",
    category: "notifications",
    apiParam: "all", // Part of all jobs
  },
  {
    name: "processExpiredWaitlistNotifications",
    displayName: "Waitlist Expiry",
    description: "Expires waitlist offers after 24h and notifies next person in line",
    frequency: "Every 15 minutes",
    cron: "*/15 * * * *",
    category: "notifications",
    apiParam: "waitlist-expiry",
  },
  // Maintenance Jobs
  {
    name: "processNoShows",
    displayName: "Process No-Shows",
    description: "Marks bookings as no-show 30 minutes after class ends, consumes tokens, sends warning",
    frequency: "Every hour",
    cron: "0 * * * *",
    category: "maintenance",
    apiParam: "no-shows",
  },
  {
    name: "markCompletedClasses",
    displayName: "Mark Completed Classes",
    description: "Marks all past classes (single, recurring, course) as completed",
    frequency: "Daily at midnight",
    cron: "0 0 * * *",
    category: "maintenance",
    apiParam: "mark-completed-classes",
  },
  // Cleanup Jobs
  {
    name: "processExpiredPackages",
    displayName: "Expire Packages",
    description: "Marks token packages past their expiry date as expired",
    frequency: "Daily at midnight",
    cron: "0 0 * * *",
    category: "cleanup",
    apiParam: "expired-packages",
  },
  {
    name: "processFrozenPackages",
    displayName: "Unfreeze Packages",
    description: "Reactivates frozen packages whose freeze period has ended",
    frequency: "Daily at midnight",
    cron: "0 0 * * *",
    category: "cleanup",
    apiParam: "frozen-packages",
  },
];

export default function CronJobsPage() {
  const { user } = useAuth();
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistory[]>([]);
  const [lastRunResults, setLastRunResults] = useState<JobResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const runJob = async (jobParam: string, jobName: string) => {
    setRunningJob(jobParam);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/cron?job=${jobParam}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to run job");
      }

      // Add to history
      const results = data.data.results as JobResult[];
      const newHistory: RunHistory[] = results.map((r) => ({
        jobName: r.jobName,
        timestamp: new Date(),
        success: r.success,
        duration: r.duration,
        details: r.details,
        error: r.error,
      }));

      setRunHistory((prev) => [...newHistory, ...prev].slice(0, 50)); // Keep last 50
      setLastRunResults(results);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount === 0) {
        setSuccessMessage(
          `✅ ${jobParam === "all" ? "All jobs" : jobName} completed successfully! (${successCount} job${successCount > 1 ? "s" : ""}, ${data.data.summary.totalDuration}ms)`
        );
      } else {
        setError(
          `⚠️ ${successCount} succeeded, ${failCount} failed. Check details below.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setRunHistory((prev) => [
        {
          jobName,
          timestamp: new Date(),
          success: false,
          duration: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        },
        ...prev,
      ].slice(0, 50));
    } finally {
      setRunningJob(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "notifications":
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      case "maintenance":
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "cleanup":
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "notifications":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "maintenance":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "cleanup":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const groupedJobs = {
    notifications: CRON_JOBS.filter((j) => j.category === "notifications"),
    maintenance: CRON_JOBS.filter((j) => j.category === "maintenance"),
    cleanup: CRON_JOBS.filter((j) => j.category === "cleanup"),
  };

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Cron Jobs" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scheduled Jobs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage and trigger background automation tasks
            </p>
          </div>
        </div>
        <button
          onClick={() => runJob("all", "All Jobs")}
          disabled={runningJob !== null}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold text-white hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg"
        >
          {runningJob === "all" ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running All...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run All Jobs
            </>
          )}
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupedJobs.notifications.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Notification Jobs</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupedJobs.maintenance.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Maintenance Jobs</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupedJobs.cleanup.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cleanup Jobs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Job Categories */}
      {Object.entries(groupedJobs).map(([category, jobs]) => (
        <div key={category} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-lg ${getCategoryColor(category)}`}>
                {getCategoryIcon(category)}
              </span>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                {category} Jobs
              </h2>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {jobs.map((job) => (
              <div key={job.name} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{job.displayName}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        {job.frequency}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{job.description}</p>
                    <p className="mt-2 text-xs font-mono text-gray-400 dark:text-gray-500">
                      Cron: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">{job.cron}</code>
                    </p>
                  </div>
                  <button
                    onClick={() => runJob(job.apiParam, job.displayName)}
                    disabled={runningJob !== null}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      runningJob === job.apiParam
                        ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {runningJob === job.apiParam ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Running...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                        Run Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Last Run Results */}
      {lastRunResults && lastRunResults.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Last Run Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Job</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lastRunResults.map((result, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900 dark:text-white">{result.jobName}</span>
                    </td>
                    <td className="px-6 py-4">
                      {result.success ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {result.duration}ms
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {result.error ? (
                        <span className="text-red-600 dark:text-red-400">{result.error}</span>
                      ) : (
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {JSON.stringify(result.details).slice(0, 100)}
                          {JSON.stringify(result.details).length > 100 ? "..." : ""}
                        </code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Run History */}
      {runHistory.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Run History (This Session)</h2>
            <button
              onClick={() => setRunHistory([])}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Clear
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {runHistory.map((entry, idx) => (
                <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <div className="flex items-center gap-3">
                    {entry.success ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.jobName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.duration}ms
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <svg className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-blue-800 dark:text-blue-300">Production Setup</p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              In production, these jobs should run automatically via Supabase pg_cron or Vercel Cron. 
              This page is for manual testing and one-off runs. See <code className="bg-blue-100 dark:bg-blue-800/50 px-1 rounded">CRON_JOBS.md</code> for setup instructions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
