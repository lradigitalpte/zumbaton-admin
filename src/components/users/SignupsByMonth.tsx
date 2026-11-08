"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface MonthRow {
  month: string; // YYYY-MM
  selfSignup: number;
  staffAdded: number;
  total: number;
}

export function monthLabel(key: string, withYear = false): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-SG", {
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "YYYY-MM" of an ISO date in Singapore time. */
export function sgtMonthKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit" });
}

/**
 * New member sign-ups per month (last 12 months, Singapore time), split into
 * self-signups and staff-added. Click a month to filter the user list to it.
 */
export default function SignupsByMonth({
  selectedMonth,
  onSelectMonth,
  refreshKey = 0,
}: {
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
  refreshKey?: number;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", "signups-by-month", refreshKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { months: MonthRow[]; totalMembers: number } }>(
        "/api/users/signups-by-month?months=12"
      );
      if (res.error || !res.data?.data) throw new Error(res.error?.message || "Failed to load");
      return res.data.data;
    },
  });

  const months = data?.months ?? [];
  const max = Math.max(1, ...months.map((m) => m.total));
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const delta = thisMonth && lastMonth ? thisMonth.total - lastMonth.total : 0;

  return (
    <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-white/60">New sign-ups by month</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {isLoading ? "…" : thisMonth?.total ?? 0}
            <span className="ml-2 text-sm font-medium text-neutral-400">
              this month
              {lastMonth && !isLoading && (
                <span className={delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : ""}>
                  {" "}
                  ({delta > 0 ? "+" : ""}
                  {delta} vs {monthLabel(lastMonth.month)})
                </span>
              )}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#C8DB3C]" /> Self-signup
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-neutral-800 dark:bg-white/70" /> Added by staff
          </span>
          {selectedMonth && (
            <button
              type="button"
              onClick={() => onSelectMonth(null)}
              className="rounded-full bg-neutral-950 px-3 py-1 font-semibold text-white dark:bg-white dark:text-neutral-950"
            >
              {monthLabel(selectedMonth, true)} ✕
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <p className="mt-4 text-sm text-red-600">Could not load sign-ups by month.</p>
      ) : (
        <div className="mt-4 flex h-36 items-end gap-1.5 sm:gap-2">
          {(isLoading ? Array.from({ length: 12 }, (_, i) => ({ month: String(i), selfSignup: 0, staffAdded: 0, total: 0 })) : months).map(
            (m) => {
              const active = selectedMonth === m.month;
              const dimmed = selectedMonth !== null && !active;
              return (
                <button
                  key={m.month}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSelectMonth(active ? null : m.month)}
                  title={
                    isLoading
                      ? ""
                      : `${monthLabel(m.month, true)}: ${m.total} new (${m.selfSignup} self-signup, ${m.staffAdded} added by staff)`
                  }
                  className={`group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-lg transition-opacity ${
                    dimmed ? "opacity-35 hover:opacity-70" : ""
                  }`}
                >
                  <span className="text-[11px] font-semibold tabular-nums text-neutral-700 dark:text-white/80">
                    {isLoading ? "" : m.total || ""}
                  </span>
                  <span className="flex w-full max-w-[34px] flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total ? 4 : 2 }}>
                    <span className="w-full bg-neutral-800 dark:bg-white/70" style={{ flexGrow: m.staffAdded }} />
                    <span className="w-full bg-[#C8DB3C]" style={{ flexGrow: m.selfSignup }} />
                    {m.total === 0 && <span className="h-full w-full bg-neutral-100 dark:bg-white/10" />}
                  </span>
                  <span
                    className={`text-[10px] font-medium ${
                      active ? "text-neutral-950 dark:text-white" : "text-neutral-400"
                    }`}
                  >
                    {isLoading ? "" : monthLabel(m.month)}
                  </span>
                </button>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
