"use client";

import { useState } from "react";
import StudioMenu from "@/components/ui/StudioMenu";
import StudioDate from "@/components/ui/StudioDate";
import Pagination from "@/components/tables/Pagination";
import { useAuditReport, AuditLog } from "@/hooks/useReports";
import { useAuth } from "@/context/AuthContext";
import { isRoleAtLeast } from "@/services/rbac.service";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const metric = "flex min-h-[168px] flex-col rounded-[28px] p-5 sm:p-6";
const field = "h-9 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-gray-800 dark:text-white";

const actionFilters = [
  { value: "all", label: "All actions" },
  { value: "create", label: "Creates" },
  { value: "update", label: "Updates" },
  { value: "delete", label: "Deletes and cancels" },
  { value: "adjust", label: "Token adjustments" },
  { value: "payment", label: "Payments" },
  { value: "attendance", label: "Check-in and no-show" },
];

const resourceFilters = [
  { value: "all", label: "All resources" },
  { value: "user", label: "Users" },
  { value: "class", label: "Classes" },
  { value: "booking", label: "Bookings" },
  { value: "package", label: "Packages" },
  { value: "token", label: "Tokens" },
  { value: "payment", label: "Payments" },
];

const hiddenKeys = new Set(["updated_at", "created_at", "updatedAt", "createdAt", "password", "filters"]);

function formatAction(action: string) {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actionTone(action: string) {
  if (/create|activate|succeeded|check_in/.test(action)) return "bg-[#E4F56C] text-neutral-950";
  if (/delete|cancel|deactivat|suspend|no_show/.test(action)) return "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300";
  if (/update|edit|adjust|sync/.test(action)) return "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950";
  return "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white";
}

function preview(value: unknown) {
  if (value == null || value === "") return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 90 ? `${text.slice(0, 87)}…` : text;
  }
  return String(value);
}

function changeRows(log: AuditLog) {
  const previous = log.oldValues || {};
  const next = log.newValues || {};
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter((key) => !hiddenKeys.has(key));
  return keys.flatMap((key) => {
    const from = previous[key];
    const to = key in next ? next[key] : undefined;
    if (JSON.stringify(from) === JSON.stringify(to)) return [];
    return [{
      key,
      from: key in previous ? preview(from) : null,
      to: key in next ? preview(to) : null,
    }];
  });
}

