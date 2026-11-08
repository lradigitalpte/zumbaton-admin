"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface Sale1111Person {
  key: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  newMember: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
  sawPopup: boolean;
  closedPopup: boolean;
  visitedSalePage: boolean;
  clicks: string[];
  reachedBuyTokens: boolean;
  bought: boolean;
  boughtAt: string | null;
  paidCents: number;
}

interface Sale1111Stats {
  counts: Record<string, number>;
  funnel: {
    people: number;
    sawPopup: number;
    clicked: number;
    identified: number;
    newMembers: number;
    reachedBuyTokens: number;
    bought: number;
  };
  people: Sale1111Person[];
  peopleTruncated: boolean;
  purchases: number;
  revenueCents: number;
  packageFound: boolean;
  eventsAvailable: boolean;
}

type Filter = "all" | "members" | "clicked" | "bought" | "followup";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "members", label: "Known members" },
  { id: "clicked", label: "Clicked" },
  { id: "bought", label: "Bought" },
  { id: "followup", label: "Didn't buy (follow up)" },
];

const RAW_ROWS: { key: string; label: string }[] = [
  { key: "popup_view", label: "Popup shown" },
  { key: "popup_dismiss", label: "Popup closed" },
  { key: "popup_signup_click", label: "Popup → Sign up" },
  { key: "popup_signin_click", label: "Popup → Sign in" },
  { key: "popup_buy_click", label: "Popup → Buy now" },
  { key: "strip_click", label: "Header strip clicks" },
  { key: "page_view", label: "/1111 page views" },
  { key: "page_cta_click", label: "/1111 / pricing card clicks" },
  { key: "packages_view", label: "Reached Buy tokens" },
  { key: "packages_card_click", label: "Buy tokens card clicks" },
];

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-SG", { maximumFractionDigits: 2 })}`;
}

function matches(p: Sale1111Person, f: Filter): boolean {
  switch (f) {
    case "members":
      return !!p.userId;
    case "clicked":
      return p.clicks.length > 0;
    case "bought":
      return p.bought;
    case "followup":
      // Known member who showed interest but hasn't bought — the people worth a WhatsApp.
      return !!p.userId && !p.bought && (p.clicks.length > 0 || p.reachedBuyTokens || p.sawPopup);
    default:
      return true;
  }
}

