"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

interface CronJob {
  name: string;
  displayName: string;
  description: string;
  note?: string;
  frequency: string;
  cron: string;
  category: "notifications" | "payments" | "maintenance" | "cleanup";
  apiParam: string;
  inAll: boolean;
  detailHref?: string;
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

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

const CRON_JOBS: CronJob[] = [
  {
    name: "sendClassReminders",
    displayName: "Class reminders",
    description: "Sends an email and an in-app reminder when a class starts in 1 hour, to members and trial guests.",
    frequency: "Every 15 minutes",
    cron: "*/15 * * * *",
    category: "notifications",
    apiParam: "class-reminders",
    inAll: false,
  },
  {
    name: "sendStreakReminders",
    displayName: "Week streak reminders",
    description: "Emails members on Friday if their week streak will break unless they come in. One email per member per week.",
    note: "Not included in Run all. cron-job.org: POST or GET with Authorization: Bearer CRON_SECRET. Set the request timeout to 90s.",
    frequency: "Friday 9:00 AM SGT",
    cron: "0 1 * * 5",
    category: "notifications",
    apiParam: "streak-reminders",
    inAll: false,
    detailHref: "/settings/cron-jobs/streak-reminders",
  },
  {
    name: "sendBirthdayWishes",
    displayName: "Birthday wishes",
    description: "Emails a birthday wish to members whose birthday is today. One per birthday, and skips anyone already wished from Celebrate.",
    note: "Not included in Run all. cron-job.org: GET or POST /api/cron?job=birthday-wishes with Authorization: Bearer CRON_SECRET.",
    frequency: "Daily 9:00 AM SGT",
    cron: "0 1 * * *",
    category: "notifications",
    apiParam: "birthday-wishes",
    inAll: false,
    detailHref: "/settings/celebrate",
  },
  {
    name: "sendTokenExpiryWarnings",
    displayName: "Token expiry warnings",
    description: "Warns members whose token packages expire in 3 days.",
    frequency: "Daily at 9:00 AM",
    cron: "0 9 * * *",
    category: "notifications",
    apiParam: "token-warnings",
    inAll: false,
  },
  {
    name: "sendTokenBalanceLowWarnings",
    displayName: "Low token balance",
    description: "Warns members when their token balance drops below 3.",
    frequency: "Daily at 10:00 AM",
    cron: "0 10 * * *",
    category: "notifications",
    apiParam: "token-balance",
    inAll: true,
  },
  {
    name: "processExpiredWaitlistNotifications",
    displayName: "Waitlist expiry",
    description: "Expires waitlist offers after 24 hours and notifies the next person.",
    frequency: "Every 15 minutes",
    cron: "*/15 * * * *",
    category: "notifications",
    apiParam: "waitlist-expiry",
    inAll: true,
  },
  {
    name: "processLeadOutreachQueue",
    displayName: "Lead outreach",
    description: "Sends queued lead follow-up emails and WhatsApp messages in batches.",
    frequency: "Every 2 minutes",
    cron: "*/2 * * * *",
    category: "notifications",
    apiParam: "process-lead-outreach",
    inAll: false,
  },
  {
    name: "syncPendingHitPayPayments",
    displayName: "Sync payments",
    description: "Checks HitPay for pending payments and issues tokens when a payment is confirmed.",
    note: "Running this also sends checkout reminders.",
    frequency: "Every 15 minutes",
    cron: "*/15 * * * *",
    category: "payments",
    apiParam: "sync-pending-payments",
    inAll: true,
  },
  {
    name: "sendCheckoutReminders",
    displayName: "Checkout reminders",
    description: "Emails people who started checkout 1–48 hours ago and never paid. One reminder each.",
    frequency: "Every 15 minutes",
    cron: "*/15 * * * *",
    category: "payments",
    apiParam: "checkout-reminders",
    inAll: true,
  },
  {
    name: "processCompletedBookings",
    displayName: "Mark classes attended",
    description: "Marks bookings attended 30 minutes after class ends. Staff can still mark a no-show. Tokens are not touched.",
    frequency: "Every hour",
    cron: "0 * * * *",
    category: "maintenance",
    apiParam: "no-shows",
    inAll: true,
  },
  {
    name: "autoGenerateFutureClasses",
    displayName: "Generate future classes",
    description: "Adds more dates for recurring classes when the last one is inside two weeks. Keeps about 8–12 weeks on the schedule.",
    frequency: "Daily at 2:00 AM",
    cron: "0 2 * * *",
    category: "maintenance",
    apiParam: "generate-future-classes",
    inAll: true,
  },
  {
    name: "markCompletedClasses",
    displayName: "Mark completed classes",
    description: "Marks past single, recurring, and course classes as completed.",
    frequency: "Daily at midnight",
    cron: "0 0 * * *",
    category: "maintenance",
    apiParam: "mark-completed-classes",
    inAll: true,
  },
  {
    name: "processExpiredPackages",
    displayName: "Expire packages",
    description: "Marks token packages past their expiry date as expired.",
    frequency: "Daily at midnight",
    cron: "0 0 * * *",
    category: "cleanup",
    apiParam: "expired-packages",
    inAll: true,
  },
  {
    name: "processFrozenPackages",
    displayName: "Unfreeze packages",
    description: "Reactivates frozen packages whose freeze period has ended.",
    frequency: "Daily at midnight",
    cron: "0 0 * * *",
    category: "cleanup",
    apiParam: "frozen-packages",
    inAll: true,
  },
];

const categories = [
  { id: "all" as const, label: "All jobs" },
  { id: "notifications" as const, label: "Notifications" },
  { id: "payments" as const, label: "Payments" },
  { id: "maintenance" as const, label: "Maintenance" },
  { id: "cleanup" as const, label: "Cleanup" },
];

function labelFor(key: string) {
  const spaced = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: unknown): { text: string; block: boolean } {
  if (value == null || value === "") return { text: "—", block: false };
  if (typeof value === "boolean") return { text: value ? "Yes" : "No", block: false };
  if (typeof value === "number" || typeof value === "string") return { text: String(value), block: false };
  if (Array.isArray(value)) {
    if (value.length === 0) return { text: "None", block: false };
    if (value.every((item) => item == null || ["string", "number", "boolean"].includes(typeof item))) {
      const text = value.map(String).join(", ");
      return { text, block: text.length > 80 };
    }
    return { text: JSON.stringify(value, null, 2), block: true };
  }
  return { text: JSON.stringify(value, null, 2), block: true };
}

function displayNameFor(jobName: string) {
  return CRON_JOBS.find((job) => job.name === jobName)?.displayName || jobName;
}

export default function CronJobsPage() {
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistory[]>([]);
  const [lastRunResults, setLastRunResults] = useState<JobResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof categories)[number]["id"]>("all");
  const [openJob, setOpenJob] = useState<CronJob | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const runJob = async (jobParam: string, jobName: string) => {
    setRunningJob(jobParam);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await api.post<{
        success: boolean;
        data: { results: JobResult[]; summary: { totalDuration: number } };
        error?: { message?: string };
      }>(`/api/cron?job=${jobParam}`, {});

      if (response.error) throw new Error(response.error.message || "Failed to run job");

      const data = response.data;
      if (!data?.success || !data.data?.results) {
        throw new Error(data?.error?.message || "Failed to run job");
      }

      const results = data.data.results as JobResult[];
      const newHistory: RunHistory[] = results.map((result) => ({
        jobName: result.jobName,
        timestamp: new Date(),
        success: result.success,
        duration: result.duration,
        details: result.details,
        error: result.error,
      }));

      setRunHistory((prev) => [...newHistory, ...prev].slice(0, 50));
      setLastRunResults(results);

      const successCount = results.filter((result) => result.success).length;
      const failCount = results.filter((result) => !result.success).length;
      const duration = data.data?.summary?.totalDuration ?? 0;

      if (failCount === 0) {
        setSuccessMessage(`${jobName} finished. ${successCount} job${successCount === 1 ? "" : "s"} in ${duration}ms.`);
      } else {
        setError(`${successCount} succeeded, ${failCount} failed. Open a row to see why.`);
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

  const visible = category === "all" ? CRON_JOBS : CRON_JOBS.filter((job) => job.category === category);
  const latest = openJob ? runHistory.find((entry) => entry.jobName === openJob.name) : undefined;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Cron jobs</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Manual runs for testing. Open a job for the full description and the last result. Run all skips class reminders, streak, birthdays, token expiry, and lead outreach.
          </p>
        </div>
        <button
          type="button"
          onClick={() => runJob("all", "All jobs")}
          disabled={runningJob !== null}
          className="rounded-full bg-[#E4F56C] px-5 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
        >
          {runningJob === "all" ? "Running all…" : "Run all"}
        </button>
      </div>

      {successMessage && (
        <div className="rounded-[22px] border border-[#d5e45c] bg-[#E4F56C]/40 px-4 py-3 text-sm font-medium text-neutral-950">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((item) => {
          const count = item.id === "all" ? CRON_JOBS.length : CRON_JOBS.filter((job) => job.category === item.id).length;
          const selected = category === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`min-h-[112px] rounded-[28px] border p-5 text-left shadow-[0_10px_30px_rgba(16,24,40,0.05)] ${
                selected
                  ? "border-[#d5e45c] bg-[#E4F56C] text-neutral-950"
                  : "border-neutral-200/80 bg-white text-neutral-950 dark:border-white/10 dark:bg-gray-800 dark:text-white"
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${selected ? "text-neutral-950/70" : "text-neutral-400"}`}>{item.label}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{count}</p>
            </button>
          );
        })}
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <th className="px-5 py-3 font-semibold">Job</th>
                <th className="px-3 py-3 font-semibold">Schedule</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => (
                <tr key={job.name} className="border-t border-neutral-200 dark:border-white/10">
                  <td className="px-5 py-3">
                    <p className="font-medium text-neutral-950 dark:text-white">{job.displayName}</p>
                    <p className="mt-0.5 max-w-md truncate text-xs text-neutral-400">{job.description}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-semibold text-white">{job.frequency}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {job.detailHref ? (
                      <Link
                        href={job.detailHref}
                        className="mr-2 rounded-full bg-[#E4F56C] px-3 py-1.5 text-xs font-semibold text-neutral-950"
                      >
                        Open
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpenJob(job)}
                      className="mr-2 rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => runJob(job.apiParam, job.displayName)}
                      disabled={runningJob !== null}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-40 dark:border-white/10 dark:text-white"
                    >
                      {runningJob === job.apiParam ? "Running…" : "Run"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {lastRunResults && lastRunResults.length > 0 && (
        <section className={`${card} p-5 sm:p-6`}>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Last run</h2>
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-white/10">
            {lastRunResults.map((result, index) => {
              const job = CRON_JOBS.find((item) => item.name === result.jobName);
              return (
                <li key={`${result.jobName}-${index}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-950 dark:text-white">{displayNameFor(result.jobName)}</p>
                    <p className="text-xs text-neutral-400">{result.duration}ms{result.error ? ` · ${result.error}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${result.success ? "bg-[#E4F56C] text-neutral-950" : "bg-red-600 text-white"}`}>
                      {result.success ? "Success" : "Failed"}
                    </span>
                    {job ? (
                      <button type="button" onClick={() => setOpenJob(job)} className="text-xs font-semibold text-neutral-700 dark:text-white">
                        Details
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {runHistory.length > 0 && (
        <section className={`${card} p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">This session</h2>
            <button type="button" onClick={() => setRunHistory([])} className="text-xs font-semibold text-neutral-500">
              Clear
            </button>
          </div>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {runHistory.map((entry, index) => {
              const job = CRON_JOBS.find((item) => item.name === entry.jobName);
              return (
                <li key={`${entry.jobName}-${entry.timestamp.getTime()}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <button type="button" onClick={() => job && setOpenJob(job)} className="flex min-w-0 items-center gap-2 text-left">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${entry.success ? "bg-[#E4F56C]" : "bg-red-600"}`} />
                    <span className="truncate font-medium text-neutral-950 dark:text-white">{displayNameFor(entry.jobName)}</span>
                  </button>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {entry.duration}ms · {entry.timestamp.toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore" })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-xs leading-5 text-neutral-400">
        Run here is a one-off test. Production should use Supabase pg_cron or Vercel Cron. Setup notes are in CRON_JOBS.md.
      </p>

      {openJob && (
        <div className="fixed inset-0 z-[100000] flex justify-end bg-neutral-950/40" onClick={() => setOpenJob(null)}>
          <aside
            className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-2xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{openJob.category}</p>
                <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{openJob.displayName}</h2>
              </div>
              <button type="button" onClick={() => setOpenJob(null)} className="rounded-full px-3 py-1 text-sm font-semibold text-neutral-500">
                Close
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-white/80">{openJob.description}</p>
            {openJob.note ? <p className="mt-3 text-sm leading-6 text-neutral-500">{openJob.note}</p> : null}
            {openJob.detailHref ? (
              <Link href={openJob.detailHref} className="mt-4 inline-block text-sm font-semibold text-neutral-950 underline dark:text-white">
                Open the {openJob.displayName.toLowerCase()} page →
              </Link>
            ) : null}

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Schedule</dt>
                <dd className="text-right font-medium text-neutral-950 dark:text-white">{openJob.frequency}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Cron</dt>
                <dd className="font-mono text-neutral-950 dark:text-white">{openJob.cron}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Run all</dt>
                <dd className="font-medium text-neutral-950 dark:text-white">{openJob.inAll ? "Included" : "Separate"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400">Request</dt>
                <dd className="mt-1 break-all font-mono text-xs text-neutral-700 dark:text-white/80">POST /api/cron?job={openJob.apiParam}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => runJob(openJob.apiParam, openJob.displayName)}
              disabled={runningJob !== null}
              className="mt-6 rounded-full bg-[#E4F56C] px-5 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
            >
              {runningJob === openJob.apiParam ? "Running…" : "Run this job"}
            </button>

            <div className="mt-8 border-t border-neutral-200 pt-5 dark:border-white/10">
              <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">Latest result</h3>
              {!latest ? (
                <p className="mt-2 text-sm text-neutral-400">No run yet this session.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${latest.success ? "bg-[#E4F56C] text-neutral-950" : "bg-red-600 text-white"}`}>
                      {latest.success ? "Success" : "Failed"}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {latest.duration}ms · {latest.timestamp.toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore" })}
                    </span>
                  </div>
                  {latest.error ? <p className="text-sm text-red-600">{latest.error}</p> : null}
                  {Object.keys(latest.details || {}).length === 0 && !latest.error ? (
                    <p className="text-sm text-neutral-400">The job finished with no extra numbers.</p>
                  ) : (
                    <dl className="space-y-3">
                      {Object.entries(latest.details || {}).map(([key, value]) => {
                        const formatted = formatValue(value);
                        return (
                          <div key={key}>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{labelFor(key)}</dt>
                            {formatted.block ? (
                              <dd className="mt-1 overflow-x-auto rounded-2xl bg-neutral-950 p-3 font-mono text-xs leading-5 text-[#E4F56C]">{formatted.text}</dd>
                            ) : (
                              <dd className="mt-1 text-sm text-neutral-950 dark:text-white">{formatted.text}</dd>
                            )}
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
