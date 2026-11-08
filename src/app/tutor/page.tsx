"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTutorDashboard } from "@/hooks/useTutor";
import { useAuth } from "@/context/AuthContext";

interface TodayClass {
  id: string;
  name: string;
  time: string;
  duration: number;
  room: string;
  enrolled: number;
  capacity: number;
  checkedIn: number;
  status: "upcoming" | "in_progress" | "completed";
  date: string;
  type: string;
}

const card =
  "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";

const STATUS_LABEL: Record<TodayClass["status"], string> = {
  in_progress: "In progress",
  completed: "Completed",
  upcoming: "Upcoming",
};

export default function TutorDashboardPage() {
  const { user } = useAuth();
  const { data: dashboardData, isLoading, error } = useTutorDashboard();

  // Format API data to component format
  const tutorInfo = useMemo(() => ({
    name: dashboardData?.profile?.name || user?.name || user?.email?.split("@")[0] || "Instructor",
    specialties: dashboardData?.specialties || [],
    totalClasses: dashboardData?.stats?.totalClassesTaught || 0,
  }), [dashboardData, user]);

  // Transform API today classes to component format
  const todaysClasses: TodayClass[] = useMemo(() => {
    if (!dashboardData?.todayClasses) return [];

    const now = new Date();
    return dashboardData.todayClasses.map(cls => {
      const classTime = new Date(cls.scheduled_at);
      const classEnd = new Date(classTime.getTime() + cls.duration_minutes * 60000);

      let status: TodayClass["status"] = "upcoming";
      if (now >= classEnd) {
        status = "completed";
      } else if (now >= classTime && now < classEnd) {
        status = "in_progress";
      }

      return {
        id: cls.id,
        name: cls.title,
        time: classTime.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" }),
        duration: cls.duration_minutes,
        room: cls.room_name || cls.location || "TBD", // Use room_name first, then location, then TBD
        enrolled: cls.bookedCount,
        capacity: cls.capacity,
        checkedIn: cls.checkedInCount,
        status,
        date: classTime.toISOString().split("T")[0],
        type: cls.class_type || "",
      };
    });
  }, [dashboardData]);

  // Week schedule grouped by day (Singapore time)
  const upcomingSchedule = useMemo(() => {
    if (!dashboardData?.weekSchedule) return [];

    const grouped: Record<string, { time: string; title: string }[]> = {};
    dashboardData.weekSchedule.forEach(cls => {
      const date = new Date(cls.scheduled_at);
      const day = date.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Singapore" });
      const time = date.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({ time, title: cls.title });
    });

    return Object.entries(grouped).map(([day, classes]) => ({ day, classes }));
  }, [dashboardData]);

  const weeklyStats = useMemo(() => ({
    classesThisWeek: dashboardData?.stats?.thisWeekClasses || 0,
    studentsTotal: dashboardData?.stats?.totalStudents || 0,
    avgAttendance: dashboardData?.stats?.attendanceRate || 0,
    upcomingClasses: dashboardData?.stats?.upcomingClasses || 0,
  }), [dashboardData]);

  // "121h 53m" -> "5d 1h 53m"
  const nextClassCountdown = useMemo(() => {
    if (!dashboardData?.nextClassIn) return null;
    const { hours, mins } = dashboardData.nextClassIn;
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h ${mins}m`;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }, [dashboardData]);

  const greeting = useMemo(() => {
    const hour = Number(new Date().toLocaleString("en-SG", { hour: "numeric", hour12: false, timeZone: "Asia/Singapore" }));
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const todayLabel = new Date().toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Singapore",
  });

  const getStatusColor = (status: TodayClass["status"]) => {
    switch (status) {
      case "completed": return "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/60";
      case "in_progress": return "bg-[#E4F56C] text-neutral-950";
      case "upcoming": return "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950";
    }
  };

  const inProgressCount = todaysClasses.filter((c) => c.status === "in_progress").length;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-20 w-72 animate-pulse rounded-2xl bg-neutral-100 dark:bg-white/10" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${card} h-32 animate-pulse`} />
          ))}
        </div>
        <div className={`${card} h-64 animate-pulse`} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${card} px-6 py-14 text-center`}>
        <p className="text-base font-semibold text-neutral-950 dark:text-white">Couldn&apos;t load your dashboard</p>
        <p className="mt-1 text-sm text-neutral-500">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{todayLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
            {greeting}, {tutorInfo.name.split(" ")[0]}{" "}
            <span className="inline-flex h-7 w-9 -translate-y-px items-center justify-center rounded-full bg-[#E4F56C] align-middle text-base">
              👋
            </span>
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
            {todaysClasses.length > 0
              ? `You have ${todaysClasses.length} class${todaysClasses.length !== 1 ? "es" : ""} today.`
              : "No classes today. Here's what's coming up."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {nextClassCountdown && (
            <span className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 dark:border-white/10 dark:text-white/70">
              Next class in <span className="text-neutral-950 dark:text-white">{nextClassCountdown}</span>
            </span>
          )}
          <Link
            href="/tutor/schedule"
            className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
          >
            My schedule
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className={`${card} p-5`}>
          <p className="text-sm font-medium text-neutral-500 dark:text-white/60">Classes this week</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">{weeklyStats.classesThisWeek}</p>
        </div>
        <div className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-5 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <p className="text-sm font-medium">Students</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{weeklyStats.studentsTotal}</p>
        </div>
        <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-5 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]">
          <p className="text-sm font-medium text-white/60">Avg attendance</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{weeklyStats.avgAttendance}%</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#E4F56C]" style={{ width: `${Math.min(100, Math.max(0, weeklyStats.avgAttendance))}%` }} />
          </div>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-sm font-medium text-neutral-500 dark:text-white/60">Upcoming</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">{weeklyStats.upcomingClasses}</p>
          <p className="mt-1 text-xs text-neutral-400">classes scheduled</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Today's classes */}
        <section className={`${card} min-w-0 overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">Today&apos;s classes</h2>
              <p className="text-xs text-neutral-500">{todayLabel}</p>
            </div>
            {inProgressCount > 0 && (
              <span className="flex items-center gap-2 rounded-full bg-[#E4F56C] px-3 py-1 text-xs font-semibold text-neutral-950">
                <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-950" />
                {inProgressCount} in progress
              </span>
            )}
          </div>

          {todaysClasses.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/10">
                <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-950 dark:text-white">No classes scheduled for today</p>
              <Link
                href="/tutor/schedule"
                className="mt-4 inline-flex rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:text-white"
              >
                View your schedule →
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-white/5 dark:border-white/5">
                {todaysClasses.map((classItem) => {
                  const pct = classItem.enrolled > 0 ? Math.round((classItem.checkedIn / classItem.enrolled) * 100) : 0;
                  return (
                    <li key={classItem.id} className="px-5 py-4 transition hover:bg-neutral-50 dark:hover:bg-white/5 sm:px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-20 shrink-0">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{classItem.time}</p>
                          <p className="text-[11px] text-neutral-400">{classItem.duration} min</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{classItem.name}</p>
                          {classItem.room && classItem.room !== "TBD" && classItem.room !== "TBA" && (
                            <p className="truncate text-xs text-neutral-500">{classItem.room}</p>
                          )}
                        </div>
                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {classItem.checkedIn}
                            <span className="text-neutral-400">/{classItem.enrolled}</span>
                          </p>
                          <p className="text-[11px] text-neutral-400">checked in</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getStatusColor(classItem.status)}`}>
                          {STATUS_LABEL[classItem.status]}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${classItem.status === "completed" ? "bg-neutral-400" : "bg-neutral-950 dark:bg-[#E4F56C]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-neutral-100 px-5 py-3 dark:border-white/5 sm:px-6">
                <Link href="/tutor/classes" className="text-xs font-semibold text-neutral-700 hover:text-neutral-950 dark:text-white/70 dark:hover:text-white">
                  View all classes →
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-6">
          {/* This week */}
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-baseline justify-between px-5 pt-5 sm:px-6 sm:pt-6">
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">This week</h2>
              <span className="text-xs text-neutral-400">
                {weeklyStats.classesThisWeek} class{weeklyStats.classesThisWeek === 1 ? "" : "es"}
              </span>
            </div>
            {upcomingSchedule.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-neutral-400">No classes scheduled this week</p>
            ) : (
              <div className="mt-4 max-h-[340px] space-y-4 overflow-y-auto px-5 pb-5 sm:px-6">
                {upcomingSchedule.map((day) => (
                  <div key={day.day}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{day.day}</p>
                    <ul className="mt-2 space-y-2">
                      {day.classes.map((cls, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 dark:border-white/5 dark:bg-white/5"
                        >
                          <span className="shrink-0 rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-semibold text-[#E4F56C]">
                            {cls.time}
                          </span>
                          <span className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-800 dark:text-white/80">
                            {cls.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-neutral-100 px-5 py-3 dark:border-white/5 sm:px-6">
              <Link href="/tutor/schedule" className="text-xs font-semibold text-neutral-700 hover:text-neutral-950 dark:text-white/70 dark:hover:text-white">
                View full schedule →
              </Link>
            </div>
          </section>

          {/* Specialties & totals */}
          <section className={`${card} p-5 sm:p-6`}>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">Your specialties</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {tutorInfo.specialties.length === 0 ? (
                <p className="text-sm text-neutral-400">No specialties added yet</p>
              ) : (
                tutorInfo.specialties.map((specialty) => (
                  <span key={specialty} className="rounded-full bg-[#E4F56C] px-3 py-1 text-xs font-semibold capitalize text-neutral-950">
                    {specialty}
                  </span>
                ))
              )}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-neutral-950 px-4 py-3 text-white dark:bg-white/10">
              <span className="text-sm text-white/60">Total classes taught</span>
              <span className="text-2xl font-semibold tracking-tight">{tutorInfo.totalClasses}</span>
            </div>
          </section>
        </aside>
      </div>

    </div>
  );
}
