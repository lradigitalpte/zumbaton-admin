"use client";

import { useTutorStats } from "@/hooks/useTutor";

export default function TutorStatsPage() {
  const { data, isLoading, error } = useTutorStats();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading stats...</p>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Failed to load stats</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }

  const stats = {
    totalClasses: data?.overview?.totalClassesTaught || 0,
    thisMonth: data?.thisMonth?.classes || 0,
    thisWeek: 0, // Not tracked separately
    totalStudents: data?.overview?.totalStudentBookings || 0,
    uniqueStudents: data?.overview?.uniqueStudents || 0,
    avgClassSize: Math.round(data?.overview?.avgClassSize || 0),
    avgAttendance: Math.round(data?.overview?.attendanceRate || 0),
    rating: 4.9, // Not tracked in DB yet
    totalReviews: 0, // Not tracked in DB yet
  };

  const changes = {
    classesChange: data?.changes?.classesChange || 0,
    studentsChange: data?.changes?.studentsChange || 0,
    attendanceRateChange: data?.changes?.attendanceRateChange || 0,
  };

  // Convert byClassType to array for display
  const classTypeStats = Object.entries(data?.byClassType || {}).map(([type, count]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    classes: count as number,
    students: 0, // Would need additional query
    avgAttendance: stats.avgAttendance,
    color: type === 'zumba' ? 'amber' : type === 'hiit' ? 'red' : type === 'dance' ? 'purple' : 'blue'
  }));

  const topStudents = [
    { name: "Top Student 1", classes: 0, attendance: 0 },
  ];

  const recentReviews = [
    { student: "Student", rating: 5, comment: "No reviews yet", date: "N/A" },
  ];

  // Monthly data - using current month stats
  const monthlyData = [
    { month: "This Month", classes: data?.thisMonth?.classes || 0, students: data?.thisMonth?.students || 0, attendance: data?.thisMonth?.attendanceRate || 0 },
  ];

  const maxStudents = Math.max(...monthlyData.map(d => d.students), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Stats</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Your performance metrics and insights</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            {changes.classesChange !== undefined && changes.classesChange !== null && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                changes.classesChange >= 0
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30"
                  : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
              }`}>
                {changes.classesChange >= 0 ? "+" : ""}{changes.classesChange}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalClasses}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Classes</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            {changes.studentsChange !== undefined && changes.studentsChange !== null && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                changes.studentsChange >= 0
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30"
                  : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
              }`}>
                {changes.studentsChange >= 0 ? "+" : ""}{changes.studentsChange}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.uniqueStudents}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Unique Students</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {changes.attendanceRateChange !== undefined && changes.attendanceRateChange !== null && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                changes.attendanceRateChange >= 0
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30"
                  : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
              }`}>
                {changes.attendanceRateChange >= 0 ? "+" : ""}{changes.attendanceRateChange}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgAttendance}%</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Attendance</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{stats.totalReviews} reviews</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.rating}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Average Rating</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly Trend */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Monthly Performance</h3>
          <div className="flex items-end gap-4 h-48">
            {monthlyData.map((data) => (
              <div key={data.month} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{data.students}</span>
                  <div 
                    className="w-full rounded-t-lg bg-linear-to-t from-amber-500 to-amber-400 transition-all"
                    style={{ height: `${(data.students / maxStudents) * 100}%`, minHeight: "20px" }}
                  ></div>
                </div>
                <span className="mt-2 text-xs text-gray-500 dark:text-gray-400">{data.month}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {monthlyData.reduce((sum, d) => sum + d.classes, 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Classes (6 mo)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {monthlyData.reduce((sum, d) => sum + d.students, 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Students</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.round(monthlyData.reduce((sum, d) => sum + d.attendance, 0) / monthlyData.length)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Attendance</p>
            </div>
          </div>
        </div>

        {/* Top Students */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Students</h3>
          <div className="space-y-3">
            {topStudents.map((student, idx) => (
              <div key={student.name} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  idx === 0 ? "bg-amber-100 text-amber-700" :
                  idx === 1 ? "bg-gray-200 text-gray-700" :
                  idx === 2 ? "bg-orange-100 text-orange-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{student.classes} classes</p>
                </div>
                <span className={`text-sm font-semibold ${
                  student.attendance >= 90 ? "text-emerald-600" :
                  student.attendance >= 80 ? "text-amber-600" : "text-red-600"
                }`}>
                  {student.attendance}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Class Type Performance */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance by Class Type</h3>
          <div className="space-y-4">
            {classTypeStats.map((type) => (
              <div key={type.type} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${
                      type.color === "amber" ? "bg-amber-500" :
                      type.color === "red" ? "bg-red-500" : "bg-purple-500"
                    }`}></span>
                    <span className="font-medium text-gray-900 dark:text-white">{type.type}</span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{type.classes} classes/month</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Students</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{type.students}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Attendance</p>
                    <p className={`text-lg font-bold ${
                      type.avgAttendance >= 90 ? "text-emerald-600" : "text-amber-600"
                    }`}>{type.avgAttendance}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Reviews</h3>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="ml-1 text-sm font-semibold text-gray-900 dark:text-white">{stats.rating}</span>
            </div>
          </div>
          <div className="space-y-4">
            {recentReviews.map((review, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">{review.student}</span>
                  <div className="flex items-center gap-0.5">
                    {[...Array(review.rating)].map((_, i) => (
                      <svg key={i} className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">&ldquo;{review.comment}&rdquo;</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{review.date}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
