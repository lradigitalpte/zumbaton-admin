"use client";

import { useState } from "react";
import Link from "next/link";
import Pagination from "@/components/tables/Pagination";
import StudioMenu from "@/components/ui/StudioMenu";
import { useAuth } from "@/context/AuthContext";
import {
  useAttendanceIssues,
  useResolveIssue,
  type AttendanceIssue,
  type IssueType,
  type IssueStatus,
} from "@/hooks/useAttendanceIssues";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const field = "h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white sm:w-80";
const pillOff = "rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:text-white";

export default function NoShowsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | IssueType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | IssueStatus>("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const [selectedIssue, setSelectedIssue] = useState<AttendanceIssue | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch issues from API
  const { data, isLoading, error, refetch } = useAttendanceIssues({
    type: typeFilter,
    status: statusFilter,
    dateRange,
    search: searchQuery,
    page: currentPage,
    limit: itemsPerPage,
  });

  const resolveIssue = useResolveIssue();

  const issues = data?.issues || [];

  // Export to CSV function
  const handleExportReport = () => {
    if (issues.length === 0) {
      alert('No data to export');
      return;
    }

    // Prepare CSV headers
    const headers = [
      'Member Name',
      'Email',
      'Phone',
      'Class Name',
      'Class Date',
      'Class Time',
      'Instructor',
      'Issue Type',
      'Status',
      'No-Show Count',
      'Token Refunded',
      'Penalty Applied',
      'Notes',
      'Created At',
      'Resolved At',
    ];

    // Convert issues to CSV rows
    const csvRows = [
      headers.join(','),
      ...issues.map(issue => [
        `"${issue.userName.replace(/"/g, '""')}"`,
        `"${issue.userEmail.replace(/"/g, '""')}"`,
        `"${(issue.userPhone || '').replace(/"/g, '""')}"`,
        `"${issue.className.replace(/"/g, '""')}"`,
        `"${issue.classDate}"`,
        `"${issue.classTime}"`,
        `"${issue.instructor.replace(/"/g, '""')}"`,
        `"${getIssueTypeLabel(issue.issueType)}"`,
        `"${issue.status}"`,
        issue.noShowCount.toString(),
        issue.tokenRefunded ? 'Yes' : 'No',
        issue.penaltyApplied ? 'Yes' : 'No',
        `"${(issue.notes || '').replace(/"/g, '""')}"`,
        `"${new Date(issue.createdAt).toLocaleString()}"`,
        issue.resolvedAt ? `"${new Date(issue.resolvedAt).toLocaleString()}"` : '',
      ].join(','))
    ];

    // Create CSV content
    const csvContent = csvRows.join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance-issues-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };
  const stats = data?.stats || {
    pending: 0,
    noShows: 0,
    lateCancels: 0,
    earlyCancels: 0,
    expired: 0,
    todayCount: 0,
  };
  const pagination = data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 };

  const getIssueTypeLabel = (type: IssueType) => {
    switch (type) {
      case "no-show": return "No Show";
      case "late-cancel": return "Late Cancel";
      case "early-cancel": return "Early Cancel";
      case "expired": return "Booking Expired";
    }
  };

  const getIssueTypeStyle = (type: IssueType) => {
    switch (type) {
      case "no-show":
        return "bg-neutral-950 text-[#E4F56C]";
      case "late-cancel":
        return "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-white";
      case "early-cancel":
        return "bg-[#E4F56C] text-neutral-950";
      case "expired":
        return "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/60";
    }
  };

  const getStatusStyle = (status: IssueStatus) => {
    switch (status) {
      case "pending":
        return "bg-neutral-950 text-[#E4F56C]";
      case "excused":
        return "bg-[#E4F56C] text-neutral-950";
      case "penalized":
        return "bg-red-50 text-red-600";
      case "resolved":
        return "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white";
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const handleAction = async (action: "excuse" | "penalize" | "resolve") => {
    if (!selectedIssue || !user?.id) return;

    try {
      await resolveIssue.mutateAsync({
        bookingId: selectedIssue.bookingId,
        action,
        notes: actionNotes,
        resolvedBy: user.id,
      });

      setSelectedIssue(null);
      setActionNotes("");
      setShowActionPanel(false);
    } catch (err) {
      console.error("Failed to resolve issue:", err);
      // Error will be handled by the mutation
    }
  };

  const openActionPanel = (issue: AttendanceIssue) => {
    setSelectedIssue(issue);
    setActionNotes(issue.notes);
    setShowActionPanel(true);
  };

  const when = (issue: AttendanceIssue) => {
    const date = issue.classDate
      ? new Date(`${issue.classDate}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "";
    return [date, issue.classTime].filter(Boolean).join(" · ");
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
        <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">Could not load issues</h3>
        <p className="mt-2 text-sm text-neutral-500">{error.message}</p>
        <button onClick={() => refetch()} className="mt-5 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">Try again</button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">Attendance issues</h1>
          <p className="mt-1 text-sm text-neutral-500">No-shows, cancellations, and bookings that still need a decision.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/attendance" className={pillOff}>Check-in</Link>
          <button onClick={handleExportReport} disabled={issues.length === 0} className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:opacity-50">Export</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { label: "Pending", value: stats.pending, tone: "bg-neutral-950 text-white" },
          { label: "No shows", value: stats.noShows, tone: "bg-[#E4F56C] text-neutral-950" },
          { label: "Late cancels", value: stats.lateCancels, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
          { label: "Early cancels", value: stats.earlyCancels, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
          { label: "Expired", value: stats.expired, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
          { label: "Today", value: stats.todayCount, tone: "bg-white text-neutral-950 dark:bg-gray-800 dark:text-white" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-[28px] border border-neutral-200/80 p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 ${stat.tone}`}>
            <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className={`${card} p-5`}>
        <div className="grid gap-3 lg:grid-cols-[180px_180px_180px_minmax(0,1fr)]">
          <StudioMenu
            value={typeFilter}
            onChange={(value) => { setTypeFilter(value as typeof typeFilter); setCurrentPage(1); }}
            placeholder="All types"
            options={[
              { value: "all", label: "All types" },
              { value: "no-show", label: "No shows" },
              { value: "late-cancel", label: "Late cancels" },
              { value: "early-cancel", label: "Early cancels" },
              { value: "expired", label: "Expired" },
            ]}
          />
          <StudioMenu
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value as typeof statusFilter); setCurrentPage(1); }}
            placeholder="All statuses"
            options={[
              { value: "all", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "excused", label: "Excused" },
              { value: "penalized", label: "Penalized" },
              { value: "resolved", label: "Resolved" },
            ]}
          />
          <StudioMenu
            value={dateRange}
            onChange={(value) => { setDateRange(value as typeof dateRange); setCurrentPage(1); }}
            placeholder="All time"
            options={[
              { value: "all", label: "All time" },
              { value: "today", label: "Today" },
              { value: "week", label: "Last 7 days" },
              { value: "month", label: "Last 30 days" },
            ]}
          />
          <input
            type="text"
            placeholder="Search name, email, or class"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className={field}
          />
        </div>

        <div className="mt-4 space-y-3">
          {issues.map((issue) => (
            <article key={issue.id} className="rounded-[22px] bg-neutral-50 p-4 dark:bg-white/5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-[#E4F56C]">
                    {getInitials(issue.userName).slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    {issue.userId ? (
                      <Link href={`/users/${issue.userId}`} className="block truncate font-semibold uppercase tracking-wide text-neutral-950 hover:underline dark:text-white">{issue.userName}</Link>
                    ) : (
                      <p className="truncate font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{issue.userName}</p>
                    )}
                    <p className="truncate text-sm text-neutral-500">{issue.userEmail || "No email"}</p>
                  </div>
                </div>
                <div className="min-w-0 lg:w-64">
                  <p className="truncate font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{issue.className}</p>
                  <p className="text-sm text-neutral-500">{when(issue)}{issue.instructor ? ` · ${issue.instructor}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getIssueTypeStyle(issue.issueType)}`}>{getIssueTypeLabel(issue.issueType)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${getStatusStyle(issue.status)}`}>{issue.status}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 dark:bg-gray-800 dark:text-white">{issue.noShowCount} no-shows</span>
                </div>
                {issue.status === "pending" ? (
                  <button onClick={() => openActionPanel(issue)} className="shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white">Review</button>
                ) : issue.userId ? (
                  <Link href={`/users/${issue.userId}`} className={`${pillOff} shrink-0`}>View member</Link>
                ) : null}
              </div>
            </article>
          ))}
          {issues.length === 0 && (
            <div className="rounded-[22px] px-6 py-12 text-center text-sm text-neutral-500">No issues match these filters.</div>
          )}
        </div>

        {pagination.totalPages > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
            <span className="text-neutral-500">Showing {(currentPage - 1) * pagination.limit + 1}–{Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total}</span>
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={(page) => {
                setCurrentPage(page);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        )}
      </div>

      {showActionPanel && selectedIssue && (
        <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-stretch sm:justify-end">
          <button type="button" aria-label="Close review" className="fixed inset-0 bg-neutral-950/55 backdrop-blur-[2px]" onClick={() => setShowActionPanel(false)} />
          <section className="relative flex h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-neutral-200/80 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800 sm:h-full sm:rounded-none sm:rounded-l-[28px]">
            <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Review</h2>
              <button type="button" onClick={() => setShowActionPanel(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-lg text-white" aria-label="Close">×</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="flex items-center gap-3 rounded-[22px] bg-neutral-950 p-4 text-white">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E4F56C] text-sm font-semibold text-neutral-950">{getInitials(selectedIssue.userName).slice(0, 3)}</div>
                <div className="min-w-0">
                  <p className="truncate font-semibold uppercase tracking-wide">{selectedIssue.userName}</p>
                  <p className="truncate text-sm text-white/60">{selectedIssue.userEmail || "No email"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-white/5"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Type</p><p className="mt-1 font-semibold text-neutral-950 dark:text-white">{getIssueTypeLabel(selectedIssue.issueType)}</p></div>
                <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-white/5"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Class</p><p className="mt-1 font-semibold text-neutral-950 dark:text-white">{selectedIssue.className}</p></div>
                <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-white/5"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">When</p><p className="mt-1 font-semibold text-neutral-950 dark:text-white">{when(selectedIssue)}</p></div>
                <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-white/5"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">No-shows</p><p className="mt-1 font-semibold text-neutral-950 dark:text-white">{selectedIssue.noShowCount}</p></div>
              </div>
              {selectedIssue.noShowCount >= 3 && (
                <p className="rounded-[22px] bg-[#E4F56C] px-4 py-3 text-sm font-medium text-neutral-950">This member has {selectedIssue.noShowCount} no-shows. Consider flagging the account.</p>
              )}
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Notes</span>
                <textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={4} placeholder="What did you decide?" className="mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </label>
            </div>
            <div className="space-y-2 px-6 pb-6">
              <button onClick={() => handleAction("excuse")} disabled={resolveIssue.isPending} className="w-full rounded-full bg-[#E4F56C] py-3 text-sm font-semibold text-neutral-950 disabled:opacity-50">Excuse and refund token</button>
              <button onClick={() => handleAction("penalize")} disabled={resolveIssue.isPending} className="w-full rounded-full bg-neutral-950 py-3 text-sm font-semibold text-white disabled:opacity-50">Penalize, no refund</button>
              <button onClick={() => handleAction("resolve")} disabled={resolveIssue.isPending} className="w-full rounded-full border border-neutral-200 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-50 dark:border-white/10 dark:text-white">Resolve without action</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