function formatWhen(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AuditsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [scope, setScope] = useState<"changes" | "all">("changes");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const hasAccess = user && isRoleAtLeast(user.role, "admin");
  const { data, isLoading, isFetching, error } = useAuditReport({
    action: actionFilter !== "all" ? actionFilter : undefined,
    resourceType: resourceTypeFilter !== "all" ? resourceTypeFilter : undefined,
    search: searchQuery || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    scope,
    page: currentPage,
    pageSize: 50,
  });

  if (!hasAccess) {
    return (
      <div className={`${card} px-6 py-10 text-center`}>
        <h1 className="text-xl font-semibold text-neutral-950 dark:text-white">Audits</h1>
        <p className="mt-2 text-sm text-neutral-500">Only administrators can view the audit trail.</p>
      </div>
    );
  }

  const logs = data?.logs || [];
  const stats = data?.stats;
  const showInitialLoading = isLoading && !data;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Audits</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Changes to people, classes, bookings, packages, tokens, and payments. Times are Singapore.
            {isFetching && !isLoading ? " Updating…" : ""}
          </p>
        </div>
        <div className="flex rounded-full bg-neutral-100 p-1 dark:bg-white/10">
          {(["changes", "all"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setScope(item);
                setCurrentPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${scope === item ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "text-neutral-500"}`}
            >
              {item === "changes" ? "Changes" : "All activity"}
            </button>
          ))}
        </div>
      </div>

      {showInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className={`${metric} animate-pulse border border-neutral-200/80 bg-white dark:border-white/10 dark:bg-gray-800`} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${metric} border border-[#d5e45c] bg-[#E4F56C] text-neutral-950`}>
            <p className="text-sm font-medium">Changes</p>
            <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{(stats?.totalLogs ?? 0).toLocaleString()}</p>
            <p className="mt-2 text-xs text-neutral-950/60">{(stats?.hiddenReads ?? 0).toLocaleString()} list views are hidden</p>
          </div>
          <div className={`${metric} border border-neutral-950 bg-neutral-950 text-white`}>
            <p className="text-sm font-medium text-white/70">Today</p>
            <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{(stats?.todayLogs ?? 0).toLocaleString()}</p>
            <p className="mt-2 text-xs text-white/50">Changes since midnight, Singapore time</p>
          </div>
          <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
            <p className="text-sm font-medium text-neutral-600 dark:text-white/70">People</p>
            <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{(stats?.uniqueUsers ?? 0).toLocaleString()}</p>
            <p className="mt-2 text-xs text-neutral-400">Staff who made a change</p>
          </div>
          <div className={`${metric} border border-neutral-200/80 bg-white text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 dark:text-white`}>
            <p className="text-sm font-medium text-neutral-600 dark:text-white/70">Action types</p>
            <p className="mt-5 text-4xl font-semibold leading-none tracking-tight">{(stats?.uniqueActions ?? 0).toLocaleString()}</p>
            <p className="mt-2 text-xs text-neutral-400">{stats?.uniqueResources ?? 0} resources touched</p>
          </div>
        </div>
      )}

      <section className={`${card} p-5 sm:p-6`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            type="search"
            value={searchQuery}
            placeholder="Search name, email, or action"
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
            className={field}
          />
          <StudioMenu
            size="sm"
            value={actionFilter}
            onChange={(value) => {
              setActionFilter(value);
              setCurrentPage(1);
            }}
            placeholder="Action"
            options={actionFilters}
          />
          <StudioMenu
            size="sm"
            value={resourceTypeFilter}
            onChange={(value) => {
              setResourceTypeFilter(value);
              setCurrentPage(1);
            }}
            placeholder="Resource"
            options={resourceFilters}
          />
          <StudioDate
            block
            clearable
            ariaLabel="Start date"
            placeholder="From"
            value={startDate}
            onChange={(value) => {
              setStartDate(value);
              setCurrentPage(1);
            }}
          />
          <StudioDate
            block
            clearable
            ariaLabel="End date"
            placeholder="To"
            value={endDate}
            onChange={(value) => {
              setEndDate(value);
              setCurrentPage(1);
            }}
          />
        </div>
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Who</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">What changed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
              {showInitialLoading ? (
                [0, 1, 2, 3, 4].map((item) => (
                  <tr key={item}>
                    <td colSpan={4} className="px-5 py-4"><div className="h-4 w-full animate-pulse rounded bg-neutral-100 dark:bg-white/10" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-red-600">{error instanceof Error ? error.message : "Could not load audits"}</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-neutral-500">
                    {scope === "changes" ? "No changes in this view. List views stay under All activity." : "No audit rows match these filters."}
                  </td>
                </tr>
              ) : logs.map((log) => {
                const rows = changeRows(log);
                const open = openId === log.id;
                return (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600 dark:text-white/70">{formatWhen(log.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-neutral-950 dark:text-white">{log.userName}</p>
                      {log.userEmail && <p className="text-xs text-neutral-500">{log.userEmail}</p>}
                      {log.userRole && <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400">{log.userRole.replace(/_/g, " ")}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionTone(log.action)}`}>{formatAction(log.action)}</span>
                      <p className="mt-1 text-xs text-neutral-500">{log.resourceType.replace(/_/g, " ")}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {rows.length === 0 ? (
                        <p className="text-neutral-400">No field changes stored</p>
                      ) : (
                        <div>
                          <div className="space-y-1">
                            {(open ? rows : rows.slice(0, 2)).map((row) => (
                              <p key={row.key} className="text-neutral-700 dark:text-white/80">
                                <span className="font-medium text-neutral-950 dark:text-white">{row.key.replace(/_/g, " ")}</span>
                                {row.from != null && <span className="text-neutral-400"> {row.from}</span>}
                                <span className="text-neutral-400"> → </span>
                                <span>{row.to ?? "removed"}</span>
                              </p>
                            ))}
                          </div>
                          {rows.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setOpenId(open ? null : log.id)}
                              className="mt-2 text-xs font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-2 dark:text-white"
                            >
                              {open ? "Show less" : `${rows.length - 2} more fields`}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {data && data.total > 50 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(data.total / 50)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <section className={`${card} px-5 py-5 sm:px-6`}>
        <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">What gets recorded</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-neutral-500">
          <li>Creates, updates, cancels, check-ins, no-shows, token changes, and payments are kept.</li>
          <li>Opening the users list no longer writes a row. Older list views are under All activity.</li>
          <li>A change shows the previous value and the new value when both were stored.</li>
        </ul>
      </section>
    </div>
  );
}
