"use client";

import { useEffect, useState, useMemo } from "react";
import StudioDate from "@/components/ui/StudioDate";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  useAttendance,
  useCheckIn,
  useBulkCheckIn,
  useMarkNoShow,
  type ClassSession,
} from "@/hooks/useAttendance";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const pillOff = "rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white";
const field = "h-12 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white";

function todayYMD(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(() => todayYMD());
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "checked-in" | "no-show">("all");
  const [showQuickCheckIn, setShowQuickCheckIn] = useState(false);
  const [quickCheckInId, setQuickCheckInId] = useState("");

  const isViewingToday = selectedDate === todayYMD();
  const isViewingPast = selectedDate < todayYMD();

  // API hooks – pass selected date so we can roll back to past days
  const { data, isLoading, error, refetch } = useAttendance(selectedDate);
  const checkIn = useCheckIn();
  const bulkCheckIn = useBulkCheckIn();
  const markNoShow = useMarkNoShow();

  // Deduplicate classes by ID (in case API returns duplicates)
  const sessions = useMemo(() => {
    const classes = data?.classes || [];
    const seen = new Set<string>();
    return classes.filter((session) => {
      if (seen.has(session.id)) {
        return false;
      }
      seen.add(session.id);
      return true;
    });
  }, [data?.classes]);
  const todayStats = data?.stats || {
    totalClasses: 0,
    totalBookings: 0,
    checkedIn: 0,
    pending: 0,
    noShows: 0,
  };

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSession(null);
      return;
    }
    setSelectedSession((current) => {
      if (!current) return sessions[0];
      return sessions.find((session) => session.id === current.id) ?? sessions[0];
    });
  }, [sessions]);

  const currentTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore" });
  const viewingDateFormatted = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Singapore" });

  const handleCheckIn = async (bookingId: string) => {
    if (!user?.id) return;
    
    try {
      await checkIn.mutateAsync({
        bookingId,
        checkedInBy: user.id,
        method: 'admin',
      });
      showToast('Check-in successful!', 'success');
    } catch (err) {
      console.error('Check-in failed:', err);
      showToast('Failed to check in. Please try again.', 'error');
    }
  };

  const handleMarkNoShow = async (bookingId: string) => {
    if (!user?.id) return;
    
    try {
      await markNoShow.mutateAsync({
        bookingId,
        markedBy: user.id,
      });
      showToast('Marked as no-show', 'success');
    } catch (err) {
      console.error('Mark no-show failed:', err);
      showToast('Failed to mark as no-show. Please try again.', 'error');
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
      showToast(`Checked in ${pendingBookingIds.length} attendee(s)`, 'success');
    } catch (err) {
      console.error('Bulk check-in failed:', err);
      showToast('Failed to bulk check in. Please try again.', 'error');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${card} flex flex-col items-center justify-center px-6 py-20 text-center`}>
        <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">Could not load attendance</h3>
        <p className="mt-2 text-sm text-neutral-500">{error.message}</p>
        <button onClick={() => refetch()} className="mt-5 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">Check-In</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <span>{isViewingToday ? `${viewingDateFormatted} · ${currentTime}` : viewingDateFormatted}</span>
            {isViewingPast && <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-semibold text-[#E4F56C]">Past day · read only</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StudioDate id="attendance-date" ariaLabel="View date" value={selectedDate} onChange={setSelectedDate} />
          {!isViewingToday && (
            <button type="button" onClick={() => setSelectedDate(todayYMD())} className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c]">
              Today
            </button>
          )}
          <button
            onClick={() => isViewingToday && setShowQuickCheckIn(!showQuickCheckIn)}
            disabled={!isViewingToday}
            className={showQuickCheckIn ? "rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-[#E4F56C] disabled:opacity-50" : pillOff}
          >
            Quick Check-In
          </button>
          <button onClick={() => refetch()} className={pillOff}>Refresh</button>
        </div>
      </div>

      {showQuickCheckIn && (
        <div className="rounded-[28px] bg-neutral-950 p-5 text-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E4F56C]">Booking ID or email</span>
              <input
                type="text"
                value={quickCheckInId}
                onChange={(e) => setQuickCheckInId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickCheckIn()}
                placeholder="Paste a booking ID or type an email"
                className="mt-1.5 h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:border-[#E4F56C] focus:outline-none"
                autoFocus
              />
            </label>
            <button onClick={handleQuickCheckIn} className="h-12 rounded-full bg-[#E4F56C] px-6 text-sm font-semibold text-neutral-950">Check in</button>
            <button onClick={() => setShowQuickCheckIn(false)} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg" aria-label="Close quick check-in">×</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: isViewingToday ? "Classes today" : "Classes", value: todayStats.totalClasses, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
          { label: "Bookings", value: todayStats.totalBookings, tone: "bg-neutral-950 text-white" },
          { label: "Checked in", value: todayStats.checkedIn, tone: "bg-[#E4F56C] text-neutral-950" },
          { label: "Pending", value: todayStats.pending, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
          { label: "No shows", value: todayStats.noShows, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-[28px] border border-neutral-200/80 p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 ${stat.tone}`}>
            <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">{stat.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-neutral-950 dark:text-white">
          {isViewingToday ? "Today's classes" : `Classes on ${viewingDateFormatted}`}
        </h2>
        {sessions.length === 0 ? (
          <div className={`${card} p-12 text-center text-sm text-neutral-500`}>No classes on this day.</div>
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sessions.map((session) => {
            const stats = getSessionStats(session);
            const isSelected = selectedSession?.id === session.id;
            const isPast = parseInt(session.endTime.replace(":", "")) < parseInt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ""));
            const isActive = isViewingToday && !isPast && parseInt(session.time.replace(":", "")) <= parseInt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ""));
            const fill = session.capacity > 0 ? Math.min(100, Math.round((stats.total / session.capacity) * 100)) : 0;

            return (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`relative rounded-[28px] border p-5 text-left ${
                  isSelected
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800"
                }`}
              >
                {isActive && <span className="absolute right-5 top-5 h-2.5 w-2.5 rounded-full bg-[#E4F56C]" />}
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isSelected ? "bg-[#E4F56C] text-neutral-950" : isPast ? "bg-neutral-100 text-neutral-400" : "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-white"}`}>
                  {session.time} – {session.endTime}
                </span>
                <h3 className={`mt-3 text-lg font-semibold uppercase tracking-wide ${isSelected ? "text-white" : "text-neutral-950 dark:text-white"}`}>
                  {session.className}
                </h3>
                <p className={`mt-1 text-sm ${isSelected ? "text-white/60" : "text-neutral-500"}`}>
                  {session.instructor} · {session.room}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div>
                    <p className={`text-lg font-semibold ${isSelected ? "text-[#E4F56C]" : "text-neutral-950 dark:text-white"}`}>{stats.checkedIn}</p>
                    <p className={`text-[10px] font-medium uppercase tracking-[0.14em] ${isSelected ? "text-white/45" : "text-neutral-400"}`}>In</p>
                  </div>
                  <div>
                    <p className={`text-lg font-semibold ${isSelected ? "text-white" : "text-neutral-950 dark:text-white"}`}>{stats.pending}</p>
                    <p className={`text-[10px] font-medium uppercase tracking-[0.14em] ${isSelected ? "text-white/45" : "text-neutral-400"}`}>Waiting</p>
                  </div>
                  <div>
                    <p className={`text-lg font-semibold ${isSelected ? "text-white" : "text-neutral-950 dark:text-white"}`}>{stats.noShows}</p>
                    <p className={`text-[10px] font-medium uppercase tracking-[0.14em] ${isSelected ? "text-white/45" : "text-neutral-400"}`}>No show</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className={`mb-1 flex justify-between text-[11px] ${isSelected ? "text-white/50" : "text-neutral-400"}`}>
                    <span>Booked</span>
                    <span>{stats.total}/{session.capacity}</span>
                  </div>
                  <div className={`h-1.5 overflow-hidden rounded-full ${isSelected ? "bg-white/10" : "bg-neutral-100 dark:bg-white/10"}`}>
                    <div className={`h-full rounded-full ${isSelected ? "bg-[#E4F56C]" : "bg-neutral-950 dark:bg-[#E4F56C]"}`} style={{ width: `${fill}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {selectedSession && (
        <div className={`${card} p-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{selectedSession.className}</h2>
              <p className="mt-1 text-sm text-neutral-500">{selectedSession.time} – {selectedSession.endTime} · {selectedSession.instructor} · {selectedSession.room}</p>
            </div>
            {isViewingToday && selectedSession.attendees.some((a) => a.status === "pending") && (
              <button
                onClick={handleBulkCheckIn}
                disabled={bulkCheckIn.isPending}
                className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-50"
              >
                {bulkCheckIn.isPending ? "Checking in…" : `Check in all (${selectedSession.attendees.filter((a) => a.status === "pending").length})`}
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "checked-in", "no-show"] as const).map((status) => {
                const count = status === "all"
                  ? selectedSession.attendees.length
                  : selectedSession.attendees.filter((a) => a.status === status).length;
                const label = status === "all" ? "All" : status === "checked-in" ? "Checked in" : status === "no-show" ? "No show" : "Pending";
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-3.5 py-2 text-xs font-semibold ${statusFilter === status ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"}`}
                  >
                    {label} {count}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Search name, email, or booking ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${field} w-full lg:w-80`}
            />
          </div>

          <div className="mt-4 space-y-3">
            {filteredAttendees.map((attendee) => (
              <article key={attendee.id} className="rounded-[22px] bg-neutral-50 p-4 dark:bg-white/5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {attendee.avatarUrl ? (
                      <img src={attendee.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-[#E4F56C]">
                        {getInitials(attendee.name).slice(0, 3)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{attendee.name}</p>
                      <p className="truncate text-sm text-neutral-500">{attendee.email}</p>
                      <p className="truncate font-mono text-[11px] text-neutral-400">{attendee.bookingId}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 lg:w-[360px]">
                    <div className="rounded-2xl bg-white px-3 py-2 dark:bg-gray-800">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Tokens</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{attendee.tokenBalance}<span className="text-xs font-medium text-neutral-400"> left</span></p>
                    </div>
                    <div className={`rounded-2xl px-3 py-2 ${attendee.status === "checked-in" ? "bg-[#E4F56C] text-neutral-950" : attendee.status === "no-show" ? "bg-neutral-200 text-neutral-600" : "bg-neutral-950 text-[#E4F56C]"}`}>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-60">Status</p>
                      <p className="mt-1 text-sm font-semibold">{attendee.status === "checked-in" ? "In" : attendee.status === "no-show" ? "No show" : "Waiting"}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2 dark:bg-gray-800">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Time</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{attendee.checkedInAt || "—"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {attendee.status === "pending" && !isViewingPast && (
                      <>
                        <button onClick={() => handleCheckIn(attendee.bookingId)} disabled={checkIn.isPending} className="rounded-full bg-[#E4F56C] px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50">Check in</button>
                        <button onClick={() => handleMarkNoShow(attendee.bookingId)} disabled={markNoShow.isPending} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">No show</button>
                      </>
                    )}
                    {attendee.status === "pending" && isViewingPast && <span className="text-sm text-neutral-400">Read only</span>}
                  </div>
                </div>
              </article>
            ))}
            {filteredAttendees.length === 0 && (
              <div className="rounded-[22px] bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500 dark:bg-white/5">
                {searchQuery ? "No one matches that search." : "No one has booked this class yet."}
              </div>
            )}
          </div>

          {selectedSession.attendees.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500">
              <span>In {getSessionStats(selectedSession).checkedIn} · Waiting {getSessionStats(selectedSession).pending} · No show {getSessionStats(selectedSession).noShows}</span>
              <span>Showing {filteredAttendees.length} of {selectedSession.attendees.length}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
