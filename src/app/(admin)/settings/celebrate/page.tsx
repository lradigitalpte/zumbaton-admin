"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

interface BirthdayMember {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  nextBirthday: string;
  age: number;
  turning: number;
  isToday: boolean;
  daysUntil: number;
  isActive: boolean;
  emailOptedOut: boolean;
  celebrationYear: number;
  wished: boolean;
  wishedAt: string | null;
}

type Filter = "upcoming" | "recent" | "wished" | "all";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const PAGE_SIZE = 20;
const EARLY_CONFIRM_DAYS = 7;

const AVATAR_COLORS = [
  "bg-[#E4F56C] text-neutral-950",
  "bg-sky-100 text-sky-800",
  "bg-orange-100 text-orange-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
  "bg-pink-100 text-pink-800",
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string, email: string) {
  const parts = (name || email || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Formats a YYYY-MM-DD calendar date without shifting it through the browser's timezone. */
function formatDay(value: string, options: Intl.DateTimeFormatOptions) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-SG", { ...options, timeZone: "UTC" });
}

function formatWishedAt(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });
}

/** Birthday already passed this year but still inside the belated window. */
function isRecent(member: BirthdayMember) {
  return !member.isToday && member.celebrationYear < Number(member.nextBirthday.slice(0, 4));
}

function celebratedDate(member: BirthdayMember) {
  return isRecent(member) ? `${member.celebrationYear}${member.nextBirthday.slice(4)}` : member.nextBirthday;
}

function whenLabel(member: BirthdayMember) {
  if (member.isToday) return "Today";
  if (isRecent(member)) {
    const [y, m, d] = celebratedDate(member).split("-").map(Number);
    const [ny, nm, nd] = member.nextBirthday.split("-").map(Number);
    const daysAgo = Math.round((Date.UTC(ny, nm - 1, nd) - Date.UTC(y, m - 1, d)) / 86_400_000) - member.daysUntil;
    return daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;
  }
  if (member.daysUntil === 1) return "Tomorrow";
  if (member.daysUntil < 7) return `In ${member.daysUntil} days`;
  if (member.daysUntil < 60) return `In ${Math.round(member.daysUntil / 7)} wk${Math.round(member.daysUntil / 7) === 1 ? "" : "s"}`;
  return `In ${Math.round(member.daysUntil / 30)} mo`;
}

function nextRun(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.toLocaleString("en-SG", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });
}

function Avatar({ member, size = "md" }: { member: BirthdayMember; size?: "md" | "lg" }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${avatarColor(member.id)} ${
        size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-xs"
      }`}
    >
      {initials(member.name, member.email)}
    </div>
  );
}

function DateTile({ date, highlight }: { date: string; highlight?: boolean }) {
  return (
    <div
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl ${
        highlight ? "bg-neutral-950 text-[#E4F56C] dark:bg-white dark:text-neutral-950" : "bg-neutral-100 text-neutral-950 dark:bg-white/10 dark:text-white"
      }`}
    >
      <span className="text-[10px] font-semibold uppercase leading-none tracking-wide opacity-70">{formatDay(date, { month: "short" })}</span>
      <span className="mt-0.5 text-lg font-semibold leading-none">{formatDay(date, { day: "numeric" })}</span>
    </div>
  );
}

