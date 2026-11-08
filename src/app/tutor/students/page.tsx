"use client";

import { useState, useMemo } from "react";
import { useTutorStudents, type TutorStudent } from "@/hooks/useTutor";

type Student = TutorStudent;
type Filter = "all" | "booked" | "regulars" | "lapsed";
type Sort = "name" | "attendance" | "classes" | "recent";

const card =
  "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

const DAY_MS = 86_400_000;
const LAPSED_DAYS = 30;
const REGULAR_MIN = 3;

const AVATAR_COLORS = [
  "bg-[#E4F56C] text-neutral-950",
  "bg-neutral-950 text-[#E4F56C] dark:bg-white dark:text-neutral-950",
  "bg-sky-100 text-sky-800",
  "bg-orange-100 text-orange-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
];

function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" });
}

function daysAgo(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

function relative(iso: string | null | undefined) {
  const d = daysAgo(iso);
  if (d === null) return null;
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return shortDate(iso);
}

function isLapsed(s: Student) {
  const d = daysAgo(s.stats.lastAttendedAt);
  return s.stats.classesAttended > 0 && !(s.stats.upcoming ?? 0) && d !== null && d >= LAPSED_DAYS;
}

function whatsappLink(phone: string | null) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 8) digits = `65${digits}`; // Singapore local number
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

function Avatar({ s, size = "h-10 w-10 text-xs" }: { s: Student; size?: string }) {
  return s.avatar_url ? (
    <img src={s.avatar_url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full font-bold ${avatarColor(s.id)}`}>{initials(s.name)}</div>
  );
}

function RateBar({ s }: { s: Student }) {
  const finished = s.stats.classesAttended + s.stats.noShows;
  if (finished === 0) return <span className="text-xs text-neutral-400">No classes yet</span>;
  return (
    <div className="w-28">
      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{s.attendanceRate}%</p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${s.attendanceRate >= 75 ? "bg-neutral-950 dark:bg-[#E4F56C]" : "bg-neutral-400"}`}
          style={{ width: `${s.attendanceRate}%` }}
        />
      </div>
    </div>
  );
}

