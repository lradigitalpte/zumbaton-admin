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
  _isParent?: boolean;
  _childInstances?: ClassItem[];
  _totalSessions?: number;
  recurrence_type?: 'single' | 'recurring' | 'course' | null;
}

export default function TutorClassesPage() {
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [attendanceClass, setAttendanceClass] = useState<ClassItem | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

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
      
      // Transform child instances if they exist
      const childInstances: ClassItem[] = (cls._childInstances || []).map((child: any) => {
        const childTime = new Date(child.scheduled_at);
        const childIsPast = childTime < now;
        return {
          id: child.id,
          name: child.title,
          type: child.class_type.charAt(0).toUpperCase() + child.class_type.slice(1),
          time: childTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" }),
          duration: child.duration_minutes,
          room: child.room_name || child.location || "TBD",
          date: childTime.toISOString().split("T")[0],
          enrolled: child.bookedCount || 0,
          capacity: child.capacity,
          attended: child.attendedCount || 0,
          status: child.status === "cancelled" ? "cancelled" : childIsPast ? "completed" : "upcoming",
          _isParent: false,
          _childInstances: [],
          _totalSessions: 0,
          recurrence_type: (child.recurrence_type as 'single' | 'recurring' | 'course' | null) || 'single',
        };
      });
      
      return {
        id: cls.id,
        name: cls.title,
        type: cls.class_type.charAt(0).toUpperCase() + cls.class_type.slice(1),
        time: classTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" }),
        duration: cls.duration_minutes,
        room: cls.room_name || cls.location || "TBD",
        date: classTime.toISOString().split("T")[0],
        enrolled: cls.bookedCount,
        capacity: cls.capacity,
        attended: cls.attendedCount,
        status: cls.status === "cancelled" ? "cancelled" : isPast ? "completed" : "upcoming",
        _isParent: cls._isParent || false,
        _childInstances: childInstances,
        _totalSessions: cls._totalSessions || 0,
        recurrence_type: (cls.recurrence_type as 'single' | 'recurring' | 'course' | null) || 'single',
      };
    });
  }, [data]);

  const filteredClasses = classes;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "TBD";
    }
    
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

  // Need to get booking data for child instances when expanded
  const bookingData = useMemo(() => {
    const data: Record<string, { total: number; attended: number }> = {};
    classes.forEach(cls => {
      data[cls.id] = { total: cls.enrolled, attended: cls.attended };
      // Also include child instances if they exist
      if (cls._childInstances && cls._childInstances.length > 0) {
        cls._childInstances.forEach((child: ClassItem) => {
          data[child.id] = { total: child.enrolled, attended: child.attended };
        });
      }
    });
    return data;
  }, [classes]);

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

      {/* Filters and View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
        <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-1 bg-white dark:bg-gray-800">
          <button
            onClick={() => setViewMode("card")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "card"
                ? "bg-amber-500 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "table"
                ? "bg-amber-500 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
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
        ) : viewMode === "table" ? (
          // Table View
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Enrollment</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedDates.map((date) =>
                    groupedClasses[date].map((classItem) => (
                      <tr
                  key={classItem.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedClass(classItem)}
                >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(classItem.date)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{classItem.time}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        classItem.type.toLowerCase() === "zumba" ? "bg-amber-100 dark:bg-amber-900/30" :
                        classItem.type.toLowerCase() === "hiit" ? "bg-red-100 dark:bg-red-900/30" :
                        "bg-purple-100 dark:bg-purple-900/30"
                      }`}>
                              <span className={`text-sm font-bold ${
                          classItem.type.toLowerCase() === "zumba" ? "text-amber-600 dark:text-amber-400" :
                          classItem.type.toLowerCase() === "hiit" ? "text-red-600 dark:text-red-400" :
                          "text-purple-600 dark:text-purple-400"
                        }`}>
                          {classItem.type[0]}
                        </span>
                      </div>
                      <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{classItem.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{classItem.type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="text-sm text-gray-900 dark:text-white">{classItem.room || "TBA"}</span>
                        </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 dark:text-white">{classItem.duration} min</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {classItem.status === "completed" ? classItem.attended : classItem.enrolled}/{classItem.capacity}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {classItem.status === "completed" ? "attended" : "enrolled"}
                        </p>
                      </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        classItem.status === "completed" ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                        classItem.status === "upcoming" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {classItem.status === "completed" ? "Completed" : classItem.status === "upcoming" ? "Upcoming" : "Cancelled"}
                      </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {classItem.status === "upcoming" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAttendanceClass(classItem);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                            >
                              Start
                            </button>
                          )}
                          <svg className="h-5 w-5 text-gray-400 inline-block ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Card View
          sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
                {formatDate(date)}
                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedClasses[date].map((classItem) => {
                  const isRecurringOrCourse = classItem._isParent && (classItem.recurrence_type === 'recurring' || classItem.recurrence_type === 'course');
                  const isCourse = classItem.recurrence_type === 'course';
                  const isRecurring = classItem.recurrence_type === 'recurring';
                  const isExpanded = expandedParents.has(classItem.id);
                  
                  return (
                    <div key={classItem.id} className="space-y-2">
                      {/* Parent Card for Recurring/Course */}
                      <div
                        className={`rounded-xl border p-5 dark:border-gray-700 dark:bg-gray-800 hover:shadow-lg transition-all cursor-pointer ${
                          isRecurringOrCourse
                            ? isCourse
                              ? 'border-purple-300 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-700'
                              : 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-700'
                            : 'border-gray-200 bg-white'
                        }`}
                        onClick={() => {
                          if (isRecurringOrCourse && classItem._childInstances && classItem._childInstances.length > 0) {
                            setExpandedParents(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(classItem.id)) {
                                newSet.delete(classItem.id);
                              } else {
                                newSet.add(classItem.id);
                              }
                              return newSet;
                            });
                          } else {
                            setSelectedClass(classItem);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                              classItem.type.toLowerCase() === "zumba" ? "bg-amber-100 dark:bg-amber-900/30" :
                              classItem.type.toLowerCase() === "hiit" ? "bg-red-100 dark:bg-red-900/30" :
                              isCourse ? "bg-purple-100 dark:bg-purple-900/30" :
                              isRecurring ? "bg-blue-100 dark:bg-blue-900/30" :
                              "bg-purple-100 dark:bg-purple-900/30"
                            }`}>
                              <span className={`text-lg font-bold ${
                                classItem.type.toLowerCase() === "zumba" ? "text-amber-600 dark:text-amber-400" :
                                classItem.type.toLowerCase() === "hiit" ? "text-red-600 dark:text-red-400" :
                                isCourse ? "text-purple-600 dark:text-purple-400" :
                                isRecurring ? "text-blue-600 dark:text-blue-400" :
                                "text-purple-600 dark:text-purple-400"
                              }`}>
                                {classItem.type[0]}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">{classItem.name}</p>
                                {isRecurringOrCourse && (
                                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold shrink-0 ${
                                    isCourse
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  }`}>
                                    {isCourse ? 'Course' : 'Series'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{classItem.type}</p>
                              {isRecurringOrCourse && (classItem._totalSessions ?? 0) > 0 && (
                                <p className={`text-xs mt-1 font-medium ${
                                  isCourse ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'
                                }`}>
                                  {classItem._totalSessions ?? 0} session{(classItem._totalSessions ?? 0) !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                            classItem.status === "completed" ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                            classItem.status === "upcoming" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                            {classItem.status === "completed" ? "Completed" : classItem.status === "upcoming" ? "Upcoming" : "Cancelled"}
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{classItem.time} • {classItem.duration}min</span>
                            {isRecurringOrCourse && (
                              <span className={`text-xs font-medium ${
                                isCourse ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'
                              }`}>
                                (Next session)
                              </span>
                            )}
                          </div>
                          {classItem.room && classItem.room !== "TBD" && classItem.room !== "TBA" && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              <span className="truncate">{classItem.room}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>{classItem.status === "completed" ? classItem.attended : classItem.enrolled}/{classItem.capacity} {classItem.status === "completed" ? "attended" : "enrolled"}</span>
                    </div>
                  </div>

                        {/* Expand/Collapse Button for Recurring/Course */}
                        {isRecurringOrCourse && classItem._childInstances && classItem._childInstances.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedParents(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(classItem.id)) {
                                  newSet.delete(classItem.id);
                                } else {
                                  newSet.add(classItem.id);
                                }
                                return newSet;
                              });
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors mb-3 ${
                              isCourse
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
                            }`}
                          >
                              {isExpanded ? 'Hide' : 'View'} {classItem._totalSessions ?? 0} Sessions
                          </button>
                        )}

                  {/* Attendance Progress */}
                  {classItem.status === "completed" && (
                          <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Attendance Rate</span>
                        <span>{classItem.enrolled > 0 ? Math.round((classItem.attended / classItem.enrolled) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${classItem.enrolled > 0 ? (classItem.attended / classItem.enrolled) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Quick Start Attendance Button for Upcoming Classes */}
                  {classItem.status === "upcoming" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttendanceClass(classItem);
                        }}
                            className="w-full px-4 py-2.5 rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        Start Attendance
                      </button>
                        )}
                      </div>
                      
                      {/* Expanded Child Sessions */}
                      {isExpanded && classItem._childInstances && classItem._childInstances.length > 0 && (
                        <div className="ml-4 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                          {classItem._childInstances.map((session: any) => {
                            const isPast = new Date(session.date) < new Date();
                            const sessionStatus = session.status === "cancelled" ? "cancelled" : isPast ? "completed" : "upcoming";
                            
                            return (
                              <div
                                key={session.id}
                                className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClass({
                                    id: session.id,
                                    name: session.name,
                                    type: session.type,
                                    time: session.time,
                                    duration: session.duration,
                                    room: "Studio",
                                    date: session.date,
                                    enrolled: bookingData[session.id]?.total || 0,
                                    capacity: session.capacity,
                                    attended: bookingData[session.id]?.attended || 0,
                                    status: sessionStatus,
                                  });
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{session.name}</p>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      <span>{session.time}</span>
                                      <span>•</span>
                                      <span>{(bookingData[session.id]?.total || 0)}/{session.capacity}</span>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                                    sessionStatus === "completed" ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                                    sessionStatus === "upcoming" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  }`}>
                                    {sessionStatus === "completed" ? "Done" : sessionStatus === "upcoming" ? "Upcoming" : "Cancelled"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                    </div>
                  )}
                </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
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
                  <p className="font-medium text-gray-900 dark:text-white">{selectedClass.room || "TBA"}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Class Location</p>
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
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{selectedClass.enrolled > 0 ? Math.round((selectedClass.attended / selectedClass.enrolled) * 100) : 0}%</p>
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
