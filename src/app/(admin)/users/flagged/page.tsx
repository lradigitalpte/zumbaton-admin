"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import { useFlaggedUsers, useUnflagUser, useInvalidateFlaggedUsers, type FlaggedUser } from "@/hooks/useFlaggedUsers";
import { useAuth } from "@/context/AuthContext";
import { RefreshCw } from "lucide-react";

// Skeleton Components
const StatCardSkeleton = () => (
  <div className="h-[132px] animate-pulse rounded-[28px] bg-neutral-200 dark:bg-white/10" />
);

const LOADING_TIMEOUT = 15000; // 15 seconds

// Helper to compute flag reason from user stats
function computeFlagReason(user: FlaggedUser): { reason: string; flaggedBy: string } {
  const noShowRate = user.totalClasses > 0 ? (user.noShows / user.totalClasses) * 100 : 0;
  
  if (noShowRate >= 100) {
    return {
      reason: "100% no-show rate. Account under review for potential fraud.",
      flaggedBy: "System Auto-Flag"
    };
  }
  
  if (noShowRate >= 50) {
    return {
      reason: `High no-show rate (${Math.round(noShowRate)}%). Zero attendance rate despite bookings.`,
      flaggedBy: "System Auto-Flag"
    };
  }
  
  if (user.noShows >= 5) {
    return {
      reason: `Excessive no-shows (${user.noShows} in total). Multiple warnings may be needed.`,
      flaggedBy: "System Auto-Flag"
    };
  }
  
  return {
    reason: "Account flagged for review. Policy violation or suspicious activity detected.",
    flaggedBy: "Admin"
  };
}

// Demo data removed - now fetching from API

type SortField = "name" | "noShows" | "flaggedAt";
type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

