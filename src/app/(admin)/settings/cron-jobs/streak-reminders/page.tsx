"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

type Status = "sent" | "due" | "booked" | "opted_out" | "no_profile";
type Tab = "sent" | "booked" | "due" | "skipped" | "all";

interface Member {
  userId: string;
  name: string | null;
  email: string | null;
  streakWeeks: number;
  lastReminderWeek: string | null;
  status: Status;
}

interface Recipient {
  userId: string;
  name: string | null;
  email: string | null;
  streakWeeks: number;
  sentAt: string | null;
}

interface StreakData {
  week: string;
  currentWeek: string;
  weeks: string[];
  recipients: Recipient[];
  members: Member[] | null;
}

interface Row {
  userId: string;
  name: string | null;
  email: string | null;
  streakWeeks: number;
  status: Status;
  sentAt: string | null;
}

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const field = "w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-400 focus:bg-white dark:border-white/10 dark:bg-gray-900 dark:text-white";

const STATUS: Record<Status, { label: string; hint: string; bar: string; badge: string }> = {
  sent: { label: "Emailed", hint: "Got this week's reminder", bar: "bg-[#C9DB3F]", badge: "bg-[#E4F56C] text-neutral-950" },
  booked: { label: "Booked", hint: "Already came in or booked this week, so no email needed", bar: "bg-neutral-900 dark:bg-white", badge: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950" },
  due: { label: "Due", hint: "Will be emailed on the next run", bar: "bg-sky-400", badge: "bg-sky-100 text-sky-800" },
  opted_out: { label: "Opted out", hint: "Turned off email notifications", bar: "bg-orange-400", badge: "bg-orange-100 text-orange-800" },
  no_profile: { label: "Can't email", hint: "Inactive, or missing a name or email", bar: "bg-red-400", badge: "bg-red-100 text-red-700" },
};

const BAR_ORDER: Status[] = ["sent", "booked", "due", "opted_out", "no_profile"];

const AVATAR_COLORS = [
  "bg-[#E4F56C] text-neutral-950",
  "bg-sky-100 text-sky-800",
  "bg-orange-100 text-orange-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
  "bg-pink-100 text-pink-800",
];

function initials(name: string | null, email: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatWeek(weekStart: string) {
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(Date.UTC(year, month - 1, day + 6));
  const fmt = (date: Date) => date.toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatSentAt(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
  });
}

/** Next Friday 9:00 AM Singapore time (01:00 UTC). */
function nextRun(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1, 0, 0));
  while (next.getUTCDay() !== 5 || next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.toLocaleString("en-SG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });
}

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${
        tone === "ok" ? "bg-[#E4F56C]/50 text-neutral-950" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
      }`}
    >
      {children}
    </div>
  );
}

export default function StreakRemindersPage() {
  const [data, setData] = useState<StreakData | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sent");
  const [search, setSearch] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testName, setTestName] = useState("");
  const [testWeeks, setTestWeeks] = useState(4);
  const [sending, setSending] = useState(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [frameHeight, setFrameHeight] = useState(560);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (selectedWeek: string | null) => {
    setLoading(true);
    setLoadError(null);
    const query = selectedWeek ? `?week=${selectedWeek}` : "";
    const response = await api.get<{ success: boolean; data: StreakData }>(`/api/streak-reminders${query}`);
    if (response.error || !response.data?.data) {
      setLoadError(response.error?.message || "Could not load streak reminders");
    } else {
      setData(response.data.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(week);
  }, [load, week]);

  const loadPreview = useCallback(async (name: string, weeks: number) => {
    setPreviewLoading(true);
    setPreviewError(null);
    const params = new URLSearchParams({ streakWeeks: String(weeks) });
    if (name.trim()) params.set("name", name.trim());
    const response = await api.get<{ success: boolean; data: { subject: string; html: string } }>(
      `/api/streak-reminders/preview?${params.toString()}`,
    );
    if (response.error || !response.data?.data) {
      setPreviewError(response.error?.message || "Could not render the email");
    } else {
      setPreview(response.data.data);
    }
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadPreview(testName, testWeeks), 400);
    return () => clearTimeout(timer);
  }, [loadPreview, testName, testWeeks]);

  const fitFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) setFrameHeight(Math.max(400, doc.documentElement.scrollHeight));
  };

  useEffect(() => {
    fitFrame();
  }, [device, preview]);

  const sendTest = async () => {
    setSending(true);
    setTestMessage(null);
    const body: Record<string, unknown> = { streakWeeks: testWeeks };
    if (testEmail.trim()) body.email = testEmail.trim();
    if (testName.trim()) body.name = testName.trim();
    const response = await api.post<{ success: boolean; data: { email: string } }>("/api/streak-reminders/test", body);
    if (response.error || !response.data?.success) {
      setTestMessage({ ok: false, text: response.error?.message || "Email failed to send" });
    } else {
      setTestMessage({ ok: true, text: `Sent to ${response.data.data.email}. Give it a minute and check spam too.` });
    }
    setSending(false);
  };

  const counts = useMemo(() => {
    const result: Record<Status, number> = { sent: 0, due: 0, booked: 0, opted_out: 0, no_profile: 0 };
    for (const member of data?.members || []) result[member.status]++;
    return result;
  }, [data]);

  const runNow = async () => {
    if (!window.confirm(`Send the real streak reminder to ${counts.due} member${counts.due === 1 ? "" : "s"} now?`)) return;
    setRunning(true);
    setRunMessage(null);
    const response = await api.post<{
      success: boolean;
      data: { results: Array<{ success: boolean; error?: string; details: { sent?: number; skipped?: number } }> };
    }>("/api/cron?job=streak-reminders", {});
    const result = response.data?.data?.results?.[0];
    if (response.error || !result?.success) {
      setRunMessage({ ok: false, text: response.error?.message || result?.error || "Run failed" });
    } else {
      setRunMessage({ ok: true, text: `Sent ${result.details.sent ?? 0}, skipped ${result.details.skipped ?? 0}.` });
    }
    setRunning(false);
    load(week);
  };

  const isCurrentWeek = data ? data.week === data.currentWeek : true;
  const total = data?.members?.length ?? 0;
  const skippedCount = counts.opted_out + counts.no_profile;

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const sentAt = new Map(data.recipients.map((r) => [r.userId, r.sentAt]));
    if (!isCurrentWeek || !data.members) {
      return data.recipients.map((r) => ({ ...r, status: "sent" as Status }));
    }
    return data.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      streakWeeks: m.streakWeeks,
      status: m.status,
      sentAt: sentAt.get(m.userId) ?? null,
    }));
  }, [data, isCurrentWeek]);

  const activeTab: Tab = isCurrentWeek ? tab : "sent";
  const term = search.trim().toLowerCase();
  const visibleRows = rows
    .filter((row) => {
      if (activeTab === "all") return true;
      if (activeTab === "skipped") return row.status === "opted_out" || row.status === "no_profile";
      return row.status === activeTab;
    })
    .filter((row) => !term || (row.name || "").toLowerCase().includes(term) || (row.email || "").toLowerCase().includes(term))
    .sort((a, b) => b.streakWeeks - a.streakWeeks || (a.name || "").localeCompare(b.name || ""));

  const tabs: Array<{ id: Tab; label: string; count: number }> = isCurrentWeek
    ? [
        { id: "sent", label: "Emailed", count: counts.sent },
        { id: "booked", label: "Booked", count: counts.booked },
        { id: "due", label: "Due", count: counts.due },
        { id: "skipped", label: "Skipped", count: skippedCount },
        { id: "all", label: "All", count: total },
      ]
    : [{ id: "sent", label: "Emailed", count: data?.recipients.length ?? 0 }];

  const emptyText: Record<Tab, string> = {
    sent: isCurrentWeek ? "No one has been emailed this week yet." : "No reminders recorded for this week.",
    booked: "No one with a streak has booked this week yet.",
    due: "Everyone's covered. No one is waiting for an email.",
    skipped: "No one was skipped.",
    all: "No members have a live streak.",
  };

  return (
    <div className="min-w-0 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/settings/cron-jobs" className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            <span aria-hidden>←</span> Cron jobs
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Week streak reminders</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Every Friday, members with a live streak who haven&apos;t come in or booked get one nudge to keep it going.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:border-white/10 dark:text-white/70">
            Next run · {nextRun()} SGT
          </span>
          <button
            type="button"
            onClick={runNow}
            disabled={running || !data?.members || counts.due === 0}
            title={counts.due === 0 ? "No one is due this week" : undefined}
            className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950"
          >
            {running ? "Sending…" : `Send to ${counts.due} due now`}
          </button>
        </div>
      </div>

      {runMessage && <Notice tone={runMessage.ok ? "ok" : "error"}>{runMessage.text}</Notice>}
      {loadError && <Notice tone="error">{loadError}</Notice>}

      {/* Summary */}
      {isCurrentWeek && data?.members && (
        <section className={`${card} p-5 sm:p-6`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">This week · {formatWeek(data.week)}</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                {counts.sent + counts.booked}
                <span className="text-2xl text-neutral-300 dark:text-white/30"> / {total}</span>
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                streak members handled — {counts.sent} emailed, {counts.booked} already booked
              </p>
            </div>

            <div className="w-full lg:max-w-xl">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                {BAR_ORDER.map((status) =>
                  counts[status] > 0 ? (
                    <div
                      key={status}
                      className={`${STATUS[status].bar} h-full transition-all`}
                      style={{ width: `${(counts[status] / Math.max(total, 1)) * 100}%` }}
                      title={`${STATUS[status].label}: ${counts[status]}`}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {BAR_ORDER.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setTab(status === "opted_out" || status === "no_profile" ? "skipped" : (status as Tab))}
                    title={STATUS[status].hint}
                    className={`flex items-center gap-2 text-xs ${counts[status] === 0 ? "text-neutral-300 dark:text-white/30" : "text-neutral-600 dark:text-white/70"}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS[status].bar} ${counts[status] === 0 ? "opacity-30" : ""}`} />
                    <span className="font-semibold text-neutral-950 dark:text-white">{counts[status]}</span>
                    {STATUS[status].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Members */}
        <section className={`${card} min-w-0 overflow-hidden`}>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">Members</h2>
              <select
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 outline-none dark:border-white/10 dark:bg-gray-900 dark:text-white"
                value={data?.week || ""}
                onChange={(e) => setWeek(e.target.value)}
                disabled={!data}
              >
                {(data?.weeks || []).map((value, index) => (
                  <option key={value} value={value}>
                    {index === 0 ? `This week (${formatWeek(value)})` : formatWeek(value)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === item.id
                        ? "bg-white text-neutral-950 shadow-sm dark:bg-gray-700 dark:text-white"
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    {item.label}
                    <span className={`ml-1.5 ${activeTab === item.id ? "text-neutral-400" : "text-neutral-400/70"}`}>{item.count}</span>
                  </button>
                ))}
              </div>
              <input
                className="w-full rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm outline-none focus:border-neutral-400 dark:border-white/10 dark:bg-gray-900 dark:text-white lg:w-60"
                type="search"
                placeholder="Search name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <ul className="divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-white/5 dark:border-white/5">
            {loading && !data ? (
              Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-100 dark:bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 animate-pulse rounded bg-neutral-100 dark:bg-white/10" />
                    <div className="h-3 w-56 animate-pulse rounded bg-neutral-100 dark:bg-white/10" />
                  </div>
                </li>
              ))
            ) : visibleRows.length === 0 ? (
              <li className="px-6 py-14 text-center text-sm text-neutral-400">{term ? "No members match your search." : emptyText[activeTab]}</li>
            ) : (
              visibleRows.map((row) => {
                const sentAt = formatSentAt(row.sentAt);
                return (
                  <li key={row.userId} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-neutral-50 dark:hover:bg-white/5 sm:px-6">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(row.userId)}`}>
                      {initials(row.name, row.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{row.name || "No name"}</p>
                      <p className="truncate text-xs text-neutral-500">{row.email || "No email"}</p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {row.streakWeeks}
                        <span className="ml-0.5 text-xs font-medium text-neutral-400">{row.streakWeeks === 1 ? "week" : "weeks"}</span>
                      </p>
                      <p className="text-[11px] text-neutral-400">streak</p>
                    </div>
                    <div className="w-32 shrink-0 text-right">
                      <span title={STATUS[row.status].hint} className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS[row.status].badge}`}>
                        {STATUS[row.status].label}
                      </span>
                      {row.status === "sent" && sentAt ? <p className="mt-1 text-[11px] text-neutral-400">{sentAt}</p> : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {!isCurrentWeek && (
            <p className="border-t border-neutral-100 px-6 py-3 text-xs text-neutral-400 dark:border-white/5">
              Only each member&apos;s latest reminder is stored, so past weeks leave out anyone who was reminded again later.
            </p>
          )}
        </section>

        {/* Test + preview */}
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          <section className={`${card} p-5 sm:p-6`}>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">Send yourself a test</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              The same email members get. It won&apos;t count as anyone&apos;s weekly reminder.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">Send to</span>
                <input className={field} type="email" placeholder="Your account email (default)" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-neutral-500">Name in greeting</span>
                  <input className={field} type="text" placeholder="Your name" value={testName} onChange={(e) => setTestName(e.target.value)} />
                </label>
                <div>
                  <span className="mb-1 block text-xs font-semibold text-neutral-500">Streak</span>
                  <div className="flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-gray-900">
                    <button type="button" onClick={() => setTestWeeks((w) => Math.max(1, w - 1))} className="px-3 py-2.5 text-sm font-semibold text-neutral-500 hover:text-neutral-950 dark:hover:text-white" aria-label="Fewer weeks">−</button>
                    <span className="w-8 text-center text-sm font-semibold text-neutral-950 dark:text-white">{testWeeks}</span>
                    <button type="button" onClick={() => setTestWeeks((w) => Math.min(52, w + 1))} className="px-3 py-2.5 text-sm font-semibold text-neutral-500 hover:text-neutral-950 dark:hover:text-white" aria-label="More weeks">+</button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={sendTest}
              disabled={sending}
              className="mt-4 w-full rounded-full bg-[#E4F56C] px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:brightness-95 disabled:opacity-50"
            >
              {sending ? "Sending…" : testEmail.trim() ? `Send test to ${testEmail.trim()}` : "Send test to me"}
            </button>
            {testMessage && <div className="mt-3"><Notice tone={testMessage.ok ? "ok" : "error"}>{testMessage.text}</Notice></div>}
          </section>

          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">Preview</h2>
              <div className="flex rounded-full bg-neutral-100 p-1 dark:bg-white/5">
                {(["mobile", "desktop"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDevice(option)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                      device === option ? "bg-white text-neutral-950 shadow-sm dark:bg-gray-700 dark:text-white" : "text-neutral-500"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 dark:border-white/10 sm:mx-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[11px] font-bold text-[#E4F56C]">OS</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-950 dark:text-white">One Step Fitness</p>
                <p className="truncate text-sm font-medium text-neutral-700 dark:text-white/80">
                  {preview?.subject || (previewLoading ? "Loading…" : "—")}
                </p>
              </div>
            </div>

            <div className="mt-4 bg-neutral-100 px-4 py-5 dark:bg-gray-900">
              {previewError ? (
                <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 text-center dark:bg-gray-800">
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Preview unavailable</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">{previewError}</p>
                  <button type="button" onClick={() => loadPreview(testName, testWeeks)} className="mt-3 text-xs font-semibold text-neutral-950 underline dark:text-white">
                    Try again
                  </button>
                </div>
              ) : preview ? (
                <div
                  className={`mx-auto overflow-hidden bg-white shadow-lg transition-all ${
                    device === "mobile" ? "max-w-[375px] rounded-[28px] border-[6px] border-neutral-950" : "w-full rounded-xl"
                  } ${previewLoading ? "opacity-60" : ""}`}
                >
                  <iframe
                    ref={frameRef}
                    title="Streak reminder email preview"
                    srcDoc={preview.html}
                    sandbox="allow-same-origin"
                    onLoad={fitFrame}
                    style={{ height: frameHeight }}
                    className="block w-full"
                  />
                </div>
              ) : (
                <div className="mx-auto h-[400px] max-w-[375px] animate-pulse rounded-[28px] bg-white/70 dark:bg-white/5" />
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