export default function CelebratePage() {
  const [members, setMembers] = useState<BirthdayMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const [page, setPage] = useState(0);
  const [running, setRunning] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const response = await api.get<{ success: boolean; data: BirthdayMember[] }>("/api/users/birthdays");
    if (response.error) {
      toast.showToast(response.error.message || "Failed to load birthdays", "error");
    } else {
      setMembers(response.data?.data || []);
    }
    setLoading(false);
    // toast identity changes every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendWish = async (member: BirthdayMember, resend = false) => {
    if (resend && !window.confirm(`${member.name} was already wished. Send another birthday email?`)) return;
    if (!resend && !member.isToday && !isRecent(member) && member.daysUntil > EARLY_CONFIRM_DAYS) {
      const ok = window.confirm(
        `${member.name}'s birthday is ${whenLabel(member).toLowerCase()}. Send the wish now? The automatic wish on the day will be skipped.`,
      );
      if (!ok) return;
    }

    setSendingId(member.id);
    const response = await api.post<{ success: boolean; wishedAt?: string; error?: { message?: string } }>(
      "/api/users/birthdays/send",
      { userId: member.id, resend },
    );
    if (response.error || !response.data?.success) {
      toast.showToast(response.error?.message || response.data?.error?.message || "Failed to send email", "error");
    } else {
      toast.showToast(`Birthday wish sent to ${member.name}`, "success");
      const wishedAt = response.data.wishedAt || new Date().toISOString();
      setMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, wished: true, wishedAt } : item)));
    }
    setSendingId(null);
  };

  const runToday = async () => {
    setRunning(true);
    const response = await api.post<{
      success: boolean;
      data: { results: Array<{ success: boolean; error?: string; details: { sent?: number; birthdaysToday?: number } }> };
    }>("/api/cron?job=birthday-wishes", {});
    const result = response.data?.data?.results?.[0];
    if (response.error || !result?.success) {
      toast.showToast(response.error?.message || result?.error || "Run failed", "error");
    } else {
      const sent = result.details.sent ?? 0;
      toast.showToast(sent === 0 ? "Nothing to send. Everyone with a birthday today is already wished." : `Sent ${sent} birthday wish${sent === 1 ? "" : "es"}`, "success");
      load();
    }
    setRunning(false);
  };

  const today = members.filter((m) => m.isToday);
  const upcoming = members.filter((m) => !m.isToday && !isRecent(m) && m.daysUntil <= 30);
  const thisWeek = members.filter((m) => !m.isToday && !isRecent(m) && m.daysUntil <= 14);
  const recent = members.filter((m) => isRecent(m));
  const recentUnwished = recent.filter((m) => !m.wished);
  const wished = members.filter((m) => m.wished);
  const nextUp = members.find((m) => !m.isToday && !isRecent(m));

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "upcoming", label: "Next 30 days", count: upcoming.length },
    { id: "recent", label: "Missed", count: recentUnwished.length },
    { id: "wished", label: "Wished", count: wished.length },
    { id: "all", label: "Everyone", count: members.length },
  ];

  const base = useMemo(() => {
    if (filter === "upcoming") return [...today, ...upcoming];
    if (filter === "recent") return recentUnwished;
    if (filter === "wished") return wished;
    return members;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, members]);

  const months = useMemo(() => {
    const counts = new Map<string, { id: string; label: string; count: number }>();
    for (const member of base) {
      const date = celebratedDate(member);
      const id = date.slice(0, 7);
      const current = counts.get(id);
      if (current) current.count += 1;
      else counts.set(id, { id, label: formatDay(date, { month: "short", year: "2-digit" }), count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [base]);

  const activeMonth = months.some((item) => item.id === month) ? month : "all";
  const needle = query.trim().toLowerCase();
  const filtered = base.filter((member) => {
    if (activeMonth !== "all" && celebratedDate(member).slice(0, 7) !== activeMonth) return false;
    return !needle || member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const emptyCopy: Record<Filter, string> = {
    upcoming: "No birthdays in the next 30 days.",
    recent: "No missed birthdays. Everyone from the last 30 days was wished.",
    wished: "No one has been wished yet.",
    all: "No members have a birthday saved.",
  };

  const actionFor = (member: BirthdayMember, compact = false) => {
    if (member.wished) {
      return (
        <div className="text-right">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E4F56C] px-2.5 py-1 text-[11px] font-semibold text-neutral-950">
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8.5l3 3 7-7" /></svg>
            Wished
          </span>
          {!compact && (
            <p className="mt-1 text-[11px] text-neutral-400">
              {formatWishedAt(member.wishedAt)} ·{" "}
              <button type="button" onClick={() => sendWish(member, true)} disabled={sendingId === member.id} className="font-semibold text-neutral-600 hover:text-neutral-950 dark:text-white/70 dark:hover:text-white">
                Resend
              </button>
            </p>
          )}
        </div>
      );
    }
    if (!member.isActive) return <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-500 dark:bg-white/10 dark:text-white/60">Inactive</span>;
    return (
      <div className="text-right">
        <button
          type="button"
          onClick={() => sendWish(member)}
          disabled={sendingId === member.id || !member.email}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            member.isToday || isRecent(member)
              ? "bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
              : "border border-neutral-200 text-neutral-700 hover:border-neutral-400 dark:border-white/10 dark:text-white"
          }`}
        >
          {sendingId === member.id ? "Sending…" : isRecent(member) ? "Send belated" : member.isToday ? "Send wish" : "Send early"}
        </button>
        {member.emailOptedOut && !compact ? <p className="mt-1 text-[11px] text-orange-600">Email off · auto-wish skips</p> : null}
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Celebrate</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Birthday wishes go out automatically every morning. Send one early or late here, and nobody gets wished twice.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/settings/cron-jobs"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-400 dark:border-white/10 dark:text-white/70"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Auto-wish daily 9:00 AM · next {nextRun()}
          </Link>
          <button
            type="button"
            onClick={runToday}
            disabled={running}
            className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950"
          >
            {running ? "Sending…" : "Run today's wishes now"}
          </button>
        </div>
      </div>

      {/* Today + coming up */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className={`relative overflow-hidden rounded-[28px] p-5 sm:p-6 ${today.length > 0 ? "bg-[#E4F56C] text-neutral-950" : card}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${today.length > 0 ? "text-neutral-950/60" : "text-neutral-400"}`}>
            Today · {new Date().toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Singapore" })}
          </p>

          {loading ? (
            <div className="mt-4 h-20 animate-pulse rounded-2xl bg-neutral-100 dark:bg-white/10" />
          ) : today.length === 0 ? (
            <div className="mt-3">
              <p className="text-xl font-semibold text-neutral-950 dark:text-white">No birthdays today</p>
              {nextUp ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-50 p-3 dark:bg-white/5">
                  <Avatar member={nextUp} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-400">Next up</p>
                    <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{nextUp.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">{formatDay(nextUp.nextBirthday, { weekday: "short", day: "numeric", month: "short" })}</p>
                    <p className="text-xs text-neutral-400">{whenLabel(nextUp)} · turns {nextUp.turning}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {today.map((member) => (
                <li key={member.id} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3">
                  <Avatar member={member} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">{member.name}</p>
                    <p className="text-sm text-neutral-950/60">Turns {member.turning} today</p>
                  </div>
                  {actionFor(member, true)}
                </li>
              ))}
            </ul>
          )}

          {recentUnwished.length > 0 && (
            <button
              type="button"
              onClick={() => { setFilter("recent"); setPage(0); setMonth("all"); }}
              className="mt-4 text-xs font-semibold text-orange-700 underline-offset-2 hover:underline"
            >
              {recentUnwished.length} recent birthday{recentUnwished.length === 1 ? "" : "s"} missed — send a belated wish
            </button>
          )}
        </section>

        <section className={`${card} p-5 sm:p-6`}>
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Next two weeks</p>
            <p className="text-xs text-neutral-400">{thisWeek.length} coming up</p>
          </div>
          {loading ? (
            <div className="mt-4 h-20 animate-pulse rounded-2xl bg-neutral-100 dark:bg-white/10" />
          ) : thisWeek.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-400">Nothing in the next two weeks.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {thisWeek.slice(0, 5).map((member) => (
                <li key={member.id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                  <DateTile date={member.nextBirthday} highlight={member.daysUntil <= 1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{member.name}</p>
                    <p className="text-xs text-neutral-400">Turns {member.turning} · {whenLabel(member)}</p>
                  </div>
                  {member.wished ? (
                    <span className="rounded-full bg-[#E4F56C] px-2 py-0.5 text-[11px] font-semibold text-neutral-950">Wished</span>
                  ) : (
                    <span className="text-[11px] text-neutral-400">Auto on the day</span>
                  )}
                </li>
              ))}
              {thisWeek.length > 5 && (
                <li>
                  <button type="button" onClick={() => { setFilter("upcoming"); setPage(0); }} className="px-1 pt-1 text-xs font-semibold text-neutral-600 hover:text-neutral-950 dark:text-white/70">
                    +{thisWeek.length - 5} more
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* List */}
      <section className={`${card} min-w-0 overflow-hidden`}>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setFilter(item.id); setMonth("all"); setPage(0); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === item.id ? "bg-white text-neutral-950 shadow-sm dark:bg-gray-700 dark:text-white" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 text-neutral-400">{loading ? "·" : item.count}</span>
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(0); }}
              placeholder="Search name or email"
              type="search"
              className="w-full rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm outline-none focus:border-neutral-400 dark:border-white/10 dark:bg-gray-900 dark:text-white lg:w-64"
            />
          </div>

          {months.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {[{ id: "all", label: "All months", count: base.length }, ...months].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setMonth(item.id); setPage(0); }}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    activeMonth === item.id
                      ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                      : "text-neutral-500 hover:bg-neutral-100 dark:text-white/60 dark:hover:bg-white/10"
                  }`}
                >
                  {item.label} <span className="opacity-60">{item.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-white/5 dark:border-white/5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <div className="h-12 w-12 animate-pulse rounded-2xl bg-neutral-100 dark:bg-white/10" />
                <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-100 dark:bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-neutral-100 dark:bg-white/10" />
                  <div className="h-3 w-56 animate-pulse rounded bg-neutral-100 dark:bg-white/10" />
                </div>
              </li>
            ))
          ) : rows.length === 0 ? (
            <li className="px-6 py-14 text-center text-sm text-neutral-400">{needle ? "No one matches that search." : emptyCopy[filter]}</li>
          ) : (
            rows.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-neutral-50 dark:hover:bg-white/5 sm:gap-4 sm:px-6">
                <DateTile date={celebratedDate(member)} highlight={member.isToday} />
                <div className="hidden sm:block"><Avatar member={member} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{member.name || "No name"}</p>
                  <p className="truncate text-xs text-neutral-500">{member.email}</p>
                </div>
                <div className="hidden w-28 shrink-0 md:block">
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {isRecent(member) ? `Turned ${member.age}` : `Turns ${member.turning}`}
                  </p>
                  <p className="text-[11px] text-neutral-400">Born {formatDay(member.dateOfBirth, { year: "numeric" })}</p>
                </div>
                <span
                  className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-block ${
                    member.isToday
                      ? "bg-[#E4F56C] text-neutral-950"
                      : isRecent(member)
                        ? "bg-orange-100 text-orange-800"
                        : member.daysUntil <= 7
                          ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                          : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/70"
                  }`}
                >
                  {whenLabel(member)}
                </span>
                <div className="w-36 shrink-0 text-right">{actionFor(member)}</div>
              </li>
            ))
          )}
        </ul>

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 dark:border-white/5 sm:px-6">
            <p className="text-xs text-neutral-400">
              {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 disabled:opacity-40 dark:border-white/10 dark:text-white"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                disabled={safePage >= pageCount - 1}
                className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
