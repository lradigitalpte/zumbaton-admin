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
    <div className="fixed inset-0 z-[100000] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close attendees" className="fixed inset-0 bg-neutral-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-neutral-200/80 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800 sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Attendance</p>
            <h2 className="mt-1 text-2xl font-semibold uppercase tracking-tight text-neutral-950 dark:text-white">{classInfo.name}</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">{classInfo.time} · {classInfo.room}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-[#E4F56C] dark:bg-white/10 dark:text-white"
              title="Refresh"
            >
              <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mx-6 mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-[22px] bg-neutral-950 px-4 py-3 text-white">
            <p className="text-3xl font-semibold leading-none">{enrolled || attendees.length}</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">Booked</p>
          </div>
          <div className="rounded-[22px] bg-[#E4F56C] px-4 py-3 text-neutral-950">
            <p className="text-3xl font-semibold leading-none">{attendedCount}</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-950/50">Attended</p>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 pb-4">
          {attendees.length === 0 && (
            <p className="py-8 text-center text-sm text-neutral-500">No bookings for this class yet.</p>
          )}
          {attendees.map((attendee) => (
            <div
              key={attendee.id}
              className="flex items-center justify-between rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-3 py-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
                  attendee.checkedInAt ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-950 text-[#E4F56C]"
                }`}>
                  {attendee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <p className="font-medium text-neutral-950 dark:text-white">{attendee.name}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                attendee.checkedInAt ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-950 text-white"
              }`}>
                {attendee.checkedInAt ? "Attended" : "Booked"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-5">
          <p className="text-xs text-neutral-400">
            Attendance is marked after class. No-shows are recorded on the Attendance page.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
