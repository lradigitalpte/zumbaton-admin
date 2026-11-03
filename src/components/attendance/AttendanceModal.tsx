"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

interface AttendeeRow {
  id: string;
  userId: string | null;
  isGuest: boolean;
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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<AttendeeRow | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const fetchList = useCallback(() => {
    if (!classData.id) return;
    setIsLoading(true);
    api.get<any>(`/api/attendance/class/${classData.id}/attendees`)
      .then(({ data }) => {
        if (data?.success && data.data?.attendees) {
          const completed = classData.status === "completed";
          setList(
            data.data.attendees.map((a: { id: string; userId?: string | null; isGuest?: boolean; name: string; avatar?: string; checkedInAt?: string }) => ({
              id: a.id,
              userId: a.userId ?? null,
              isGuest: a.isGuest ?? !a.userId,
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

  const cancelAndRefund = async (row: AttendeeRow) => {
    if (!row.userId) return;

    setCancellingId(row.id);
    setNotice(null);
    const response = await api.delete(`/api/bookings/${row.id}`, {
      userId: row.userId,
      forceRefund: true,
      reason: 'Same-day booking is not allowed. Your booking has been cancelled and your token has been fully refunded. We apologize for the inconvenience.',
    });
    setCancellingId(null);
    setPendingCancel(null);

    if (response.error) {
      setNotice({ tone: "error", text: response.error.message || "Failed to cancel the booking" });
      return;
    }

    setList((current) => current.filter((item) => item.id !== row.id));
    setNotice({ tone: "ok", text: "Booking cancelled, tokens refunded, and the email was sent." });
  };

  const attendedCount = list.filter((r) => r.status === "attended").length;

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close attendance" className="absolute inset-0 bg-neutral-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-neutral-200/80 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800 sm:rounded-[28px]">
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Attendance</p>
            <h2 className="mt-1 text-2xl font-semibold uppercase tracking-tight text-neutral-950 dark:text-white">
              {classData.name}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
              {classData.instructor} · {classData.time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!isLoading && list.length > 0 && (
          <div className="mx-6 mb-3 flex items-center justify-between rounded-full bg-neutral-950 px-4 py-2 text-white">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">Checked in</span>
            <span className="text-sm font-semibold">
              <span className="text-[#E4F56C]">{attendedCount}</span>
              <span className="text-white/40"> / {list.length}</span>
            </span>
          </div>
        )}

        {notice && (
          <div className={`mx-6 mb-3 rounded-full px-4 py-2 text-center text-xs font-medium ${notice.tone === "ok" ? "bg-[#E4F56C] text-neutral-950" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"}`}>
            {notice.text}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950 dark:border-white/10 dark:border-t-[#E4F56C]" />
              <p className="mt-3 text-sm text-neutral-500">Loading the list</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-[#E4F56C]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-950 dark:text-white">No bookings</p>
              <p className="mt-1 text-sm text-neutral-500">Nobody has booked this class yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-3 py-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    row.status === "attended"
                      ? "bg-[#E4F56C] text-neutral-950"
                      : row.status === "no-show"
                        ? "bg-neutral-200 text-neutral-500 dark:bg-white/10 dark:text-white/40"
                        : "bg-neutral-950 text-[#E4F56C]"
                  }`}>
                    {row.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-950 dark:text-white">{row.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-white/45">
                      {row.status === "attended"
                        ? row.checkedInAt
                          ? `Checked in ${row.checkedInAt}`
                          : "Attended"
                        : row.status === "no-show"
                          ? "No-show"
                          : "Waiting"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    row.status === "attended"
                      ? "bg-[#E4F56C] text-neutral-950"
                      : row.status === "no-show"
                        ? "bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-white/60"
                        : "bg-neutral-950 text-white"
                  }`}>
                    {row.status === "attended" ? "Attended" : row.status === "no-show" ? "No-show" : "Pending"}
                  </span>
                  {row.status === "pending" && !row.isGuest && row.userId && (
                    <button
                      type="button"
                      onClick={() => setPendingCancel(row)}
                      disabled={cancellingId === row.id}
                      className="shrink-0 rounded-full bg-neutral-950 px-3 py-2 text-[11px] font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cancellingId === row.id ? "Cancelling" : "Refund"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-neutral-950 py-3 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
          >
            Close
          </button>
        </div>

        {pendingCancel && (
          <div className="absolute inset-0 z-10 flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center">
            <div className="w-full rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:bg-gray-900">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Refund</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Cancel this booking</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-white/60">
                <span className="font-semibold text-neutral-950 dark:text-white">{pendingCancel.name}</span> will be removed, their tokens refunded, and a cancellation email sent.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingCancel(null)}
                  disabled={cancellingId === pendingCancel.id}
                  className="flex-1 rounded-full border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-50 dark:border-white/10 dark:text-white"
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  onClick={() => cancelAndRefund(pendingCancel)}
                  disabled={cancellingId === pendingCancel.id}
                  className="flex-1 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {cancellingId === pendingCancel.id ? "Cancelling" : "Refund tokens"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