export default function FlaggedUsersPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("flaggedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Loading timeout state
  const [isLoadingTakingTooLong, setIsLoadingTakingTooLong] = useState(false);
  
  // Unflag panel
  const [selectedUser, setSelectedUser] = useState<FlaggedUser | null>(null);
  const [unflagReason, setUnflagReason] = useState("");
  const [unflagError, setUnflagError] = useState<string | null>(null);

  // Fetch flagged users with React Query caching
  const { data: usersData, isLoading: loading, error: queryError, refetch } = useFlaggedUsers({
    search: searchQuery || undefined,
  });
  
  const { invalidate } = useInvalidateFlaggedUsers();
  const unflagMutation = useUnflagUser();
  
  // Loading timeout effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    
    if (loading) {
      setIsLoadingTakingTooLong(false);
      timeoutId = setTimeout(() => {
        setIsLoadingTakingTooLong(true);
      }, LOADING_TIMEOUT);
    } else {
      setIsLoadingTakingTooLong(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading]);

  // Map API users to FlaggedUser with computed flag reasons
  const users: FlaggedUser[] = useMemo(() => {
    if (!usersData?.users) return [];
    
    return usersData.users.map((user) => {
      const { reason, flaggedBy } = computeFlagReason(user as FlaggedUser);
      return {
        ...user,
        flagReason: reason,
        flaggedBy,
        flaggedAt: user.updatedAt || user.createdAt, // Use updatedAt as flagged date
      };
    });
  }, [usersData]);

  // Filter & Sort
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.flagReason?.toLowerCase().includes(query)
      );
    });
  }, [users, searchQuery]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "noShows":
          comparison = a.noShows - b.noShows;
          break;
        case "flaggedAt":
          comparison = new Date(a.flaggedAt || a.updatedAt || a.createdAt).getTime() - 
                      new Date(b.flaggedAt || b.updatedAt || b.createdAt).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredUsers, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedUsers.slice(start, start + itemsPerPage);
  }, [sortedUsers, currentPage, itemsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleUnflag = async () => {
    if (!selectedUser || !unflagReason.trim()) return;
    
    setUnflagError(null);
    
    try {
      await unflagMutation.mutateAsync({
        userId: selectedUser.id,
        reason: unflagReason,
      });
      
      // Close panel and reset
      setSelectedUser(null);
      setUnflagReason("");
      
      // Refresh data
      invalidate();
      refetch();
    } catch (error) {
      setUnflagError(error instanceof Error ? error.message : "Failed to unflag user");
    }
  };

  const handleRefresh = () => {
    setIsLoadingTakingTooLong(false);
    invalidate();
    refetch();
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="h-3.5 w-3.5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg className="h-3.5 w-3.5 text-neutral-950 dark:text-[#E4F56C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-3.5 w-3.5 text-neutral-950 dark:text-[#E4F56C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Show loading state with skeleton
  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-full bg-neutral-200 dark:bg-white/10" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="h-64 animate-pulse rounded-[28px] bg-neutral-200 dark:bg-white/10" />
        {isLoadingTakingTooLong && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="mb-3 text-sm text-neutral-500">Loading is taking longer than expected...</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show error state
  if (queryError && !authLoading) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <p className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
          Failed to load flagged users
        </p>
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {queryError instanceof Error ? queryError.message : "Unknown error occurred"}
        </p>
        <button
          onClick={handleRefresh}
          className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Try Again
        </button>
      </div>
    );
  }

  const totalNoShows = users.reduce((sum, u) => sum + u.noShows, 0);
  const autoFlaggedCount = users.filter(u => u.flaggedBy?.includes("System") || u.flaggedBy === "System Auto-Flag").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
            Flagged{" "}
            <span className="inline-flex h-7 w-9 translate-y-[-1px] items-center justify-center rounded-full bg-[#E4F56C] align-middle text-neutral-950">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21V4h11l-1.5 4L14 12H3" />
              </svg>
            </span>
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
            Users requiring attention due to policy violations or suspicious activity
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-5 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">Flagged Users</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-[#E4F56C]">{users.length}</p>
        </div>
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Total No-Shows</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">{totalNoShows}</p>
        </div>
        <div className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-5 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-950/60">Auto-Flagged</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{autoFlaggedCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
        <div className="px-5 py-4 sm:px-6">
          <div className="relative max-w-md">
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search flagged users..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="h-12 w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-11 pr-4 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-neutral-200/80 dark:border-white/10">
                {([
                  ["name", "User"],
                  ["noShows", "No-Shows"],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th key={field} className="whitespace-nowrap px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort(field)}
                      className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400 hover:text-neutral-950 dark:hover:text-white"
                    >
                      {label}
                      <SortIcon field={field} />
                    </button>
                  </th>
                ))}
                <th className="whitespace-nowrap px-6 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                  Flag Reason
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort("flaggedAt")}
                    className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400 hover:text-neutral-950 dark:hover:text-white"
                  >
                    Flagged
                    <SortIcon field="flaggedAt" />
                  </button>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="border-b border-neutral-100 last:border-0 dark:border-white/5">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
                        {getInitials(user.name).slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
                          {user.name}
                        </div>
                        <div className="truncate text-sm text-neutral-500 dark:text-white/50">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-baseline gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
                        {user.noShows}
                      </span>
                      <span className="text-xs text-neutral-400">of {user.totalClasses}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <p className="line-clamp-2 text-sm text-neutral-950 dark:text-white">
                        {user.flagReason}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {user.flaggedBy}
                      </p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-500 dark:text-white/50">
                    {formatDate(user.flaggedAt)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="rounded-full bg-[#E4F56C] px-3.5 py-2 text-xs font-semibold text-neutral-950 hover:bg-[#d5e45c]"
                      >
                        Unflag
                      </button>
                      <button
                        onClick={() => router.push(`/users/${user.id}`)}
                        className="rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {paginatedUsers.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E4F56C] text-neutral-950">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">No flagged users</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {searchQuery ? "No users match your search." : "Great! No users are currently flagged."}
            </p>
          </div>
        )}

        {/* Pagination */}
        {sortedUsers.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-neutral-200/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Show</span>
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setItemsPerPage(option); setCurrentPage(1); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    itemsPerPage === option
                      ? "bg-neutral-950 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-neutral-400">
                {((currentPage - 1) * itemsPerPage + 1)}–{Math.min(currentPage * itemsPerPage, sortedUsers.length)} of {sortedUsers.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-white/10"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-8 rounded-full px-2 py-1 text-sm font-semibold ${
                      page === currentPage
                        ? "bg-neutral-950 text-white"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-white/70 dark:hover:bg-white/10"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-white/10"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unflag Panel */}
      <SlidePanel
        isOpen={!!selectedUser}
        onClose={() => {
          setSelectedUser(null);
          setUnflagReason("");
        }}
        title="Remove Flag"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
                {getInitials(selectedUser.name).slice(0, 2)}
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{selectedUser.name}</div>
                <div className="text-sm text-neutral-500 dark:text-white/50">{selectedUser.email}</div>
              </div>
            </div>

            <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">Current flag</p>
              <p className="mt-2 text-sm text-white">{selectedUser.flagReason || "Account flagged for review"}</p>
              <p className="mt-3 text-xs text-[#E4F56C]">
                {selectedUser.flaggedBy || "Admin"} · {formatDate(selectedUser.flaggedAt || selectedUser.updatedAt || selectedUser.createdAt)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[22px] bg-[#E4F56C] p-4 text-neutral-950">
                <div className="text-3xl font-semibold tracking-tight">{selectedUser.noShows}</div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-950/60">No-Shows</div>
              </div>
              <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">{selectedUser.totalClasses}</div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Classes</div>
              </div>
            </div>

            {unflagError && (
              <div className="rounded-[22px] border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {unflagError}
              </div>
            )}

            <div>
              <Label htmlFor="unflagReason">Reason for Removing Flag</Label>
              <textarea
                id="unflagReason"
                rows={3}
                className="mt-1.5 w-full rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="e.g., User acknowledged issue, first-time offense warning given..."
                value={unflagReason}
                onChange={(e) => setUnflagReason(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUnflagReason("");
                  setUnflagError(null);
                }}
                className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleUnflag}
                disabled={!unflagReason || unflagMutation.isPending}
                className="flex-1 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {unflagMutation.isPending ? "Removing..." : "Remove Flag"}
              </button>
            </div>
          </div>
        )}
      </SlidePanel>
    </div>
  );
}
