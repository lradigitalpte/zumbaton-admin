"use client";

import { useState, useMemo } from "react";
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
}

interface Student {
  id: string;
  name: string;
  avatar: string;
  status: "confirmed" | "waitlist" | "checked_in" | "no_show";
  tokensUsed: number;
  attendanceRate: number;
}

export default function TutorDashboardPage() {
  const { user } = useAuth();
  const { data: dashboardData, isLoading, error } = useTutorDashboard();
  const [selectedClass, setSelectedClass] = useState<TodayClass | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Format API data to component format
  const tutorInfo = useMemo(() => ({
    name: dashboardData?.profile?.name || user?.name || user?.email?.split("@")[0] || "Instructor",
    initials: (dashboardData?.profile?.name || user?.name || "I")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase(),
    role: "Instructor",
    specialties: dashboardData?.specialties || [],
    rating: 4.9,
    totalClasses: dashboardData?.stats?.totalClassesTaught || 0,
    thisMonth: dashboardData?.stats?.thisWeekClasses || 0,
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
        time: classTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        duration: cls.duration_minutes,
        room: cls.room_name || cls.location || "TBD",
        enrolled: cls.bookedCount,
        capacity: cls.capacity,
        checkedIn: cls.checkedInCount,
        status,
      };
    });
  }, [dashboardData]);

  // Transform week schedule for sidebar
  const upcomingSchedule = useMemo(() => {
    if (!dashboardData?.weekSchedule) return [];
    
    const grouped: Record<string, string[]> = {};
    dashboardData.weekSchedule.forEach(cls => {
      const date = new Date(cls.scheduled_at);
      const day = date.toLocaleDateString("en-US", { weekday: "long" });
      const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(`${time} - ${cls.title}`);
    });
    
    return Object.entries(grouped).map(([day, classes]) => ({ day, classes }));
  }, [dashboardData]);

  // Calculate weekly stats from dashboard data
  const weeklyStats = useMemo(() => ({
    classesThisWeek: dashboardData?.stats?.thisWeekClasses || 0,
    studentsTotal: dashboardData?.stats?.totalStudents || 0,
    avgAttendance: dashboardData?.stats?.attendanceRate || 0,
    upcomingClasses: dashboardData?.stats?.upcomingClasses || 0,
  }), [dashboardData]);

  // Format next class countdown
  const nextClassCountdown = useMemo(() => {
    if (!dashboardData?.nextClassIn) return null;
    return `${dashboardData.nextClassIn.hours}h ${dashboardData.nextClassIn.mins}m`;
  }, [dashboardData]);

  // Get time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const classStudents: Student[] = [
    { id: "1", name: "Emma Thompson", avatar: "", status: "checked_in", tokensUsed: 1, attendanceRate: 95 },
    { id: "2", name: "Michael Brown", avatar: "", status: "checked_in", tokensUsed: 1, attendanceRate: 88 },
    { id: "3", name: "Sarah Wilson", avatar: "", status: "confirmed", tokensUsed: 1, attendanceRate: 92 },
    { id: "4", name: "David Lee", avatar: "", status: "confirmed", tokensUsed: 1, attendanceRate: 78 },
    { id: "5", name: "Jennifer Garcia", avatar: "", status: "waitlist", tokensUsed: 0, attendanceRate: 85 },
    { id: "6", name: "Robert Martinez", avatar: "", status: "no_show", tokensUsed: 1, attendanceRate: 65 },
  ];

  const getStatusColor = (status: TodayClass["status"]) => {
    switch (status) {
      case "completed": return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
      case "in_progress": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "upcoming": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  const getStudentStatusColor = (status: Student["status"]) => {
    switch (status) {
      case "checked_in": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "confirmed": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "waitlist": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "no_show": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Failed to load dashboard</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{greeting}, {tutorInfo.name.split(" ")[0]}! 👋</h1>
            <p className="text-amber-100 mt-1">
              {todaysClasses.length > 0 
                ? `You have ${todaysClasses.length} class${todaysClasses.length !== 1 ? 'es' : ''} scheduled for today`
                : "No classes scheduled for today"}
            </p>
          </div>
          {nextClassCountdown && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm text-amber-100">Next class in</p>
                <p className="text-xl font-bold">{nextClassCountdown}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">This Week</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{weeklyStats.classesThisWeek}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Students</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{weeklyStats.studentsTotal}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Attendance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{weeklyStats.avgAttendance}%</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{weeklyStats.upcomingClasses}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's Classes */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today&apos;s Classes</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
              {todaysClasses.filter(c => c.status === "in_progress").length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {todaysClasses.filter(c => c.status === "in_progress").length} in progress
                </div>
              )}
            </div>
            {todaysClasses.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="mt-3 text-gray-500 dark:text-gray-400">No classes scheduled for today</p>
                <Link href="/tutor/schedule" className="mt-2 inline-block text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
                  View your schedule →
                </Link>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {todaysClasses.map((classItem) => (
                    <div key={classItem.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[70px]">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{classItem.time}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{classItem.duration} min</p>
                          </div>
                          <div className="h-10 w-px bg-gray-200 dark:bg-gray-700"></div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{classItem.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{classItem.room}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {classItem.checkedIn}/{classItem.enrolled}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">checked in</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(classItem.status)}`}>
                            {classItem.status === "in_progress" ? "In Progress" : 
                             classItem.status === "completed" ? "Completed" : "Upcoming"}
                          </span>
                          <button
                            onClick={() => { setSelectedClass(classItem); setShowAttendanceModal(true); }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              classItem.status === "completed"
                                ? "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                                : "bg-amber-500 text-white hover:bg-amber-600"
                            }`}
                          >
                            {classItem.status === "completed" ? "View" : "Attendance"}
                          </button>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              classItem.status === "completed" ? "bg-gray-400" : "bg-amber-500"
                            }`}
                            style={{ width: `${(classItem.checkedIn / classItem.enrolled) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <Link href="/tutor/classes" className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
                    View all classes →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* This Week */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">This Week</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{weeklyStats.classesThisWeek} classes scheduled</p>
            </div>
            {upcomingSchedule.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">No classes scheduled this week</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[300px] overflow-y-auto">
                {upcomingSchedule.map((day) => (
                  <div key={day.day} className="p-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{day.day}</p>
                    <div className="space-y-1">
                      {day.classes.map((cls, idx) => (
                        <p key={idx} className="text-xs text-gray-500 dark:text-gray-400 pl-3 border-l-2 border-amber-300 dark:border-amber-700">
                          {cls}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <Link href="/tutor/schedule" className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
                View full schedule →
              </Link>
            </div>
          </div>

          {/* Specialties & Stats */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Your Specialties</h3>
            <div className="flex flex-wrap gap-2">
              {tutorInfo.specialties.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No specialties added yet</p>
              ) : (
                tutorInfo.specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    {specialty}
                  </span>
                ))
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total classes taught</span>
                <span className="font-semibold text-gray-900 dark:text-white">{tutorInfo.totalClasses}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Rating</span>
                <div className="flex items-center gap-1">
                  <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-semibold text-gray-900 dark:text-white">{tutorInfo.rating}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAttendanceModal(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-gray-800">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedClass.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedClass.time} • {selectedClass.room}</p>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                <div className="text-center p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedClass.enrolled}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Enrolled</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{classStudents.filter(s => s.status === "checked_in").length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Checked In</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{classStudents.filter(s => s.status === "waitlist").length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Waitlist</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{classStudents.filter(s => s.status === "no_show").length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">No Show</p>
                </div>
              </div>
            </div>

            {/* Student List */}
            <div className="p-6 space-y-3">
              {classStudents.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">
                      {student.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{student.attendanceRate}% attendance</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStudentStatusColor(student.status)}`}>
                      {student.status === "checked_in" ? "Checked In" :
                       student.status === "confirmed" ? "Confirmed" :
                       student.status === "waitlist" ? "Waitlist" : "No Show"}
                    </span>
                    {student.status === "confirmed" && (
                      <button className="px-3 py-1.5 rounded-lg bg-emerald-500 text-sm font-medium text-white hover:bg-emerald-600 transition-colors">
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <button className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                Mark All No-Shows
              </button>
              <button className="px-4 py-2 rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 transition-colors">
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
