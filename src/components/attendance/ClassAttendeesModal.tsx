"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";

// Read-only list of who is booked into a class. There is no QR check-in:
// bookings are marked attended automatically after class, and staff record
// no-shows from the Attendance page.

interface ClassInfo {
  id: string;
  name: string;
  type: string;
  time: string;
  duration: number;
  room: string;
  date: string;
  enrolled: number;
  capacity: number;
}

interface Attendee {
  id: string;
  name: string;
  checkedInAt: string;
  avatar?: string;
}

interface ClassAttendeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: ClassInfo;
  realAttendees?: Attendee[];
  realEnrolled?: number;
  onRefresh?: () => void; // Manual refresh callback
}

export default function ClassAttendeesModal({
  isOpen,
  onClose,
  classInfo,
  realAttendees,
  realEnrolled,
  onRefresh,
}: ClassAttendeesModalProps) {
  const [internalAttendees, setInternalAttendees] = useState<Attendee[]>([]);
  const [internalEnrolled, setInternalEnrolled] = useState<number | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchInternalAttendees = useCallback(async () => {
    const response = await api.get<any>(`/api/attendance/class/${classInfo.id}/attendees`, {
      cache: "no-store",
    });

    const result = response.data;
    if (response.error || !result?.success) {
      throw new Error(result?.error?.message || "Failed to fetch attendees");
    }

    const attendees = Array.isArray(result?.data?.attendees) ? result.data.attendees : [];
    const enrolledFromApi = result?.data?.class?.enrolled;

    setInternalAttendees(attendees);
    setInternalEnrolled(typeof enrolledFromApi === "number" ? enrolledFromApi : undefined);
  }, [classInfo.id]);

  // If parent doesn't supply realAttendees, fetch them here
  useEffect(() => {
    if (!isOpen) return;
    if (realAttendees !== undefined && realAttendees !== null) return;

    fetchInternalAttendees().catch(() => {
      // Leave the list empty; callers may not have access to the class
    });
  }, [isOpen, realAttendees, fetchInternalAttendees]);

  const attendees = useMemo(
    () => (realAttendees !== undefined && realAttendees !== null ? realAttendees : internalAttendees),
    [realAttendees, internalAttendees]
  );
  const enrolled = realEnrolled ?? internalEnrolled ?? classInfo.enrolled;
  const attendedCount = attendees.filter((a) => a.checkedInAt).length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        onRefresh();
      } else {
        await fetchInternalAttendees();
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{classInfo.type[0]}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{classInfo.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{classInfo.time} • {classInfo.room}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Refresh"
            >
              <svg className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{enrolled || attendees.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Booked</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{attendedCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Marked attended</p>
          </div>
        </div>

        {/* Attendee List */}
        <div className="p-4 overflow-y-auto max-h-[400px] space-y-2">
          {attendees.length === 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">No bookings for this class yet.</p>
          )}
          {attendees.map((attendee) => (
            <div
              key={attendee.id}
              className={`flex items-center justify-between p-3 rounded-xl ${
                attendee.checkedInAt ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-gray-50 dark:bg-gray-700/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    attendee.checkedInAt
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                  }`}
                >
                  {attendee.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <p className="font-medium text-gray-900 dark:text-white">{attendee.name}</p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {attendee.checkedInAt ? "Attended" : "Booked"}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bookings are marked attended automatically after class. Record no-shows from the Attendance page.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
