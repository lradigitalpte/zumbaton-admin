"use client";

import { useState, useMemo } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Input from "@/components/form/input/InputField";
import { useAuditReport, AuditLog } from "@/hooks/useReports";
import { useAuth } from "@/context/AuthContext";
import { isRoleAtLeast } from "@/services/rbac.service";
import Pagination from "@/components/tables/Pagination";

const actionFilters = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
  { value: "adjust", label: "Adjust" },
  { value: "flag", label: "Flag" },
  { value: "unflag", label: "Unflag" },
  { value: "suspend", label: "Suspend" },
  { value: "activate", label: "Activate" },
  { value: "reset_password", label: "Reset Password" },
];

const resourceTypeFilters = [
  { value: "all", label: "All Resources" },
  { value: "user", label: "User" },
  { value: "package", label: "Package" },
  { value: "class", label: "Class" },
  { value: "booking", label: "Booking" },
  { value: "token", label: "Token" },
  { value: "payment", label: "Payment" },
  { value: "notification", label: "Notification" },
];

const getActionColor = (action: string) => {
  if (action.includes("create") || action.includes("activate")) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30";
  if (action.includes("delete") || action.includes("suspend")) return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30";
  if (action.includes("update") || action.includes("edit") || action.includes("adjust")) return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30";
  if (action.includes("view")) return "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30";
  return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30";
};

const formatAction = (action: string) => {
  return action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function AuditsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Check if user has access
  const hasAccess = user && isRoleAtLeast(user.role, "admin");

  const { data, isLoading, error } = useAuditReport({
    action: actionFilter !== "all" ? actionFilter : undefined,
    resourceType: resourceTypeFilter !== "all" ? resourceTypeFilter : undefined,
    search: searchQuery || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page: currentPage,
    pageSize: 50,
  });

  const logs = data?.logs || [];
  const stats = {
    totalLogs: data?.stats?.totalLogs ?? 0,
    todayLogs: data?.stats?.todayLogs ?? 0,
    uniqueUsers: data?.stats?.uniqueUsers ?? 0,
    uniqueActions: data?.stats?.uniqueActions ?? 0,
    uniqueResources: data?.stats?.uniqueResources ?? 0,
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatJson = (obj: Record<string, unknown> | null) => {
    if (!obj) return null;
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  // Check if any log has IP address
  const hasIpAddresses = useMemo(() => {
    return logs.some((log) => log.ipAddress);
  }, [logs]);

  // Check if any log has changes
  const hasChanges = useMemo(() => {
    return logs.some((log) => log.oldValues || log.newValues);
  }, [logs]);

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Audit Logs" />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Access Denied</h2>
          <p className="mt-2 text-red-500 dark:text-red-400">
            Only administrators can view audit logs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Audit Logs" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Comprehensive system activity audit trail
              {isLoading && <span className="ml-2 text-blue-500">(Loading...)</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
              <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-700 mb-3" />
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
              <div className="h-8 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Logs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalLogs.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.todayLogs.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Unique Users</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.uniqueUsers.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
                <svg className="h-6 w-6 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Actions</p>
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stats.uniqueActions.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Resources</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.uniqueResources.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
            <Input
              type="text"
              placeholder="Search users, actions, resources..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {actionFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Resource Type</label>
            <select
              value={resourceTypeFilter}
              onChange={(e) => {
                setResourceTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {resourceTypeFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Resource</th>
                {hasChanges && (
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Changes</th>
                )}
                {hasIpAddresses && (
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">IP Address</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </td>
                    {hasChanges && (
                      <td className="px-6 py-4">
                        <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      </td>
                    )}
                    {hasIpAddresses && (
                      <td className="px-6 py-4">
                        <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      </td>
                    )}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={hasChanges && hasIpAddresses ? 6 : hasChanges || hasIpAddresses ? 5 : 4} className="px-6 py-8 text-center text-red-600 dark:text-red-400">
                    {error instanceof Error ? error.message : "Failed to load audit logs"}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={hasChanges && hasIpAddresses ? 6 : hasChanges || hasIpAddresses ? 5 : 4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{log.userName}</div>
                        {log.userEmail && (
                          <div className="text-gray-500 dark:text-gray-400">{log.userEmail}</div>
                        )}
                        {log.userRole && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{log.userRole}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{log.resourceType}</div>
                        {log.resourceId && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{log.resourceId.substring(0, 8)}...</div>
                        )}
                      </div>
                    </td>
                    {hasChanges && (
                      <td className="px-6 py-4 text-sm">
                        {(log.oldValues || log.newValues) ? (
                          <details className="cursor-pointer group">
                            <summary className="text-blue-600 dark:text-blue-400 hover:underline text-xs">
                              View Details
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs font-mono max-h-60 overflow-auto border border-gray-200 dark:border-gray-700">
                              {log.oldValues && (
                                <div className="mb-3">
                                  <div className="text-red-600 dark:text-red-400 font-semibold mb-1 text-xs">Previous Values:</div>
                                  <pre className="whitespace-pre-wrap text-xs bg-white dark:bg-gray-800 p-2 rounded">{formatJson(log.oldValues)}</pre>
                                </div>
                              )}
                              {log.newValues && (
                                <div>
                                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1 text-xs">New Values:</div>
                                  <pre className="whitespace-pre-wrap text-xs bg-white dark:bg-gray-800 p-2 rounded">{formatJson(log.newValues)}</pre>
                                </div>
                              )}
                            </div>
                          </details>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    )}
                    {hasIpAddresses && (
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {log.ipAddress || "-"}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(data.total / 50)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
