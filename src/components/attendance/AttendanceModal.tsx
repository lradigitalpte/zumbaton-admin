"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase";

interface Attendee {
  id: string;
  name: string;
  avatar: string;
  checkedInAt: string;
}

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData: {
    id: string;
    name: string;
    instructor: string;
    time: string;
    enrolled: number;
    capacity: number;
    status?: string; // Add status to determine if class is completed
  };
}

// Demo attendees that "scan in"
const demoAttendees: Attendee[] = [
  { id: "1", name: "Sarah Johnson", avatar: "SJ", checkedInAt: "" },
  { id: "2", name: "Mike Chen", avatar: "MC", checkedInAt: "" },
  { id: "3", name: "Emily Rodriguez", avatar: "ER", checkedInAt: "" },
  { id: "4", name: "David Kim", avatar: "DK", checkedInAt: "" },
  { id: "5", name: "Lisa Wang", avatar: "LW", checkedInAt: "" },
  { id: "6", name: "James Brown", avatar: "JB", checkedInAt: "" },
  { id: "7", name: "Ana Martinez", avatar: "AM", checkedInAt: "" },
  { id: "8", name: "Tom Wilson", avatar: "TW", checkedInAt: "" },
];

interface AttendeeWithStatus extends Attendee {
  status?: 'attended' | 'no-show' | 'pending';
}

