"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import QRAttendanceModal from "@/components/attendance/QRAttendanceModal";
import { useTutorClasses } from "@/hooks/useTutor";

interface ClassItem {
  id: string;
  name: string;
  type: string;
  time: string;
  duration: number;
  room: string;
  date: string;
  enrolled: number;
  capacity: number;
  attended: number;
  status: "upcoming" | "completed" | "cancelled";
}

export default function TutorClassesPage() {
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [attendanceClass, setAttendanceClass] = useState<ClassItem | null>(null);

  // Fetch classes from API based on filter
  const { data, isLoading, error } = useTutorClasses({ 
    status: filter === "all" ? "all" : filter === "upcoming" ? "upcoming" : "past",
    limit: 50 
  });

  // Transform API data to component format
  const classes: ClassItem[] = useMemo(() => {
    if (!data?.classes) return [];
    
    const now = new Date();
    return data.classes.map(cls => {
      const classTime = new Date(cls.scheduled_at);
      const isPast = classTime < now;
      
      return {
        id: cls.id,
        name: cls.title,
        type: cls.class_type.charAt(0).toUpperCase() + cls.class_type.slice(1),
        time: classTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        duration: cls.duration_minutes,
        room: cls.location || "TBD",
        date: classTime.toISOString().split("T")[0],
        enrolled: cls.bookedCount,
        capacity: cls.capacity,
        attended: cls.attendedCount,
        status: cls.status === "cancelled" ? "cancelled" : isPast ? "completed" : "upcoming",
      };
    });
  }, [data]);

  const filteredClasses = classes;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const groupedClasses = filteredClasses.reduce((acc, cls) => {
    const dateKey = cls.date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(cls);
    return acc;
  }, {} as Record<string, ClassItem[]>);

  const sortedDates = Object.keys(groupedClasses).sort((a, b) => {
    if (filter === "past") return new Date(b).getTime() - new Date(a).getTime();
    return new Date(a).getTime() - new Date(b).getTime();
  });

  const stats = useMemo(() => ({
    totalClasses: data?.meta?.total || classes.length,
    upcoming: classes.filter(c => c.status === "upcoming").length,
    completed: classes.filter(c => c.status === "completed").length,
    totalStudents: classes.reduce((sum, c) => sum + c.enrolled, 0),
  }), [data, classes]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Classes</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">View and manage your scheduled classes</p>
          </div>
        </div>
        
        {/* Loading skeleton */}
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading your classes...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Classes</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">View and manage your scheduled classes</p>
          </div>
        </div>
        
        {/* Error message */}
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Failed to load classes</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Classes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">View and manage your scheduled classes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Classes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalClasses}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
          <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
          <p className="text-2xl font-bold text-amber-600">{stats.totalStudents}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { id: "all", label: "All Classes" },
          { id: "upcoming", label: "Upcoming" },
          { id: "past", label: "Completed" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === tab.id
                ? "bg-amber-500 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Classes List */}
      <div className="space-y-6">
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No classes found</h3>
            <p className="mt-2 text-center text-gray-500 dark:text-gray-400">
              {filter === "upcoming" 
                ? "You don't have any upcoming classes scheduled."
                : filter === "past"
                ? "You haven't completed any classes yet."
                : "You don't have any classes assigned yet."}
            </p>
          </div>
        ) : (
        sortedDates.map((date) => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
              {formatDate(date)}
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
            </h3>
            <div className="space-y-3">
              {groupedClasses[date].map((classItem) => (
                <div
                  key={classItem.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedClass(classItem)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                        classItem.type.toLowerCase() === "zumba" ? "bg-amber-100 dark:bg-amber-900/30" :
                        classItem.type.toLowerCase() === "hiit" ? "bg-red-100 dark:bg-red-900/30" :
                        "bg-purple-100 dark:bg-purple-900/30"
                      }`}>
                        <span className={`text-lg font-bold ${
                          classItem.type.toLowerCase() === "zumba" ? "text-amber-600 dark:text-amber-400" :
                          classItem.type.toLowerCase() === "hiit" ? "text-red-600 dark:text-red-400" :
                          "text-purple-600 dark:text-purple-400"
                        }`}>
                          {classItem.type[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{classItem.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {classItem.time} • {classItem.duration}min
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {classItem.room}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {classItem.status === "completed" ? classItem.attended : classItem.enrolled}/{classItem.capacity}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {classItem.status === "completed" ? "attended" : "enrolled"}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        classItem.status === "completed" ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                        classItem.status === "upcoming" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {classItem.status === "completed" ? "Completed" : classItem.status === "upcoming" ? "Upcoming" : "Cancelled"}
                      </span>
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  {/* Attendance Progress */}
                  {classItem.status === "completed" && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Attendance Rate</span>
                        <span>{Math.round((classItem.attended / classItem.enrolled) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${(classItem.attended / classItem.enrolled) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {/* Quick Start Attendance Button for Upcoming Classes */}
                  {classItem.status === "upcoming" && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttendanceClass(classItem);
                        }}
                        className="w-full px-4 py-2 rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        Start Attendance
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )))
        }
      </div>

      {/* Class Detail Modal */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedClass(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-800">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                    selectedClass.type.toLowerCase() === "zumba" ? "bg-amber-100 dark:bg-amber-900/30" :
                    selectedClass.type.toLowerCase() === "hiit" ? "bg-red-100 dark:bg-red-900/30" :
                    "bg-purple-100 dark:bg-purple-900/30"
                  }`}>
                    <span className={`text-lg font-bold ${
                      selectedClass.type === "Zumba" ? "text-amber-600 dark:text-amber-400" :
                      selectedClass.type === "HIIT" ? "text-red-600 dark:text-red-400" :
                      "text-purple-600 dark:text-purple-400"
                    }`}>
                      {selectedClass.type[0]}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedClass.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedClass.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClass(null)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Date & Time</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(selectedClass.date)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedClass.time} • {selectedClass.duration}min</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Location</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedClass.room}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Zumbathon Studio</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Enrollment</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedClass.enrolled}/{selectedClass.capacity}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">students enrolled</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedClass.status === "completed" ? "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300" :
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {selectedClass.status === "completed" ? "Completed" : "Upcoming"}
                  </span>
                </div>
              </div>

              {selectedClass.status === "completed" && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Attendance Report</p>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{Math.round((selectedClass.attended / selectedClass.enrolled) * 100)}%</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-emerald-700 dark:text-emerald-400">{selectedClass.attended} attended</span>
                    <span className="text-gray-500 dark:text-gray-400">{selectedClass.enrolled - selectedClass.attended} absent</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Link
                  href={`/tutor/students?class=${selectedClass.id}`}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors text-center"
                >
                  View Students
                </Link>
                {selectedClass.status === "upcoming" && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttendanceClass(selectedClass);
                      setSelectedClass(null);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Start Attendance
                  </button>
                )}
                {selectedClass.status === "completed" && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttendanceClass(selectedClass);
                      setSelectedClass(null);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    View Attendance
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Attendance Modal */}
      {attendanceClass && (
        <QRAttendanceModal
          isOpen={!!attendanceClass}
          onClose={() => setAttendanceClass(null)}
          classInfo={attendanceClass}
        />
      )}
    </div>
  );
}