function downloadCsv(rows: Sale1111Person[]) {
  const header = [
    "Name", "Email", "Phone", "New member", "First seen (SGT)", "Last seen (SGT)",
    "Saw popup", "Closed popup", "Visited /1111", "Clicked", "Reached Buy tokens", "Bought", "Bought at (SGT)", "Paid",
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((p) =>
    [
      p.name ?? (p.userId ? "" : "Anonymous visitor"),
      p.email ?? "",
      p.phone ?? "",
      p.newMember ? "Yes" : "No",
      fmt(p.firstSeen),
      fmt(p.lastSeen),
      p.sawPopup ? "Yes" : "No",
      p.closedPopup ? "Yes" : "No",
      p.visitedSalePage ? "Yes" : "No",
      p.clicks.join("; "),
      p.reachedBuyTokens ? "Yes" : "No",
      p.bought ? "Yes" : "No",
      p.bought ? fmt(p.boughtAt) : "",
      p.bought ? money(p.paidCents) : "",
    ].map((v) => esc(String(v))).join(",")
  );
  const blob = new Blob([[header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "1111-sale-people.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const yes = <span className="font-semibold text-emerald-600">✓</span>;
const no = <span className="text-neutral-300 dark:text-white/20">—</span>;

export default function Sale1111Section({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: stats, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["promos", "sale-1111", "stats"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Sale1111Stats }>("/api/promos/sale-1111/stats");
      if (res.error || !res.data?.data) throw new Error(res.error?.message || "Failed to load stats");
      return res.data.data;
    },
  });

  const rows = useMemo(() => (stats?.people ?? []).filter((p) => matches(p, filter)), [stats, filter]);

  const funnelSteps = stats
    ? [
        { label: "Saw popup", value: stats.funnel.sawPopup },
        { label: "Clicked", value: stats.funnel.clicked },
        { label: "Signed in / up", value: stats.funnel.identified, sub: `${stats.funnel.newMembers} new` },
        { label: "Reached Buy tokens", value: stats.funnel.reachedBuyTokens },
        { label: "Bought", value: stats.funnel.bought, sub: money(stats.revenueCents), dark: true },
      ]
    : [];

  return (
    <div className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
      {/* Header + on/off */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h4 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">11:11 Sale — 6 sessions for $111</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Runs 11 Nov, 12:00am–11:59pm Singapore time. Turning this off hides the header strip, popup and
            Buy tokens card, and blocks checkout immediately. Press <strong>Save</strong> to apply.
          </p>
        </div>
        <button
          type="button"
          aria-label={enabled ? "Turn 11:11 Sale off" : "Turn 11:11 Sale on"}
          onClick={onToggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-[#E4F56C]" : "bg-neutral-200 dark:bg-white/15"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-neutral-950 transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Funnel (unique people) */}
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Funnel · unique people</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700 disabled:opacity-50 dark:bg-white/10 dark:text-white"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-200 dark:bg-white/10" />)
          : funnelSteps.map((s) => (
              <div
                key={s.label}
                className={`rounded-2xl p-3 ${
                  s.dark ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white dark:border-white/10 dark:bg-gray-800"
                }`}
              >
                <p className={`text-[11px] font-medium ${s.dark ? "text-[#E4F56C]" : "text-neutral-500"}`}>{s.label}</p>
                <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.dark ? "" : "text-neutral-950 dark:text-white"}`}>{s.value}</p>
                {s.sub && <p className={`text-[11px] ${s.dark ? "text-white/60" : "text-neutral-400"}`}>{s.sub}</p>}
              </div>
            ))}
      </div>

      {/* People */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filter === f.id
                  ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                  : "bg-white text-neutral-600 ring-1 ring-neutral-200 dark:bg-white/10 dark:text-white dark:ring-white/10"
              }`}
            >
              {f.label}
              {stats && <span className="ml-1 opacity-60">{(stats.people ?? []).filter((p) => matches(p, f.id)).length}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(rows)}
          disabled={rows.length === 0}
          className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
        >
          Download CSV
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-gray-800">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500 dark:border-white/10">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Person</th>
              <th className="px-3 py-2.5 font-semibold">Popup</th>
              <th className="px-3 py-2.5 font-semibold">Clicked</th>
              <th className="px-3 py-2.5 text-center font-semibold">Buy tokens</th>
              <th className="px-3 py-2.5 font-semibold">Bought</th>
              <th className="px-3 py-2.5 font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
            {isLoading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">No one here yet.</td></tr>
            ) : (
              rows.map((p) => (
                <tr key={p.key} className={p.bought ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""}>
                  <td className="px-3 py-2.5">
                    {p.userId ? (
                      <>
                        <p className="font-semibold text-neutral-950 dark:text-white">
                          {p.name || "Member"}
                          {p.newMember && (
                            <span className="ml-1.5 rounded-full bg-[#E4F56C] px-1.5 py-0.5 text-[10px] font-bold text-neutral-950">NEW</span>
                          )}
                        </p>
                        <p className="text-xs text-neutral-500">{[p.email, p.phone].filter(Boolean).join(" · ")}</p>
                      </>
                    ) : (
                      <p className="text-neutral-400">Anonymous visitor</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {p.sawPopup ? (p.closedPopup ? "Seen, closed" : "Seen") : no}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-700 dark:text-white/80">
                    {p.clicks.length ? p.clicks.join(", ") : no}
                  </td>
                  <td className="px-3 py-2.5 text-center">{p.reachedBuyTokens ? yes : no}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {p.bought ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {money(p.paidCents)} · {fmt(p.boughtAt)}
                      </span>
                    ) : (
                      no
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-500">{fmt(p.lastSeen ?? p.boughtAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {stats?.peopleTruncated && (
        <p className="mt-2 text-xs text-neutral-400">Showing the first 1,000 people (buyers and members first).</p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-neutral-500">Raw event totals</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {RAW_ROWS.map((row) => (
            <div key={row.key} className="rounded-xl border border-neutral-200 bg-white p-2.5 dark:border-white/10 dark:bg-gray-800">
              <p className="text-[11px] text-neutral-500">{row.label}</p>
              <p className="text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{stats?.counts?.[row.key] ?? 0}</p>
            </div>
          ))}
        </div>
      </details>

      {isError && <p className="mt-3 text-xs text-red-600">Could not load 11:11 Sale stats.</p>}
      {stats && !stats.packageFound && (
        <p className="mt-3 text-xs text-amber-600">
          The &quot;11:11 Sale - 6 Sessions&quot; package does not exist yet — run the 20261108_add_sale_1111_package migration.
        </p>
      )}
      {stats && !stats.eventsAvailable && (
        <p className="mt-3 text-xs text-amber-600">
          Tracking table missing or out of date — run (or re-run) the 20261108_create_promo_events migration.
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        Anonymous visitors become named once they sign in or sign up on the same browser. Times are Singapore time.
        Events are also sent to Google Tag Manager as sale1111_*.
      </p>
    </div>
  );
}