export default function AttendanceModal({ isOpen, onClose, classData }: AttendanceModalProps) {
  const [attendees, setAttendees] = useState<AttendeeWithStatus[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isCompleted = classData.status === 'completed';

  // Fetch real attendees for ALL classes (not just completed)
  useEffect(() => {
    if (!isOpen) {
      setAttendees([]);
      return;
    }

    let isMounted = true;

    // Fetch attendees from API
    const fetchAttendees = () => {
      setIsLoading(true);
      fetch(`/api/attendance/class/${classData.id}/attendees`)
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return;
          
          if (data.success && data.data?.attendees) {
            const formattedAttendees: AttendeeWithStatus[] = data.data.attendees.map((a: any) => ({
              id: a.id,
              name: a.name,
              avatar: a.avatar,
              checkedInAt: a.checkedInAt || '',
              status: a.checkedInAt ? 'attended' : 'no-show',
            }));
            setAttendees(formattedAttendees);
          } else {
            setAttendees([]);
          }
          setIsLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Error fetching attendees:', err);
          setAttendees([]);
          setIsLoading(false);
        });
    };

    // Initial fetch
    fetchAttendees();

    // Set up real-time subscription for new check-ins
    const supabase = getSupabaseClient();
    
    // Subscribe to attendances table - listen for new check-ins
    const attendancesChannel = supabase
      .channel(`attendance-modal:${classData.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendances",
        },
        async (payload) => {
          console.log("[AttendanceModal] New check-in:", payload);
          // Verify this attendance is for a booking in this class
          const { data: booking } = await supabase
            .from('bookings')
            .select('class_id')
            .eq('id', payload.new.booking_id)
            .single();
          
          if (booking?.class_id === classData.id) {
            fetchAttendees();
          }
        }
      )
      .subscribe();

    // Subscribe to bookings table for status changes
    const bookingsChannel = supabase
      .channel(`bookings-modal:${classData.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `class_id=eq.${classData.id}`,
        },
        (payload) => {
          // Only refetch if status changed to 'attended'
          if (payload.new.status === 'attended' && payload.old.status !== 'attended') {
            console.log("[AttendanceModal] Booking marked as attended:", payload);
            fetchAttendees();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(attendancesChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [isOpen, classData.id]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, isFullScreen, onClose]);

  if (!isOpen) return null;

  // Full screen mode for TV display
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white font-bold text-xl">
              Z
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{classData.name}</h1>
              <p className="text-gray-400">{classData.instructor} • {classData.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-emerald-500/20 px-4 py-2">
              <span className="text-lg font-semibold text-emerald-400">
                {isCompleted 
                  ? `${attendees.filter(a => a.status === 'attended' || a.checkedInAt).length} attended / ${attendees.length} enrolled`
                  : `${attendees.length} / ${classData.enrolled} checked in`
                }
              </span>
            </div>
            <button
              onClick={() => setIsFullScreen(false)}
              className="rounded-lg bg-gray-700 p-2 text-gray-300 hover:bg-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Attendees List - Full Width */}
          <div className="flex-1 bg-gray-800/50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Recent Check-ins
            </h3>
            <div className="space-y-3 overflow-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 h-16 w-16 rounded-full bg-gray-700 flex items-center justify-center animate-spin">
                    <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <p className="text-gray-400">Loading attendees...</p>
                </div>
              ) : attendees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 h-16 w-16 rounded-full bg-gray-700 flex items-center justify-center">
                    <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-400">{isCompleted ? 'No attendees found' : 'Waiting for check-ins...'}</p>
                  {!isCompleted && <p className="text-sm text-gray-500">Students will appear here when they scan</p>}
                </div>
              ) : (
                attendees.map((attendee, index) => {
                  const isAttended = attendee.status === 'attended' || attendee.checkedInAt;
                  return (
                    <div
                      key={attendee.id}
                      className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                        isAttended ? 'bg-gray-700/50' : 'bg-red-900/20 border border-red-800/50'
                      } ${index === 0 && !isCompleted ? "animate-pulse ring-2 ring-emerald-500/50" : ""}`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white ${
                        isAttended ? 'bg-gradient-to-br from-brand-400 to-brand-600' : 'bg-red-600'
                      }`}>
                        {attendee.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{attendee.name}</p>
                        <p className="text-xs text-gray-400">
                          {isAttended ? `Checked in at ${attendee.checkedInAt || 'N/A'}` : 'No-show'}
                        </p>
                      </div>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isAttended ? 'bg-emerald-500/20' : 'bg-red-500/20'
                      }`}>
                        {isAttended ? (
                          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-8 py-3 text-center">
          <p className="text-sm text-gray-500">
            Press <kbd className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">ESC</kbd> to exit full screen
          </p>
        </div>
      </div>
    );
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{classData.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {classData.instructor} • {classData.time}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isCompleted && (
              <button
                onClick={() => setIsFullScreen(true)}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Full Screen
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col">
          {/* Attendees - Full Width */}
          <div className="w-full border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">{isCompleted ? 'Attendance' : 'Check-ins'}</h3>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {isCompleted 
                    ? `${attendees.filter(a => a.status === 'attended' || a.checkedInAt).length} attended / ${attendees.length} enrolled`
                    : `${attendees.length} / ${classData.enrolled}`
                  }
                </span>
              </div>
            </div>
            <div className="max-h-80 overflow-auto p-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 animate-spin">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading attendees...</p>
                </div>
              ) : attendees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{isCompleted ? 'No attendees found' : 'Waiting for check-ins...'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attendees.map((attendee, index) => {
                    const isAttended = attendee.status === 'attended' || attendee.checkedInAt;
                    return (
                      <div
                        key={attendee.id}
                        className={`flex items-center gap-3 rounded-xl p-2 transition-all ${
                          isAttended
                            ? index === 0 && !isCompleted
                              ? "bg-emerald-50 dark:bg-emerald-900/20"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800"
                            : "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                        }`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium text-white ${
                          isAttended ? 'bg-gradient-to-br from-brand-400 to-brand-600' : 'bg-red-600'
                        }`}>
                          {attendee.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {attendee.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isAttended ? (attendee.checkedInAt || 'Checked in') : 'No-show'}
                          </p>
                        </div>
                        {isAttended ? (
                          <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isCompleted ? 'View attendance details for this completed class' : 'Students scan this code with their phone to check in'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
              {!isCompleted && (
                <button
                  onClick={() => setIsFullScreen(true)}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Open Full Screen
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
