"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import { useAuth } from "@/context/AuthContext";
import {
  useAttendanceIssues,
  useResolveIssue,
  type AttendanceIssue,
  type IssueType,
  type IssueStatus,
} from "@/hooks/useAttendanceIssues";

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
        return "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20";
      case "late-cancel":
        return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20";
      case "early-cancel":
        return "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20";
      case "expired":
        return "bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20";
    }
  };

  const getStatusStyle = (status: IssueStatus) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20";
      case "excused":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20";
      case "penalized":
        return "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20";
      case "resolved":
        return "bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20";
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading attendance issues...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
          <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Failed to load issues</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Attendance Issues" />

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-red-500 to-red-600 text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Issues</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage no-shows, cancellations, and expired bookings</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/attendance"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Check-In Station
          </Link>
          <button 
            onClick={handleExportReport}
            disabled={issues.length === 0}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Pending Review</div>
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
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.noShows}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">No Shows</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.lateCancels}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Late Cancels</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.earlyCancels}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Early Cancels</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.expired}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Expired</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-500/20">
              <svg className="h-5 w-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">{stats.todayCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        {/* Filters */}
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value as typeof typeFilter); setCurrentPage(1); }}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="no-show">No Shows</option>
                <option value="late-cancel">Late Cancellations</option>
                <option value="early-cancel">Early Cancellations</option>
                <option value="expired">Expired Bookings</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setCurrentPage(1); }}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="excused">Excused</option>
                <option value="penalized">Penalized</option>
                <option value="resolved">Resolved</option>
              </select>

              {/* Date Range */}
              <select
                value={dateRange}
                onChange={(e) => { setDateRange(e.target.value as typeof dateRange); setCurrentPage(1); }}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or class..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 sm:w-80"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Member
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Class
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Issue Type
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  No-Show Count
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {issues.map((issue) => (
                <tr
                  key={issue.id}
                  className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-sm font-semibold text-white">
                        {getInitials(issue.userName)}
                      </div>
                      <div className="min-w-0">
                        <Link 
                          href={`/users/${issue.userId}`}
                          className="truncate font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
                        >
                          {issue.userName}
                        </Link>
                        <div className="truncate text-sm text-gray-500 dark:text-gray-400">
                          {issue.userEmail}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{issue.className}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(issue.classDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {issue.classTime}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getIssueTypeStyle(issue.issueType)}`}>
                      {getIssueTypeLabel(issue.issueType)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getStatusStyle(issue.status)}`}>
                      {issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                      issue.noShowCount >= 3 
                        ? "text-red-600 dark:text-red-400" 
                        : issue.noShowCount >= 2 
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}>
                      {issue.noShowCount >= 3 && (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      {issue.noShowCount}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {issue.status === "pending" ? (
                        <>
                          <button
                            onClick={() => openActionPanel(issue)}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                          >
                            Review
                          </button>
                        </>
                      ) : (
                        <Link
                          href={`/users/${issue.userId}`}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          View User
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {issues.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No issues found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No attendance issues match your current filters.
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(currentPage - 1) * pagination.limit + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={(page) => {
                setCurrentPage(page);
                // Scroll to top of table when page changes
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </div>

      {/* Action Panel (Side Panel) */}
      {showActionPanel && selectedIssue && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
            onClick={() => setShowActionPanel(false)}
          />
          
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review Issue</h2>
              <button
                onClick={() => setShowActionPanel(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Member Info */}
                <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-lg font-semibold text-white">
                    {getInitials(selectedIssue.userName)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{selectedIssue.userName}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{selectedIssue.userEmail}</div>
                  </div>
                </div>

                {/* Issue Details */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Issue Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Type</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getIssueTypeStyle(selectedIssue.issueType)}`}>
                          {getIssueTypeLabel(selectedIssue.issueType)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Class</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedIssue.className}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Date & Time</span>
                        <span className="text-gray-900 dark:text-white">
                          {new Date(selectedIssue.classDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {selectedIssue.classTime}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Instructor</span>
                        <span className="text-gray-900 dark:text-white">{selectedIssue.instructor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Warning for repeat offenders */}
                  {selectedIssue.noShowCount >= 3 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                      <div className="flex items-start gap-3">
                        <svg className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <div className="font-medium text-red-800 dark:text-red-200">Repeat Offender</div>
                          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                            This member has {selectedIssue.noShowCount} no-shows on record. Consider flagging their account.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Member Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
                      <div className={`text-2xl font-bold ${selectedIssue.noShowCount >= 3 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                        {selectedIssue.noShowCount}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total No-Shows</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedIssue.tokenRefunded ? "Yes" : "No"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Token Refunded</div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Resolution Notes
                    </label>
                    <textarea
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                      placeholder="Add notes about this resolution..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 p-6 dark:border-gray-800">
              <div className="space-y-3">
                <button
                  onClick={() => handleAction("excuse")}
                  disabled={resolveIssue.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resolveIssue.isPending ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  Excuse & Refund Token
                </button>
                <button
                  onClick={() => handleAction("penalize")}
                  disabled={resolveIssue.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resolveIssue.isPending ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  Mark as Penalized (No Refund)
                </button>
                <button
                  onClick={() => handleAction("resolve")}
                  disabled={resolveIssue.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {resolveIssue.isPending ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
                  ) : null}
                  Resolve Without Action
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
