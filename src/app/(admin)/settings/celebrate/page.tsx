"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

interface BirthdayUser {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  nextBirthday: string;
  age: number;
  isToday: boolean;
  daysUntil: number;
}

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

function calendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: match ? undefined : "Asia/Singapore",
  });
}

function monthId(value: string) {
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${year}-${month}`;
}

function monthChip(value: string) {
  return new Date(value).toLocaleDateString("en-SG", {
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Singapore",
  });
}

function whenLabel(user: BirthdayUser) {
  if (user.isToday || user.daysUntil === 0) return "Today";
  if (user.daysUntil === 1) return "Tomorrow";
  return `In ${user.daysUntil} days`;
}

function turningAge(user: BirthdayUser) {
  if (user.age <= 0) return null;
  if (user.isToday || user.daysUntil === 0) return user.age;
  return user.age + 1;
}

export default function CelebratePage() {
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "today" | "upcoming">("all");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ success: boolean; data: BirthdayUser[] }>("/api/users/birthdays");
        if (response.error) throw new Error(response.error.message || "Failed to fetch birthdays");
        setBirthdays(response.data?.data || []);
      } catch (error) {
        console.error("Error fetching birthdays:", error);
        toast.showToast("Failed to load birthdays", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
    // toast identity changes; load once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayCount = birthdays.filter((user) => user.isToday).length;
  const upcomingCount = birthdays.filter((user) => !user.isToday && user.daysUntil > 0 && user.daysUntil <= 30).length;

  const visible = useMemo(() => {
    if (filter === "today") return birthdays.filter((user) => user.isToday);
    if (filter === "upcoming") return birthdays.filter((user) => !user.isToday && user.daysUntil > 0 && user.daysUntil <= 30);
    return birthdays;
  }, [birthdays, filter]);

  const months = useMemo(() => {
    const counts = new Map<string, { id: string; label: string; count: number }>();
    for (const user of visible) {
      const id = monthId(user.nextBirthday);
      const current = counts.get(id);
      if (current) current.count += 1;
      else counts.set(id, { id, label: monthChip(user.nextBirthday), count: 1 });
    }
    return Array.from(counts.values());
  }, [visible]);

  const activeMonth = months.some((item) => item.id === month) ? month : "all";
  const needle = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return visible.filter((user) => {
      if (activeMonth !== "all" && monthId(user.nextBirthday) !== activeMonth) return false;
      if (!needle) return true;
      return user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle);
    });
  }, [visible, activeMonth, needle]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeStart = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min(filtered.length, safePage * pageSize + pageSize);

  const handleSendBirthdayEmail = async (userId: string, userName: string) => {
    try {
      setSendingEmail(userId);
      const response = await api.post<{
        success: boolean;
        message?: string;
        error?: { message: string };
      }>("/api/users/birthdays/send", { userId });

      if (response.error) throw new Error(response.error.message || "Failed to send email");
      if (!response.data?.success) throw new Error(response.data?.error?.message || "Failed to send email");

      toast.showToast(`Birthday message sent to ${userName}`, "success");
    } catch (error) {
      console.error("Error sending birthday email:", error);
      toast.showToast("Failed to send email", "error");
    } finally {
      setSendingEmail(null);
    }
  };

  const stats = [
    { id: "today" as const, value: todayCount, label: "Today", caption: todayCount === 0 ? "No one today" : "Send a wish now" },
    { id: "upcoming" as const, value: upcomingCount, label: "Next 30 days", caption: "After today" },
    { id: "all" as const, value: birthdays.length, label: "On file", caption: "Members with a birthday" },
  ];

  const emptyCopy =
    filter === "today"
      ? "No birthdays today."
      : filter === "upcoming"
        ? "No birthdays in the next 30 days."
        : "No members have a birthday saved.";

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Celebrate</h1>
        <p className="mt-1 max-w-xl text-sm text-neutral-500">
          Birthday wishes for members with a date of birth. Search, pick a month, or use the cards. Twenty people show at a time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => {
          const selected = filter === stat.id;
          return (
            <button
              key={stat.id}
              type="button"
              onClick={() => {
                setFilter(stat.id);
                setMonth("all");
                setPage(0);
              }}
              className={`min-h-[148px] rounded-[28px] border p-5 text-left shadow-[0_10px_30px_rgba(16,24,40,0.05)] ${
                selected
                  ? "border-[#d5e45c] bg-[#E4F56C] text-neutral-950"
                  : "border-neutral-200/80 bg-white text-neutral-950 dark:border-white/10 dark:bg-gray-800 dark:text-white"
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${selected ? "text-neutral-950/70" : "text-neutral-400"}`}>{stat.label}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{loading ? "—" : stat.value}</p>
              <p className={`mt-2 text-sm ${selected ? "text-neutral-950/70" : "text-neutral-500"}`}>{stat.caption}</p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className={`${card} h-72 animate-pulse`} />
      ) : (
        <section className={`${card} p-5 sm:p-6`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search name or email"
              className="h-11 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 lg:max-w-sm dark:border-white/10 dark:bg-gray-800 dark:text-white"
            />
            <p className="text-xs text-neutral-400">
              {filtered.length === 0 ? "No matches" : `${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </p>
          </div>

          {months.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setMonth("all");
                  setPage(0);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  activeMonth === "all" ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"
                }`}
              >
                All months
              </button>
              {months.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMonth(item.id);
                    setPage(0);
                  }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    activeMonth === item.id ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"
                  }`}
                >
                  {item.label} · {item.count}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="px-1 py-10 text-sm text-neutral-500">{needle ? "No one matches that search." : emptyCopy}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <th className="px-2 py-2 font-semibold">Member</th>
                    <th className="px-2 py-2 font-semibold">When</th>
                    <th className="px-2 py-2 font-semibold">Born</th>
                    <th className="px-2 py-2 font-semibold">Next</th>
                    <th className="px-2 py-2 text-right font-semibold">Wish</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => {
                    const soon = user.isToday || user.daysUntil <= 30;
                    const age = turningAge(user);
                    return (
                      <tr key={user.id} className="border-t border-neutral-200 dark:border-white/10">
                        <td className="px-2 py-3">
                          <p className="font-medium text-neutral-950 dark:text-white">{user.name}</p>
                          <p className="truncate text-xs text-neutral-400">{user.email}</p>
                        </td>
                        <td className="px-2 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${soon ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"}`}>
                            {whenLabel(user)}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-neutral-600 dark:text-white/80">
                          <p>{calendarDate(user.dateOfBirth)}</p>
                          {age ? <p className="text-xs text-neutral-400">Turns {age}</p> : null}
                        </td>
                        <td className="px-2 py-3 text-neutral-600 dark:text-white/80">{calendarDate(user.nextBirthday)}</td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSendBirthdayEmail(user.id, user.name)}
                            disabled={sendingEmail === user.id}
                            className="rounded-full bg-[#E4F56C] px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
                          >
                            {sendingEmail === user.id ? "Sending…" : "Send"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-40 dark:border-white/10 dark:text-white"
              >
                Previous
              </button>
              <p className="text-xs text-neutral-400">
                Page {safePage + 1} of {pageCount}
              </p>
              <button
                type="button"
                onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                disabled={safePage >= pageCount - 1}
                className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