export default function TutorStudentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<Sort>("recent");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Load everyone once; search/filter/sort happen instantly on the client.
  const { data, isLoading, error } = useTutorStudents({ limit: 500 });
  const students = useMemo(() => data?.students || [], [data]);

  const counts = useMemo(
    () => ({
      all: students.length,
      booked: students.filter((s) => (s.stats.upcoming ?? 0) > 0).length,
      regulars: students.filter((s) => s.stats.classesAttended >= REGULAR_MIN).length,
      lapsed: students.filter(isLapsed).length,
    }),
    [students]
  );

  const avgAttendance = useMemo(() => {
    const withHistory = students.filter((s) => s.stats.classesAttended + s.stats.noShows > 0);
    return withHistory.length
      ? Math.round(withHistory.reduce((sum, s) => sum + s.attendanceRate, 0) / withHistory.length)
      : 0;
  }, [students]);

  const visible = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return students
      .filter((s) => {
        if (filter === "booked") return (s.stats.upcoming ?? 0) > 0;
        if (filter === "regulars") return s.stats.classesAttended >= REGULAR_MIN;
        if (filter === "lapsed") return isLapsed(s);
        return true;
      })
      .filter((s) => !term || s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term))
      .sort((a, b) => {
        if (sortBy === "attendance") return b.attendanceRate - a.attendanceRate || a.name.localeCompare(b.name);
        if (sortBy === "classes") return b.stats.classesAttended - a.stats.classesAttended || a.name.localeCompare(b.name);
        if (sortBy === "recent") {
          const at = a.stats.nextBookedAt || a.stats.lastAttendedAt || "";
          const bt = b.stats.nextBookedAt || b.stats.lastAttendedAt || "";
          // Booked next first (soonest), then most recently seen.
          if (!!a.stats.nextBookedAt !== !!b.stats.nextBookedAt) return a.stats.nextBookedAt ? -1 : 1;
          return a.stats.nextBookedAt ? at.localeCompare(bt) : bt.localeCompare(at);
        }
        return a.name.localeCompare(b.name);
      });
  }, [students, filter, searchQuery, sortBy]);

  const header = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">My students</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">Everyone who has booked your classes.</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-5">
        {header}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${card} h-28 animate-pulse`} />)}
        </div>
        <div className={`${card} h-80 animate-pulse`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-w-0 space-y-5">
        {header}
        <div className={`${card} px-6 py-14 text-center`}>
          <p className="text-base font-semibold text-neutral-950 dark:text-white">Couldn&apos;t load your students</p>
          <p className="mt-1 text-sm text-neutral-500">{error.message}</p>
        </div>
      </div>
    );
  }

  const NextBooked = ({ s }: { s: Student }) =>
    s.stats.nextBookedAt ? (
      <div className="min-w-0">
        <span className="inline-block rounded-full bg-[#E4F56C] px-2 py-0.5 text-[11px] font-semibold text-neutral-950">
          {shortDate(s.stats.nextBookedAt)}
        </span>
        {(s.stats.upcoming ?? 0) > 1 && <span className="ml-1 text-[11px] text-neutral-400">+{(s.stats.upcoming ?? 0) - 1} more</span>}
      </div>
    ) : (
      <span className="text-sm text-neutral-300 dark:text-white/20">—</span>
    );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {header}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className={`${card} p-4 sm:p-5`}>
          <p className="text-xs font-medium text-neutral-500 dark:text-white/60 sm:text-sm">Students</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:mt-3 sm:text-4xl">{counts.all}</p>
        </div>
        <div className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-4 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)] sm:p-5">
          <p className="text-xs font-medium sm:text-sm">Booked in next</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:mt-3 sm:text-4xl">{counts.booked}</p>
        </div>
        <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-4 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)] sm:p-5">
          <p className="text-xs font-medium text-white/60 sm:text-sm">Avg attendance</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:mt-3 sm:text-4xl">{avgAttendance}%</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#E4F56C]" style={{ width: `${avgAttendance}%` }} />
          </div>
        </div>
        <div className={`${card} p-4 sm:p-5`}>
          <p className="text-xs font-medium text-neutral-500 dark:text-white/60 sm:text-sm">Regulars</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:mt-3 sm:text-4xl">{counts.regulars}</p>
          <p className="mt-1 text-[11px] text-neutral-400">came {REGULAR_MIN}+ times</p>
        </div>
      </div>

      {/* Students table */}
      <section className={`${card} min-w-0 overflow-hidden`}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="inline-flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5">
              {([
                ["all", "All"],
                ["booked", "Booked"],
                ["regulars", "Regulars"],
                ["lapsed", "Lapsed"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  title={id === "lapsed" ? `Came before, nothing booked, not seen in ${LAPSED_DAYS}+ days` : undefined}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    filter === id
                      ? "bg-white text-neutral-950 shadow-sm dark:bg-gray-700 dark:text-white"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-neutral-400">{counts[id]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              placeholder="Search name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm outline-none focus:border-neutral-400 dark:border-white/10 dark:bg-gray-900 dark:text-white sm:w-60"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as Sort)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 outline-none dark:border-white/10 dark:bg-gray-900 dark:text-white"
            >
              <option value="recent">Sort: Coming up</option>
              <option value="name">Sort: Name</option>
              <option value="attendance">Sort: Attendance</option>
              <option value="classes">Sort: Most classes</option>
            </select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-neutral-100 px-6 py-14 text-center dark:border-white/5">
            <p className="text-base font-semibold text-neutral-950 dark:text-white">
              {students.length === 0 ? "No students yet" : "No one matches"}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {students.length === 0
                ? "Students appear here once they book one of your classes."
                : searchQuery
                  ? "Try a different name or email."
                  : filter === "lapsed"
                    ? "Nobody has drifted away. Nice."
                    : "No students in this group yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left">
                <thead className="border-y border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-400 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 pl-6 pr-4 font-semibold">Student</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Came</th>
                    <th className="px-4 py-2.5 text-right font-semibold">No-shows</th>
                    <th className="px-4 py-2.5 font-semibold">Attendance</th>
                    <th className="px-4 py-2.5 font-semibold">Last came</th>
                    <th className="py-2.5 pl-4 pr-6 font-semibold">Next booked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                  {visible.map((s) => (
                    <tr key={s.id} onClick={() => setSelectedStudent(s)} className="cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-white/5">
                      <td className="py-3 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar s={s} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-neutral-950 dark:text-white">
                              {s.name}
                              {isLapsed(s) && (
                                <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">Lapsed</span>
                              )}
                            </p>
                            <p className="truncate text-xs text-neutral-500">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-neutral-950 dark:text-white">{s.stats.classesAttended}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold ${s.stats.noShows > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-300 dark:text-white/20"}`}>
                        {s.stats.noShows}
                      </td>
                      <td className="px-4 py-3"><RateBar s={s} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700 dark:text-white/80">
                        {relative(s.stats.lastAttendedAt) ?? <span className="text-neutral-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-4 pr-6"><NextBooked s={s} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone rows */}
            <ul className="divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-white/5 dark:border-white/5 md:hidden">
              {visible.map((s) => (
                <li key={s.id} onClick={() => setSelectedStudent(s)} className="flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-neutral-50 dark:active:bg-white/5">
                  <Avatar s={s} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{s.name}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      Came {s.stats.classesAttended}
                      {s.stats.noShows > 0 && <span className="text-red-600 dark:text-red-400"> · {s.stats.noShows} no-show</span>}
                      {s.stats.classesAttended + s.stats.noShows > 0 && ` · ${s.attendanceRate}%`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {s.stats.nextBookedAt ? (
                      <span className="rounded-full bg-[#E4F56C] px-2 py-0.5 text-[10px] font-semibold text-neutral-950">
                        Next {shortDate(s.stats.nextBookedAt)}
                      </span>
                    ) : isLapsed(s) ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">Lapsed</span>
                    ) : s.stats.lastAttendedAt ? (
                      <span className="text-[11px] text-neutral-400">{relative(s.stats.lastAttendedAt)}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Student detail — bottom sheet on mobile */}
      {selectedStudent && (() => {
        const s = selectedStudent;
        const wa = whatsappLink(s.phone);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedStudent(null)} />
            <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-xl dark:bg-gray-800 sm:max-w-md sm:rounded-[28px] sm:p-6">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200 dark:bg-white/20 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar s={s} size="h-14 w-14 text-base" />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-white">{s.name}</h2>
                    <p className="text-xs text-neutral-500">
                      Member since {new Date(s.created_at).toLocaleDateString("en-SG", { month: "short", year: "numeric", timeZone: "Asia/Singapore" })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  aria-label="Close"
                  className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-neutral-50 p-3 text-center dark:bg-white/5">
                  <p className="text-2xl font-semibold text-neutral-950 dark:text-white">{s.stats.classesAttended}</p>
                  <p className="text-[11px] text-neutral-500">Came</p>
                </div>
                <div className="rounded-2xl bg-neutral-950 p-3 text-center text-white dark:bg-white/10">
                  <p className="text-2xl font-semibold">{s.attendanceRate}%</p>
                  <p className="text-[11px] text-white/60">Attendance</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3 text-center dark:bg-white/5">
                  <p className={`text-2xl font-semibold ${s.stats.noShows > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-950 dark:text-white"}`}>
                    {s.stats.noShows}
                  </p>
                  <p className="text-[11px] text-neutral-500">No-shows</p>
                </div>
              </div>

              <div className="mt-3 space-y-2 rounded-2xl border border-neutral-100 p-4 text-sm dark:border-white/10">
                <div className="flex justify-between gap-3">
                  <span className="text-neutral-500">Last came</span>
                  <span className="font-semibold text-neutral-950 dark:text-white">{relative(s.stats.lastAttendedAt) ?? "Not yet"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-neutral-500">Next booked</span>
                  <span className="truncate text-right font-semibold text-neutral-950 dark:text-white">
                    {s.stats.nextBookedAt ? `${shortDate(s.stats.nextBookedAt)}${s.stats.nextClassTitle ? ` · ${s.stats.nextClassTitle}` : ""}` : "Nothing booked"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-neutral-500">Upcoming bookings</span>
                  <span className="font-semibold text-neutral-950 dark:text-white">{s.stats.upcoming ?? 0}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-full bg-[#E4F56C] px-4 py-2.5 text-center text-sm font-semibold text-neutral-950 hover:brightness-95"
                  >
                    WhatsApp
                  </a>
                )}
                {s.phone && (
                  <a
                    href={`tel:${s.phone.replace(/\s/g, "")}`}
                    className="flex-1 rounded-full border border-neutral-200 px-4 py-2.5 text-center text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:text-white"
                  >
                    Call
                  </a>
                )}
                <a
                  href={`mailto:${s.email}`}
                  className="flex-1 rounded-full border border-neutral-200 px-4 py-2.5 text-center text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:text-white"
                >
                  Email
                </a>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
