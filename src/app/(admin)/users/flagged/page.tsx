"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import { useFlaggedUsers, useUnflagUser, useInvalidateFlaggedUsers, type FlaggedUser } from "@/hooks/useFlaggedUsers";
import { useAuth } from "@/context/AuthContext";
import { RefreshCw } from "lucide-react";

// Skeleton Components
const StatCardSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
  </div>
);

const FlaggedUserCardSkeleton = () => (
  <div className="rounded-xl border-l-4 border-l-gray-300 border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div>
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
          <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
      <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
    </div>
    <div className="space-y-2 mb-4">
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    </div>
  </div>
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
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Show loading state with skeleton
  if (authLoading || loading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Flagged Users" />
        
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
            <div>
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
              <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          <div className="flex gap-2 animate-pulse">
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>

        {/* Search Skeleton */}
        <div className="mb-6 animate-pulse">
          <div className="h-10 w-full sm:w-80 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>

        {/* Flagged Users List Skeleton */}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <FlaggedUserCardSkeleton key={i} />)}
        </div>
        
        {isLoadingTakingTooLong && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Loading is taking longer than expected...</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
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
      <div>
        <PageBreadCrumb pageTitle="Flagged Users" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
            Failed to load flagged users
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {queryError instanceof Error ? queryError.message : "Unknown error occurred"}
          </p>
          <button
            onClick={handleRefresh}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalNoShows = users.reduce((sum, u) => sum + u.noShows, 0);
  const autoFlaggedCount = users.filter(u => u.flaggedBy?.includes("System") || u.flaggedBy === "System Auto-Flag").length;

  return (
    <div>
      <PageBreadCrumb pageTitle="Flagged Users" />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
              <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">{users.length}</div>
              <div className="text-sm text-red-600 dark:text-red-500">Flagged Users</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {totalNoShows}
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-500">Total No-Shows</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {autoFlaggedCount}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Auto-Flagged</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Flagged Users</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Users requiring attention due to policy violations or suspicious activity
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              {/* Search */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search flagged users..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 sm:w-72"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    User
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort("noShows")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    No-Shows
                    <SortIcon field="noShows" />
                  </button>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Flag Reason
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort("flaggedAt")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Flagged
                    <SortIcon field="flaggedAt" />
                  </button>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {paginatedUsers.map((user) => (
                <tr
                  key={user.id}
                  className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-sm font-semibold text-white">
                          {getInitials(user.name)}
                        </div>
                        <div className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900">
                          <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10l-4 4 4 4H6a3 3 0 01-3-3V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </div>
                        <div className="truncate text-sm text-gray-500 dark:text-gray-400">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        {user.noShows}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">/ {user.totalClasses} classes</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                        {user.flagReason}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        By: {user.flaggedBy}
                      </p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatDate(user.flaggedAt)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                      >
                        Unflag
                      </button>
                      <button
                        onClick={() => router.push(`/users/${user.id}`)}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
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
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No flagged users</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? "No users match your search." : "Great! No users are currently flagged."}
            </p>
          </div>
        )}

        {/* Pagination */}
        {sortedUsers.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500 dark:text-gray-400">per page</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {(currentPage - 1) * itemsPerPage + 1}
                </span>
                {" - "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {Math.min(currentPage * itemsPerPage, sortedUsers.length)}
                </span>
                {" of "}
                <span className="font-medium text-gray-900 dark:text-white">{sortedUsers.length}</span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[32px] rounded-lg px-2 py-1 text-sm font-medium ${
                      page === currentPage
                        ? "bg-brand-500 text-white"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
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
            {/* User Info */}
            <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-lg font-semibold text-white">
                  {getInitials(selectedUser.name)}
                </div>
                <div className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10l-4 4 4 4H6a3 3 0 01-3-3V6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{selectedUser.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{selectedUser.email}</div>
              </div>
            </div>

            {/* Current Flag Info */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300">Current Flag Reason</h4>
              <p className="mt-2 text-sm text-red-700 dark:text-red-400">{selectedUser.flagReason || "Account flagged for review"}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-red-600 dark:text-red-500">
                <span>Flagged by: {selectedUser.flaggedBy || "Admin"}</span>
                <span>On: {formatDate(selectedUser.flaggedAt || selectedUser.updatedAt || selectedUser.createdAt)}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedUser.noShows}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">No-Shows</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedUser.totalClasses}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Classes</div>
              </div>
            </div>

            {/* Unflag Reason */}
            <div>
              <Label htmlFor="unflagReason">Reason for Removing Flag</Label>
              <textarea
                id="unflagReason"
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                placeholder="e.g., User acknowledged issue, first-time offense warning given..."
                value={unflagReason}
                onChange={(e) => setUnflagReason(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUnflagReason("");
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUnflag}
                disabled={!unflagReason}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove Flag
              </button>
            </div>
          </div>
        )}
      </SlidePanel>
    </div>
  );
}
