"use client";

import { useState, useEffect, useCallback } from "react";

interface AttendeeRow {
  id: string;
  name: string;
  avatar: string;
  checkedInAt: string;
  status: "attended" | "no-show" | "pending";
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
    status?: string;
  };
}

export default function AttendanceModal({ isOpen, onClose, classData }: AttendanceModalProps) {
  const [list, setList] = useState<AttendeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isCompleted = classData.status === "completed";

  const fetchList = useCallback(() => {
    if (!classData.id) return;
    setIsLoading(true);
    fetch(`/api/attendance/class/${classData.id}/attendees`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.attendees) {
          const completed = classData.status === "completed";
          setList(
            data.data.attendees.map((a: { id: string; name: string; avatar?: string; checkedInAt?: string }) => ({
              id: a.id,
              name: a.name,
              avatar: a.avatar ?? (a.name ? a.name.split(/\s+/).map((n: string) => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2) : "?"),
              checkedInAt: a.checkedInAt || "",
              status: a.checkedInAt ? "attended" : (completed ? "no-show" : "pending"),
            }))
          );
        } else {
          setList([]);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setList([]);
        setIsLoading(false);
      });
  }, [classData.id, classData.status]);

  useEffect(() => {
    if (!isOpen) {
      setList([]);
      return;
    }
    fetchList();
  }, [isOpen, classData.id, fetchList]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const attendedCount = list.filter((r) => r.status === "attended").length;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative flex w-full max-w-lg flex-col max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 bg-gray-50/80 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/50">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              {classData.name}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {classData.instructor} · {classData.time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        {!isLoading && list.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Class list
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{attendedCount}</span>
              {" / "}
              <span className="font-medium text-gray-900 dark:text-white">{list.length}</span>
              {" checked in"}
            </span>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500 dark:border-gray-700 dark:border-t-emerald-500" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading class list…</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">No bookings</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No one has booked this class yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-800/50"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
                      row.status === "attended"
                        ? "bg-emerald-500"
                        : row.status === "no-show"
                          ? "bg-red-500"
                          : "bg-amber-500"
                    }`}
                  >
                    {row.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 dark:text-white">{row.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {row.status === "attended"
                        ? row.checkedInAt
                          ? `Checked in ${row.checkedInAt}`
                          : "Attended"
                        : row.status === "no-show"
                          ? "No-show"
                          : "Pending"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      row.status === "attended"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : row.status === "no-show"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {row.status === "attended" ? "Attended" : row.status === "no-show" ? "No-show" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
