"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

type ServiceStatus = "up" | "slow" | "down" | "off";

interface ServiceHealth {
  id: string;
  label: string;
  address: string;
  status: ServiceStatus;
  ms: number | null;
  detail: string;
}

interface HealthData {
  checkedAt: string;
  cachedUntil?: string;
  services: ServiceHealth[];
  database: {
    databaseBytes: number;
    connections: number;
    activeConnections: number;
    maxConnections: number;
    cacheHitRatio: number | null;
    startedAt: string;
    tables: { name: string; rows: number; bytes: number }[];
    storage: { bucket: string; files: number; bytes: number }[];
  } | null;
  activity: {
    members: number;
    newMembersToday: number;
    bookingsToday: number;
    paymentsToday: { paid: number; pending: number; failed: number; amount: number };
    emailsToday: { sent: number; failed: number };
    week: { date: string; bookings: number; paid: number }[];
  } | null;
  jobs: { runs: number; failed: number; lastRunAt: string | null } | null;
}

const HISTORY = 20;

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

const statusLabel: Record<ServiceStatus, string> = { up: "Up", slow: "Slow", down: "Down", off: "Not connected" };
const statusClass: Record<ServiceStatus, string> = {
  up: "bg-[#E4F56C] text-neutral-950",
  slow: "bg-amber-100 text-amber-800",
  down: "bg-red-100 text-red-700",
  off: "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-300",
};
const dotClass: Record<ServiceStatus, string> = {
  up: "bg-[#C9DB3F]",
  slow: "bg-amber-500",
  down: "bg-red-600",
  off: "bg-neutral-300",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function formatMs(ms: number | null) {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Singapore" });
}

function since(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function Sparkline({ values, tone }: { values: (number | null)[]; tone: ServiceStatus }) {
  const width = 160;
  const height = 36;
  const points = values.map((v, i) => ({ v, i }));
  const numbers = values.filter((v): v is number => v != null);
  if (numbers.length < 2) {
    return <div className="h-9 text-[11px] text-neutral-400">Building a trend…</div>;
  }
  const max = Math.max(...numbers, 1);
  const step = width / Math.max(values.length - 1, 1);
  const path = points
    .filter((p) => p.v != null)
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${(p.i * step).toFixed(1)},${(height - 4 - ((p.v as number) / max) * (height - 8)).toFixed(1)}`)
    .join(" ");
  const stroke = tone === "down" ? "#dc2626" : tone === "slow" ? "#d97706" : "currentColor";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points
        .filter((p) => p.v == null)
        .map((p) => (
          <circle key={p.i} cx={p.i * step} cy={height - 4} r="2.5" fill="#dc2626" />
        ))}
    </svg>
  );
}

function Tile({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[28px] border p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] ${highlight ? "border-neutral-950 bg-[#E4F56C] text-neutral-950" : "border-neutral-200/80 bg-white text-neutral-950 dark:border-white/10 dark:bg-gray-800 dark:text-white"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${highlight ? "text-neutral-950/70" : "text-neutral-400"}`}>{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      {sub && <p className={`mt-1 text-xs ${highlight ? "text-neutral-950/70" : "text-neutral-400"}`}>{sub}</p>}
    </div>
  );
}

export default function JobHealthPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<Record<string, (number | null)[]>>({});
  const lastChecked = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: HealthData }>("/api/settings/job-health");
      if (response.error) throw new Error(response.error.message || "Could not check the services");
      return response.data?.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await api.get<{ success: boolean; data: HealthData }>("/api/settings/job-health?fresh=1");
      if (response.error) throw new Error(response.error.message || "Could not check the services");
      if (response.data?.data) queryClient.setQueryData(["system-health"], response.data.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!data || data.checkedAt === lastChecked.current) return;
    lastChecked.current = data.checkedAt;
    setHistory((prev) => {
      const next = { ...prev };
      for (const service of data.services) {
        next[service.id] = [...(prev[service.id] || []), service.ms].slice(-HISTORY);
      }
      return next;
    });
  }, [data]);

  const services = data?.services ?? [];
  const live = services.filter((s) => s.status !== "off");
  const upCount = live.filter((s) => s.status === "up" || s.status === "slow").length;
  const down = live.filter((s) => s.status === "down");
  const timings = live.map((s) => s.ms).filter((ms): ms is number => ms != null);
  const average = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : null;
  const db = data?.database;
  const activity = data?.activity;
  const maxTable = Math.max(1, ...(db?.tables.map((t) => t.bytes) ?? [1]));
  const weekMax = Math.max(1, ...(activity?.week.map((d) => Math.max(d.bookings, d.paid)) ?? [1]));

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Health</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
            <span className={`inline-block h-2 w-2 rounded-full ${isFetching ? "animate-pulse bg-[#C9DB3F]" : down.length ? "bg-red-600" : "bg-[#C9DB3F]"}`} />
            {isLoading
              ? "Checking…"
              : down.length
                ? `${down.map((s) => s.label).join(", ")} ${down.length === 1 ? "is" : "are"} down`
                : "All services answering"}
            {data?.checkedAt && (
              <span className="text-neutral-400">
                · checked {formatTime(data.checkedAt)}
                {data.cachedUntil ? " · cached ~2 min (light on Vercel)" : " · tap Check now to refresh"}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isFetching || refreshing}
          className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#E4F56C] dark:text-neutral-950"
        >
          {isFetching || refreshing ? "Checking…" : "Check now"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 py-16 text-sm text-neutral-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent dark:border-white dark:border-t-transparent" />
          Checking the services…
        </div>
      ) : error || !data ? (
        <div className={`${card} px-6 py-10 text-center`}>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">Couldn’t finish the check</h2>
          <p className="mt-1 text-sm text-neutral-500">Try again in a moment.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Services up" value={`${upCount}/${live.length}`} sub={down.length ? `${down.length} down` : "All answering"} highlight={down.length === 0} />
            <Tile label="Avg response" value={formatMs(average)} sub="Across live services" />
            <Tile label="Database size" value={db ? formatBytes(db.databaseBytes) : "—"} sub={db ? `Up ${since(db.startedAt)}` : "Not reported yet"} />
            <Tile label="Connections" value={db ? `${db.connections}/${db.maxConnections}` : "—"} sub={db ? `${db.activeConnections} working right now` : "Not reported yet"} />
            <Tile label="Cache hits" value={db?.cacheHitRatio != null ? `${db.cacheHitRatio}%` : "—"} sub="Reads served from memory" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => (
              <article key={service.id} className={`${card} p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass[service.status]}`} />
                      {service.label}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400">{service.address}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass[service.status]}`}>{statusLabel[service.status]}</span>
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">{formatMs(service.ms)}</p>
                <p className="text-xs text-neutral-500">{service.detail}</p>
                <div className="mt-3 text-neutral-950 dark:text-[#E4F56C]">
                  <Sparkline values={history[service.id] || []} tone={service.status} />
                </div>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <section className={`${card} p-5 sm:p-6`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">Supabase database</h2>
                {db && <span className="text-xs text-neutral-400">{formatBytes(db.databaseBytes)} total</span>}
              </div>
              {db ? (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">Largest tables</p>
                  <ul className="mt-2 space-y-2.5">
                    {db.tables.map((table) => (
                      <li key={table.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">{table.name.replaceAll("_", " ")}</span>
                          <span className="text-neutral-400">
                            {table.rows.toLocaleString()} rows · {formatBytes(table.bytes)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-neutral-100 dark:bg-white/10">
                          <div className="h-2 rounded-full bg-[#E4F56C]" style={{ width: `${Math.max(3, (table.bytes / maxTable) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-wide text-neutral-400">Connection pool</span>
                      <span className="text-neutral-400">{Math.round((db.connections / Math.max(db.maxConnections, 1)) * 100)}% in use</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-neutral-100 dark:bg-white/10">
                      <div className="h-2 rounded-full bg-neutral-950 dark:bg-white" style={{ width: `${Math.max(2, (db.connections / Math.max(db.maxConnections, 1)) * 100)}%` }} />
                    </div>
                  </div>
                  {db.storage.length > 0 && (
                    <>
                      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400">File storage</p>
                      <ul className="mt-2 divide-y divide-neutral-100 dark:divide-white/10">
                        {db.storage.map((bucket) => (
                          <li key={bucket.bucket} className="flex items-center justify-between py-2 text-xs">
                            <span className="font-medium text-neutral-800 dark:text-neutral-200">{bucket.bucket}</span>
                            <span className="text-neutral-400">
                              {bucket.files.toLocaleString()} files · {formatBytes(bucket.bytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
                  Run <span className="font-medium text-neutral-800 dark:text-neutral-200">20261031_system_metrics.sql</span> in the Supabase SQL editor to show size, connections, cache, tables, and storage here.
                </p>
              )}
            </section>

            <section className={`${card} p-5 sm:p-6`}>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">Today in the studio</h2>
              {activity ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      ["Members", activity.members.toLocaleString(), `+${activity.newMembersToday} today`],
                      ["Bookings", String(activity.bookingsToday), "Made today"],
                      ["Paid", `S$${activity.paymentsToday.amount.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`, `${activity.paymentsToday.paid} payments`],
                      ["Pending", String(activity.paymentsToday.pending), "Checkouts not finished"],
                      ["Failed payments", String(activity.paymentsToday.failed), "Today"],
                      ["Emails", String(activity.emailsToday.sent), activity.emailsToday.failed ? `${activity.emailsToday.failed} failed` : "None failed"],
                    ].map(([label, value, sub]) => (
                      <div key={label} className="rounded-2xl bg-neutral-50 p-3 dark:bg-white/5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
                        <p className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{value}</p>
                        <p className="text-[11px] text-neutral-400">{sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wide text-neutral-400">Last 7 days</span>
                    <span className="flex items-center gap-3 text-neutral-400">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neutral-950 dark:bg-white" />Bookings</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#C9DB3F]" />Paid</span>
                    </span>
                  </div>
                  <div className="mt-3 flex h-32 items-end gap-2">
                    {activity.week.map((day) => (
                      <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-24 w-full items-end justify-center gap-1">
                          <div className="w-1/3 rounded-t-md bg-neutral-950 dark:bg-white" style={{ height: `${(day.bookings / weekMax) * 100}%` }} title={`${day.bookings} bookings`} />
                          <div className="w-1/3 rounded-t-md bg-[#C9DB3F]" style={{ height: `${(day.paid / weekMax) * 100}%` }} title={`${day.paid} paid`} />
                        </div>
                        <span className="text-[10px] text-neutral-400">
                          {new Date(`${day.date}T00:00:00+08:00`).toLocaleDateString("en-SG", { weekday: "short", timeZone: "Asia/Singapore" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">Activity numbers are not available right now.</p>
              )}
            </section>
          </div>

          <section className={`${card} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">Scheduled jobs · last 24 hours</h2>
              <p className="text-xs text-neutral-500">
                {data.jobs
                  ? data.jobs.runs === 0
                    ? "No runs recorded yet."
                    : `${data.jobs.runs} runs · ${data.jobs.failed} needed a look${data.jobs.lastRunAt ? ` · last at ${formatTime(data.jobs.lastRunAt)}` : ""}`
                  : "Run 20261031_cron_job_runs.sql in Supabase to record job runs."}
              </p>
            </div>
            <Link href="/settings/cron-jobs" className="w-fit rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5">
              Open cron jobs
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
