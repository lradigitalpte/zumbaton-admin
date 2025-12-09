"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useAuth } from "@/context/AuthContext";
import {
  useAttendance,
  useCheckIn,
  useBulkCheckIn,
  useMarkNoShow,
  type ClassSession,
  type Attendee,
} from "@/hooks/useAttendance";

export default function AttendancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "checked-in" | "no-show">("all");
  const [showQuickCheckIn, setShowQuickCheckIn] = useState(false);
  const [quickCheckInId, setQuickCheckInId] = useState("");

  // API hooks
  const { data, isLoading, error, refetch } = useAttendance();
  const checkIn = useCheckIn();
  const bulkCheckIn = useBulkCheckIn();
  const markNoShow = useMarkNoShow();

  const sessions = data?.classes || [];
  const todayStats = data?.stats || {
    totalClasses: 0,
    totalBookings: 0,
    checkedIn: 0,
    pending: 0,
    noShows: 0,
  };

  // Auto-select first session when data loads
  useMemo(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0]);
    }
  }, [sessions, selectedSession]);

  // Get current time for display
  const currentTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const currentDate = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const handleCheckIn = async (bookingId: string) => {
    if (!user?.id) return;
    
    try {
      await checkIn.mutateAsync({
        bookingId,
        checkedInBy: user.id,
        method: 'admin',
      });
    } catch (err) {
      console.error('Check-in failed:', err);
      alert('Failed to check in. Please try again.');
    }
  };

  const handleMarkNoShow = async (bookingId: string) => {
    if (!user?.id) return;
    
    try {
      await markNoShow.mutateAsync({
        bookingId,
        markedBy: user.id,
      });
    } catch (err) {
      console.error('Mark no-show failed:', err);
      alert('Failed to mark as no-show. Please try again.');
    }
  };

  const handleBulkCheckIn = async () => {
    if (!selectedSession || !user?.id) return;
    
    const pendingBookingIds = selectedSession.attendees
      .filter(a => a.status === 'pending')
      .map(a => a.bookingId);
    
    if (pendingBookingIds.length === 0) return;
    
    try {
      await bulkCheckIn.mutateAsync({
        bookingIds: pendingBookingIds,
        checkedInBy: user.id,
      });
    } catch (err) {
      console.error('Bulk check-in failed:', err);
      alert('Failed to bulk check in. Please try again.');
    }
  };

  const handleQuickCheckIn = () => {
    if (!quickCheckInId.trim() || !selectedSession) return;
    
    const attendee = selectedSession.attendees.find(
      (a) => a.bookingId.toLowerCase() === quickCheckInId.toLowerCase() || 
             a.email.toLowerCase() === quickCheckInId.toLowerCase()
    );
    
    if (attendee && attendee.status === "pending") {
      handleCheckIn(attendee.bookingId);
      setQuickCheckInId("");
      setShowQuickCheckIn(false);
    }
  };

  const getSessionStats = (session: ClassSession) => {
    const checkedIn = session.attendees.filter((a) => a.status === "checked-in").length;
    const pending = session.attendees.filter((a) => a.status === "pending").length;
    const noShows = session.attendees.filter((a) => a.status === "no-show").length;
    return { checkedIn, pending, noShows, total: session.attendees.length };
  };

  const filteredAttendees = useMemo(() => {
    if (!selectedSession) return [];
    return selectedSession.attendees.filter((att) => {
      const matchesSearch = searchQuery === "" ||
        att.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        att.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        att.bookingId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || att.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [selectedSession, searchQuery, statusFilter]);

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Attendance Check-In" />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Attendance Check-In" />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Failed to load attendance data</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Attendance Check-In" />

      {/* Header with Date/Time and Quick Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-600 text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Check-In Station</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{currentDate} • {currentTime}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* QR Code Check-In Button */}
          {selectedSession && (
            <button
              onClick={() => router.push(`/attendance/qr/${selectedSession.id}`)}
              className="flex items-center gap-2 rounded-xl bg-linear-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-500/25 transition-all hover:shadow-xl hover:shadow-brand-500/30"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              QR Check-In
            </button>
          )}

          {/* Quick Check-In Toggle */}
          <button
            onClick={() => setShowQuickCheckIn(!showQuickCheckIn)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              showQuickCheckIn
                ? "bg-brand-500 text-white"
                : "bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Check-In
          </button>

          {/* Refresh Button */}
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Check-In Bar */}
      {showQuickCheckIn && (
        <div className="overflow-hidden rounded-2xl bg-linear-to-r from-brand-500 to-brand-600 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-white/90">
                Enter Booking ID or Email
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={quickCheckInId}
                  onChange={(e) => setQuickCheckInId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickCheckIn()}
                  placeholder="e.g., B001 or email@example.com"
                  className="flex-1 rounded-xl border-0 bg-white/20 px-4 py-3 text-white placeholder-white/60 backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/50"
                  autoFocus
                />
                <button
                  onClick={handleQuickCheckIn}
                  className="rounded-xl bg-white px-6 py-3 font-semibold text-brand-600 transition-all hover:bg-white/90"
                >
                  Check In
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowQuickCheckIn(false)}
              className="self-start rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white sm:self-center"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Today's Overview Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{todayStats.totalClasses}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Classes Today</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{todayStats.totalBookings}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Bookings</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
              <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{todayStats.checkedIn}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Checked In</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{todayStats.pending}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Pending</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/20">
              <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{todayStats.noShows}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">No Shows</div>
            </div>
          </div>
        </div>
      </div>

      {/* Class Selection Cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Today&apos;s Classes</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sessions.map((session) => {
            const stats = getSessionStats(session);
            const isSelected = selectedSession?.id === session.id;
            const isPast = parseInt(session.endTime.replace(":", "")) < parseInt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ""));
            const isActive = !isPast && parseInt(session.time.replace(":", "")) <= parseInt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ""));
            
            return (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`group relative overflow-hidden rounded-2xl p-5 text-left transition-all ${
                  isSelected
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25"
                    : "bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-gray-300 dark:bg-gray-900 dark:ring-gray-800 dark:hover:ring-gray-700"
                }`}
              >
                {/* Active Indicator */}
                {isActive && !isSelected && (
                  <div className="absolute right-3 top-3">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                    </span>
                  </div>
                )}
                
                {/* Time Badge */}
                <div className={`mb-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : isPast
                    ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    : "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400"
                }`}>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {session.time} - {session.endTime}
                </div>

                {/* Class Name */}
                <h3 className={`text-lg font-bold ${isSelected ? "text-white" : "text-gray-900 dark:text-white"}`}>
                  {session.className}
                </h3>

                {/* Instructor & Room */}
                <div className={`mt-1 flex items-center gap-2 text-sm ${isSelected ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
                  <span>{session.instructor}</span>
                  <span>•</span>
                  <span>{session.room}</span>
                </div>

                {/* Stats */}
                <div className="mt-4 flex items-center gap-2">
                  <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  }`}>
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {stats.checkedIn}
                  </div>
                  <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                  }`}>
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {stats.pending}
                  </div>
                  {stats.noShows > 0 && (
                    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      isSelected ? "bg-white/20 text-white" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                    }`}>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {stats.noShows}
                    </div>
                  )}
                </div>

                {/* Capacity Bar */}
                <div className="mt-4">
                  <div className={`mb-1 flex justify-between text-xs ${isSelected ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
                    <span>Capacity</span>
                    <span>{stats.total}/{session.capacity}</span>
                  </div>
                  <div className={`h-1.5 overflow-hidden rounded-full ${isSelected ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700"}`}>
                    <div
                      className={`h-full rounded-full transition-all ${isSelected ? "bg-white" : "bg-brand-500"}`}
                      style={{ width: `${(stats.total / session.capacity) * 100}%` }}
                    />
                  </div>
                </div>

                {/* QR Check-In Button */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/attendance/qr/${session.id}`);
                  }}
                  className={`mt-4 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white/20 text-white hover:bg-white/30"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QR Check-In
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Attendee List */}
      {selectedSession && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-500/20">
                  <svg className="h-6 w-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedSession.className}
                  </h2>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>{selectedSession.time} - {selectedSession.endTime}</span>
                    <span>•</span>
                    <span>{selectedSession.instructor}</span>
                    <span>•</span>
                    <span>{selectedSession.room}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* QR Check-In Button */}
                <button
                  onClick={() => router.push(`/attendance/qr/${selectedSession.id}`)}
                  className="flex items-center gap-2 rounded-xl bg-linear-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-500/25 transition-all hover:shadow-xl hover:shadow-brand-500/30"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QR Check-In
                </button>

                {/* Bulk Check-In */}
                {selectedSession.attendees.some((a) => a.status === "pending") && (
                  <button
                    onClick={handleBulkCheckIn}
                    disabled={bulkCheckIn.isPending}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {bulkCheckIn.isPending ? (
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    Check In All ({selectedSession.attendees.filter((a) => a.status === "pending").length})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                {(["all", "pending", "checked-in", "no-show"] as const).map((status) => {
                  const count = status === "all" 
                    ? selectedSession.attendees.length 
                    : selectedSession.attendees.filter((a) => a.status === status).length;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        statusFilter === status
                          ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      }`}
                    >
                      {status === "all" ? "All" : status === "checked-in" ? "Checked In" : status === "no-show" ? "No Show" : "Pending"}
                      <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                        statusFilter === status
                          ? "bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                          : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, email, or booking ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 sm:w-80"
                />
              </div>
            </div>
          </div>

          {/* Attendee Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Attendee
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Booking ID
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Tokens
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Check-In Time
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredAttendees.map((attendee) => (
                  <tr
                    key={attendee.id}
                    className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
                          attendee.status === "checked-in"
                            ? "bg-emerald-500"
                            : attendee.status === "no-show"
                            ? "bg-red-500"
                            : "bg-linear-to-br from-brand-500 to-brand-600"
                        }`}>
                          {attendee.status === "checked-in" ? (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : attendee.status === "no-show" ? (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            getInitials(attendee.name)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900 dark:text-white">
                            {attendee.name}
                          </div>
                          <div className="truncate text-sm text-gray-500 dark:text-gray-400">
                            {attendee.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="rounded-lg bg-gray-100 px-2.5 py-1 font-mono text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {attendee.bookingId}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${
                          attendee.tokenBalance <= 2
                            ? "text-red-600 dark:text-red-400"
                            : attendee.tokenBalance <= 5
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {attendee.tokenBalance}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">left</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        attendee.status === "checked-in"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                          : attendee.status === "no-show"
                          ? "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20"
                          : "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
                      }`}>
                        {attendee.status === "checked-in" && (
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {attendee.status === "no-show" && (
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {attendee.status === "pending" && (
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {attendee.status === "checked-in" ? "Checked In" : attendee.status === "no-show" ? "No Show" : "Pending"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {attendee.checkedInAt ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {attendee.checkedInAt}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {attendee.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleCheckIn(attendee.bookingId)}
                              disabled={checkIn.isPending}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Check In
                            </button>
                            <button
                              onClick={() => handleMarkNoShow(attendee.bookingId)}
                              disabled={markNoShow.isPending}
                              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              No Show
                            </button>
                          </>
                        )}
                        {attendee.status !== "pending" && (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredAttendees.length === 0 && (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">No attendees found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? "Try adjusting your search criteria." : "No one has booked this class yet."}
              </p>
            </div>
          )}

          {/* Footer Stats */}
          {selectedSession.attendees.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/50">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Checked In: <span className="font-semibold text-gray-900 dark:text-white">{getSessionStats(selectedSession).checkedIn}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Pending: <span className="font-semibold text-gray-900 dark:text-white">{getSessionStats(selectedSession).pending}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">
                      No Shows: <span className="font-semibold text-gray-900 dark:text-white">{getSessionStats(selectedSession).noShows}</span>
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {filteredAttendees.length} of {selectedSession.attendees.length} attendees
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
