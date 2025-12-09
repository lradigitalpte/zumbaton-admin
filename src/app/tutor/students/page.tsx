"use client";

import { useState, useMemo } from "react";
import { useTutorStudents } from "@/hooks/useTutor";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  stats: {
    classesBooked: number;
    classesAttended: number;
    noShows: number;
  };
  attendanceRate: number;
}

export default function TutorStudentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "attendance" | "classes">("name");

  const { data, isLoading, error } = useTutorStudents({ search: searchQuery });

  const students = data?.students || [];

  const filteredStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "attendance") return b.attendanceRate - a.attendanceRate;
      return b.stats.classesAttended - a.stats.classesAttended;
    });
  }, [students, sortBy]);

  const stats = useMemo(() => {
    const activeStudents = students.filter(s => s.attendanceRate > 0);
    return {
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      avgAttendance: students.length > 0 
        ? Math.round(students.reduce((sum, s) => sum + s.attendanceRate, 0) / students.length) 
        : 0,
      topPerformers: students.filter(s => s.attendanceRate >= 90).length,
    };
  }, [students]);

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (rate >= 75) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getAttendanceBg = (rate: number) => {
    if (rate >= 90) return "bg-emerald-100 dark:bg-emerald-900/30";
    if (rate >= 75) return "bg-amber-100 dark:bg-amber-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading students...</p>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Failed to load students</h3>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Students</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Students who attend your classes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalStudents}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.activeStudents}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Attendance</p>
          <p className="text-2xl font-bold text-amber-600">{stats.avgAttendance}%</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Top Performers</p>
          <p className="text-2xl font-bold text-purple-600">{stats.topPerformers}</p>
        </div>
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search students by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="name">Sort by Name</option>
          <option value="attendance">Sort by Attendance</option>
          <option value="classes">Sort by Classes</option>
        </select>
      </div>

      {/* Empty State */}
      {filteredStudents.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No students found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {searchQuery ? "Try adjusting your search" : "Students will appear here once they book your classes"}
          </p>
        </div>
      )}

      {/* Students Grid */}
      {filteredStudents.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedStudent(student)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center text-lg font-bold text-white">
                    {student.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{student.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{student.email}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  student.attendanceRate > 0 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}>
                  {student.attendanceRate > 0 ? "active" : "inactive"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{student.stats.classesAttended}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Classes</p>
                </div>
                <div className={`text-center p-2 rounded-lg ${getAttendanceBg(student.attendanceRate)}`}>
                  <p className={`text-lg font-bold ${getAttendanceColor(student.attendanceRate)}`}>{student.attendanceRate}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Attendance</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{student.stats.noShows}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">No-Shows</p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Member since: <span className="text-gray-700 dark:text-gray-300">{new Date(student.created_at).toLocaleDateString()}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedStudent(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-800">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl font-bold text-white">
                    {selectedStudent.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedStudent.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Member since {new Date(selectedStudent.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{selectedStudent.email}</span>
                </div>
                {selectedStudent.phone && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{selectedStudent.phone}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedStudent.stats.classesAttended}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Attended</p>
                </div>
                <div className={`text-center p-4 rounded-xl ${getAttendanceBg(selectedStudent.attendanceRate)}`}>
                  <p className={`text-2xl font-bold ${getAttendanceColor(selectedStudent.attendanceRate)}`}>{selectedStudent.attendanceRate}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Attendance</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedStudent.stats.noShows}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">No-Shows</p>
                </div>
              </div>

              {/* Attendance Progress */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Attendance Rate</span>
                  <span className={`text-sm font-bold ${getAttendanceColor(selectedStudent.attendanceRate)}`}>{selectedStudent.attendanceRate}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      selectedStudent.attendanceRate >= 90 ? "bg-emerald-500" :
                      selectedStudent.attendanceRate >= 75 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${selectedStudent.attendanceRate}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {selectedStudent.attendanceRate >= 90 ? "Excellent attendance! 🌟" :
                   selectedStudent.attendanceRate >= 75 ? "Good attendance, keep it up!" :
                   "Needs improvement"}
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Booked: <span className="font-medium">{selectedStudent.stats.classesBooked} classes</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
