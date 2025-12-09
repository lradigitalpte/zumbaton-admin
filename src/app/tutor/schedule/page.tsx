"use client";

import { useState, useMemo } from "react";
import { useTutorSchedule } from "@/hooks/useTutor";

export default function TutorSchedulePage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  const dateParam = currentWeekStart.toISOString().split('T')[0];
  const { data, isLoading, error } = useTutorSchedule({ view: 'week', date: dateParam });

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  };

  const getWeekRange = () => {
    const endDate = new Date(currentWeekStart);
    endDate.setDate(currentWeekStart.getDate() + 6);
    return `${currentWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  };

  const isToday = (dateStr: string) => {
    return dateStr === new Date().toISOString().split("T")[0];
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "zumba": return "border-l-amber-500 bg-amber-50 dark:bg-amber-900/20";
      case "hiit": return "border-l-red-500 bg-red-50 dark:bg-red-900/20";
      case "dance": return "border-l-purple-500 bg-purple-50 dark:bg-purple-900/20";
      case "yoga": return "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20";
      case "pilates": return "border-l-pink-500 bg-pink-50 dark:bg-pink-900/20";
      default: return "border-l-gray-500 bg-gray-50 dark:bg-gray-700/50";
    }
  };

  // Transform schedule data into week days
  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const classes = data?.schedule?.[dateStr] || [];
      
      days.push({
        date: dateStr,
        dayName: dayNames[i],
        classes: classes.map(c => ({
          id: c.id,
          name: c.title,
          type: c.classType,
          time: c.time,
          duration: c.duration,
          room: c.location || 'TBD',
          enrolled: c.booked,
          capacity: c.capacity,
        }))
      });
    }
    return days;
  }, [currentWeekStart, data?.schedule]);

  const totalClasses = data?.summary?.totalClasses || 0;
  const byType = data?.summary?.byType || {};
  const totalStudents = weekDays.reduce((sum, day) => 
    sum + day.classes.reduce((s, c) => s + c.enrolled, 0), 0
  );

  // Calculate teaching hours
  const totalTeachingMinutes = weekDays.reduce((sum, day) => 
    sum + day.classes.reduce((s, c) => s + c.duration, 0), 0
  );
  const totalTeachingHours = Math.round(totalTeachingMinutes / 60);

  // Calculate class distribution percentages
  const getTypePercentage = (type: string) => {
    if (totalClasses === 0) return 0;
    return Math.round(((byType[type] || 0) / totalClasses) * 100);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading schedule...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Failed to load schedule</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Schedule</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Your weekly class schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek("prev")}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeek("next")}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Week Overview */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{getWeekRange()}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalClasses} classes • {totalStudents} total students
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500"></span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Zumba</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500"></span>
              <span className="text-xs text-gray-500 dark:text-gray-400">HIIT</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-purple-500"></span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Dance</span>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((day) => (
            <div
              key={day.date}
              className={`rounded-xl border p-4 ${
                isToday(day.date)
                  ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`text-sm font-semibold ${
                    isToday(day.date) ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"
                  }`}>
                    {day.dayName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                {isToday(day.date) && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-xs font-medium text-white">
                    Today
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {day.classes.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No classes</p>
                ) : (
                  day.classes.map((cls) => (
                    <div
                      key={cls.id}
                      className={`p-2 rounded-lg border-l-4 ${getTypeColor(cls.type)}`}
                    >
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{cls.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{cls.time}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">{cls.room}</span>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{cls.enrolled}/{cls.capacity}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {day.classes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {day.classes.length} class{day.classes.length !== 1 ? "es" : ""}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">This Week Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Classes</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{totalClasses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Zumba Classes</span>
              <span className="text-lg font-bold text-amber-600">{byType['zumba'] || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">HIIT Classes</span>
              <span className="text-lg font-bold text-red-600">{byType['hiit'] || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Dance Classes</span>
              <span className="text-lg font-bold text-purple-600">{byType['dance'] || 0}</span>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Teaching Hours</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{totalTeachingHours}h</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Class Distribution</h3>
          {totalClasses === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No classes this week</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Zumba</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{getTypePercentage('zumba')}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${getTypePercentage('zumba')}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">HIIT</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{getTypePercentage('hiit')}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-red-500" style={{ width: `${getTypePercentage('hiit')}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Dance</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{getTypePercentage('dance')}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-500" style={{ width: `${getTypePercentage('dance')}%` }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
