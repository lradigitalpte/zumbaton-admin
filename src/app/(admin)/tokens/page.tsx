"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Input from "@/components/form/input/InputField";
import { useTokenTransactions, TokenTransaction, TransactionType } from "@/hooks/useTokenTransactions";
import { useTokenPackageExpiry, useTokenPackageExpiryCounts, PackageExpiryItem } from "@/hooks/useTokenPackageExpiry";
import { usePendingPayments, useSyncPayment, useDeletePendingPayment, PendingPayment } from "@/hooks/usePendingPayments";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type PageTab = "payments" | "transactions" | "active_bookings" | "expiring_soon" | "expired";

const pageTabs: { value: PageTab; label: string }[] = [
  { value: "payments", label: "Payments" },
  { value: "transactions", label: "Token Activity" },
  { value: "active_bookings", label: "Bookings" },
  { value: "expiring_soon", label: "Expiring in 7 Days" },
  { value: "expired", label: "Expired Tokens" },
];

// Map API transaction types to display types
type DisplayTransactionType = "purchase" | "hold" | "consume" | "release" | "adjustment" | "expire" | "trial";

const mapTransactionType = (apiType: TransactionType): DisplayTransactionType => {
  const typeMap: Record<TransactionType, DisplayTransactionType> = {
    'purchase': 'purchase',
    'booking-hold': 'hold',
    'booking-release': 'release',
    'attendance-consume': 'consume',
    'no-show-consume': 'consume',
    'late-cancel-consume': 'consume',
    'admin-adjust': 'adjustment',
    'refund': 'release',
    'expire': 'expire',
    'trial-booking-purchase': 'trial',
  };
  return typeMap[apiType] || 'adjustment';
};

// Map display filter to API types
const getApiTypeFilter = (displayType: string): string | undefined => {
  if (displayType === 'all') return undefined;
  
  // For display types that map to multiple API types, we filter client-side
  const typeMap: Record<string, string> = {
    'purchase': 'purchase',
    'trial': 'trial-booking-purchase',
    'hold': 'booking-hold',
    'release': 'booking-release',
    'consume': 'attendance-consume', // API will return all, we filter client-side
    'adjustment': 'admin-adjust',
    'expire': 'expire',
  };
  return typeMap[displayType];
};

const typeConfig: Record<DisplayTransactionType, { label: string; color: string; bg: string; icon: string }> = {
  purchase: { 
    label: "Purchase", 
    color: "text-emerald-600 dark:text-emerald-400", 
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    icon: "↗"
  },
  hold: { 
    label: "Hold", 
    color: "text-amber-600 dark:text-amber-400", 
    bg: "bg-amber-50 dark:bg-amber-900/30",
    icon: "⏸"
  },
  consume: { 
    label: "Consume", 
    color: "text-blue-600 dark:text-blue-400", 
    bg: "bg-blue-50 dark:bg-blue-900/30",
    icon: "✓"
  },
  release: { 
    label: "Release", 
    color: "text-cyan-600 dark:text-cyan-400", 
    bg: "bg-cyan-50 dark:bg-cyan-900/30",
    icon: "↩"
  },
  adjustment: { 
    label: "Adjustment", 
    color: "text-purple-600 dark:text-purple-400", 
    bg: "bg-purple-50 dark:bg-purple-900/30",
    icon: "⚙"
  },
  expire: { 
    label: "Expire", 
    color: "text-red-600 dark:text-red-400", 
    bg: "bg-red-50 dark:bg-red-900/30",
    icon: "✕"
  },
  trial: {
    label: "Trial",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/30",
    icon: "★"
  },
};

const typeFilters: { value: string; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "purchase", label: "Purchase" },
  { value: "trial", label: "Trial" },
  { value: "hold", label: "Hold" },
  { value: "consume", label: "Consume" },
  { value: "release", label: "Release" },
  { value: "adjustment", label: "Adjustment" },
  { value: "expire", label: "Expire" },
];

// Extended type for display with mapped type
interface DisplayTransaction extends Omit<TokenTransaction, 'type'> {
  type: TransactionType;
  displayType: DisplayTransactionType;
}

interface ActiveBooking {
  id: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  classTitle: string;
  classStartsAt: string | null;
  location: string | null;
  status: string;
  tokensUsed: number;
  bookedAt: string;
}

interface PaymentLedgerItem {
  id: string; createdAt: string; status: string; amount: number; currency: string; provider: string;
  customerName: string; customerEmail: string; flowType: string; needsScheduling: boolean;
  className: string; classAt: string | null; bookingStatus: string;
}

export default function TokenTransactionsPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("payments");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expiryPage, setExpiryPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expiryItemsPerPage, setExpiryItemsPerPage] = useState(10);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const [selectedTransaction, setSelectedTransaction] = useState<DisplayTransaction | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<PendingPayment | null>(null);
  const [deletingFromModal, setDeletingFromModal] = useState(false);
  const [isProcessingExpired, setIsProcessingExpired] = useState(false);

  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: activeBookingsData, isLoading: activeBookingsLoading, error: activeBookingsError } = useQuery({
    queryKey: ["bookings", searchQuery, dateRange, currentPage, itemsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(currentPage), pageSize: String(itemsPerPage) });
      if (searchQuery) params.set("search", searchQuery);
      if (dateRange !== "all") {
        const now = new Date();
        const start = dateRange === "today"
          ? new Date(`${now.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })}T00:00:00+08:00`)
          : new Date(now.getTime() - (dateRange === "week" ? 7 : 30) * 24 * 60 * 60 * 1000);
        params.set("startDate", start.toISOString());
        params.set("endDate", now.toISOString());
      }
      const response = await api.get<{ success: boolean; data: { bookings: ActiveBooking[]; total: number } }>(`/api/bookings/active?${params}`);
      if (response.error) throw new Error(response.error.message || "Failed to load active bookings");
      return response.data?.data;
    },
    enabled: activeTab === "active_bookings",
  });

  const { data: paymentsData, isLoading: paymentsLoading, error: paymentsError } = useQuery({
    queryKey: ["payment-ledger", dateRange, currentPage, itemsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(currentPage), pageSize: String(itemsPerPage) });
      if (dateParams.startDate) params.set("startDate", dateParams.startDate);
      if (dateParams.endDate) params.set("endDate", dateParams.endDate);
      const response = await api.get<{ success: boolean; data: { payments: PaymentLedgerItem[]; total: number } }>(`/api/payments/ledger?${params}`);
      if (response.error) throw new Error(response.error.message || "Failed to load payments");
      return response.data?.data;
    },
    enabled: activeTab === "payments",
  });

  // Pending payments
  const { data: pendingPayments = [], isLoading: pendingLoading, refetch: refetchPending } = usePendingPayments();
  const { syncPayment, syncingIds, syncResults } = useSyncPayment();
  const { deletePendingPayment, deletingIds, deleteResults } = useDeletePendingPayment();

  // Calculate date range params for API
  const dateParams = useMemo(() => {
    if (dateRange === "all") return {};
    const now = new Date();
    const endDate = now.toISOString();
    let startDate: string;
    
    if (dateRange === "today") {
      const singaporeDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
      startDate = new Date(`${singaporeDate}T00:00:00+08:00`).toISOString();
    } else if (dateRange === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    
    return { startDate, endDate };
  }, [dateRange]);

  const expiryFilter = activeTab === "expired" ? "expired" : "expiring_soon";

  // Fetch transactions from API
  const { data, isLoading, error, isFetching: transactionsFetching } = useTokenTransactions({
    type: getApiTypeFilter(typeFilter),
    startDate: dateParams.startDate,
    endDate: dateParams.endDate,
    search: searchQuery || undefined,
    page: currentPage,
    pageSize: itemsPerPage,
    enabled: activeTab === "transactions",
  });

  const { data: expiryCountsData, refetch: refetchExpiryCounts } = useTokenPackageExpiryCounts();

  const {
    data: expiryData,
    isLoading: expiryLoading,
    error: expiryError,
    isFetching: expiryFetching,
  } = useTokenPackageExpiry({
    filter: expiryFilter,
    search: searchQuery || undefined,
    page: expiryPage,
    pageSize: expiryItemsPerPage,
    enabled: activeTab === "expiring_soon" || activeTab === "expired",
  });

  // Map transactions for display
  const displayTransactions: DisplayTransaction[] = useMemo(() => {
    if (!data?.transactions) return [];
    return data.transactions.map(tx => ({
      ...tx,
      displayType: mapTransactionType(tx.type),
    }));
  }, [data?.transactions]);

  // Client-side filter for consume types (which map to multiple API types)
  const filteredTransactions = useMemo(() => {
    if (typeFilter === "consume") {
      return displayTransactions.filter(tx => tx.displayType === "consume");
    }
    if (typeFilter === "release") {
      return displayTransactions.filter(tx => tx.displayType === "release");
    }
    return displayTransactions;
  }, [displayTransactions, typeFilter]);

  // Get stats from API response
  const stats = data?.stats || {
    totalPurchased: 0,
    totalConsumed: 0,
    totalExpired: 0,
    totalAdjusted: 0,
    totalReleased: 0,
    todayTransactions: 0,
  };

  // Pagination info
  const totalPages = Math.ceil((data?.total || 0) / itemsPerPage);
  const activeBookingTotalPages = Math.ceil((activeBookingsData?.total || 0) / itemsPerPage);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Singapore",
    });
  };

  const formatSgtDateTime = (dateStr: string) => new Date(dateStr).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
      "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500"
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const expiryItems = expiryData?.items ?? [];
  const expiryTotalPages = expiryData?.totalPages ?? 0;
  const expiryListTotal = expiryData?.total ?? 0;

  // Tab badges: counts endpoint, but when viewing a tab use list total (handles search + stays in sync)
  const expiryCounts = {
    expiringSoon:
      activeTab === "expiring_soon" && !searchQuery
        ? expiryListTotal
        : (expiryCountsData?.expiringSoon ?? 0),
    expired:
      activeTab === "expired" && !searchQuery
        ? expiryListTotal
        : (expiryCountsData?.expired ?? 0),
  };

  const switchTab = (tab: PageTab) => {
    setActiveTab(tab);
    setSearchQuery("");
    setCurrentPage(1);
    setExpiryPage(1);
    refetchExpiryCounts();
  };

  const runExpiryCleanup = async () => {
    setIsProcessingExpired(true);
    try {
      const response = await api.post<{
        success: boolean;
        message?: string;
        data?: { expired: number; tokensLost: number };
      }>("/api/tokens/process-expired", {});

      if (response.error) {
        showToast(response.error.message || "Failed to mark expired packages", "error");
        return;
      }

      showToast(
        response.data?.message || "Expired packages updated",
        "success"
      );

      await queryClient.invalidateQueries({ queryKey: ["token-package-expiry"] });
      await queryClient.invalidateQueries({ queryKey: ["token-package-expiry-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["token-transactions"] });
      refetchExpiryCounts();
    } catch {
      showToast("Failed to mark expired packages", "error");
    } finally {
      setIsProcessingExpired(false);
    }
  };

  const formatExpiryDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Singapore",
    });
  };

  const renderExpiryRow = (item: PackageExpiryItem) => (
    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {item.userAvatar ? (
            <img src={item.userAvatar} alt={item.userName} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${getAvatarColor(item.userName)} text-white text-sm font-semibold`}>
              {getInitials(item.userName)}
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900 dark:text-white text-sm">{item.userName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.userEmail}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.packageName}</td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 font-semibold text-gray-900 dark:text-white">
          {item.availableTokens}
          {item.tokensHeld > 0 && (
            <span className="text-xs font-normal text-amber-600 dark:text-amber-400">({item.tokensHeld} held)</span>
          )}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-900 dark:text-white whitespace-nowrap">{formatExpiryDate(item.expiresAt)}</span>
      </td>
      <td className="px-4 py-3">
        {activeTab === "expiring_soon" ? (
          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
            item.daysUntilExpiry <= 1
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : item.daysUntilExpiry <= 4
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
          }`}>
            {item.daysUntilExpiry <= 0
              ? "Expires today"
              : item.daysUntilExpiry === 1
                ? "Expires tomorrow"
                : `${item.daysUntilExpiry} days left`}
          </span>
        ) : (
          <span className="inline-flex flex-col items-start gap-1">
            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
              item.isProcessed
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}>
              {item.isProcessed
                ? "Expired (cleared)"
                : item.daysSinceExpiry === 0
                  ? "Expired yesterday"
                  : `${item.daysSinceExpiry} day${item.daysSinceExpiry === 1 ? "" : "s"} ago`}
            </span>
            {!item.isProcessed && item.stillHasTokens && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                Still active in DB — cron not run yet
              </span>
            )}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <Link
          href={`/users/${item.userId}`}
          className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
        >
          View user
        </Link>
      </td>
    </tr>
  );

  const renderPagination = (
    page: number,
    totalPages: number,
    total: number,
    perPage: number,
    onPageChange: (p: number) => void,
    onPerPageChange: (n: number) => void,
    label: string
  ) => (
    <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>Show</span>
        <select
          value={perPage}
          onChange={(e) => {
            onPerPageChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
        >
          {[5, 10, 20, 50].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>of {total} {label}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1 px-2">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`min-w-8 rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                  page === pageNum
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || totalPages === 0}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages || totalPages === 0}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Payments & Activity" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payments & Activity</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              See who paid, payment status, bookings, and token activity
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Report
        </button>
        {pendingPayments.length > 0 && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
              {pendingPayments.length}
            </span>
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Pending Payment{pendingPayments.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Pending Payments Section */}
      {(pendingPayments.length > 0 || pendingLoading) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-amber-700">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Pending Payments — paid on HitPay but not yet confirmed in system?
              </h3>
            </div>
            <button
              onClick={() => refetchPending()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {pendingLoading ? (
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"></div>
              <span className="text-sm text-amber-700 dark:text-amber-400">Checking pending payments…</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-amber-200 dark:border-amber-700">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">User</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Package</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">HitPay ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Created</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 dark:divide-amber-800/30">
                  {pendingPayments.map((pp) => {
                    const isSyncing = syncingIds.has(pp.id);
                    const isDeleting = deletingIds.has(pp.id);
                    const result = syncResults[pp.id];
                    const deleteResult = deleteResults[pp.id];
                    const amount = (pp.amountCents / 100).toFixed(2);
                    const hasDiscount = pp.discountPercent > 0;
                    return (
                      <tr key={pp.id} className="hover:bg-amber-100/50 dark:hover:bg-amber-800/10 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${getAvatarColor(pp.userName)} text-white text-xs font-semibold`}>
                              {getInitials(pp.userName)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{pp.userName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{pp.userEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm text-gray-900 dark:text-white">{pp.packageName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{pp.tokenCount} tokens</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {pp.currency} {amount}
                            </span>
                            {hasDiscount && (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                -{pp.discountPercent}% {pp.promoType === 'early_bird' ? '(early bird)' : pp.promoType === 'referral' ? '(referral)' : ''}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {pp.hitpayPaymentRequestId ? pp.hitpayPaymentRequestId.slice(0, 12) + '…' : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(pp.createdAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => syncPayment(pp.id)}
                              disabled={isSyncing || isDeleting}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                isSyncing
                                  ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700'
                                  : result?.success
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : result && !result.success
                                      ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100'
                                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                              }`}
                            >
                              {isSyncing ? (
                                <>
                                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Checking…
                                </>
                              ) : result?.success ? (
                                <>
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Confirmed
                                </>
                              ) : (
                                <>
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Sync
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setPendingDeleteTarget(pp)}
                              disabled={isSyncing || isDeleting}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                isDeleting
                                  ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700'
                                  : 'bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md'
                              }`}
                            >
                              {isDeleting ? (
                                <>
                                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Deleting…
                                </>
                              ) : (
                                <>
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7L5 7m2 0l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12M10 11v6M14 11v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
                                  </svg>
                                  Delete
                                </>
                              )}
                            </button>
                            {result && (
                              <span className={`text-xs max-w-28 text-center ${result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {result.message}
                              </span>
                            )}
                            {deleteResult && (
                              <span className={`text-xs max-w-32 text-center ${deleteResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {deleteResult.message}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main view tabs */}
      <div className="flex flex-wrap gap-2">
        {pageTabs.map((tab) => {
          const count =
            tab.value === "payments"
              ? paymentsData?.total ?? 0
              : tab.value === "transactions"
              ? data?.total ?? 0
              : tab.value === "active_bookings"
                ? activeBookingsData?.total ?? 0
              : tab.value === "expiring_soon"
                ? expiryCounts.expiringSoon
                : expiryCounts.expired;
          return (
            <button
              key={tab.value}
              onClick={() => switchTab(tab.value)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.value
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.value ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats Cards */}
      {activeTab === "transactions" && (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Purchased</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+{stats.totalPurchased}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Consumed</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.totalConsumed}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Expired</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.totalExpired}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
              <svg className="h-5 w-5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Released</p>
              <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400">+{stats.totalReleased}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Adjusted</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {stats.totalAdjusted >= 0 ? "+" : ""}{stats.totalAdjusted}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700">
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.todayTransactions}</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Filters & Search */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Type Filter Tabs (transactions only) */}
          {activeTab === "transactions" && (
          <div className="flex flex-wrap gap-2">
            {typeFilters.map((filter) => {
              const count = filter.value === "all" 
                ? filteredTransactions.length 
                : filteredTransactions.filter(t => t.displayType === filter.value).length;
              return (
                <button
                  key={filter.value}
                  onClick={() => {
                    setTypeFilter(filter.value);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    typeFilter === filter.value
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {filter.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                    typeFilter === filter.value
                      ? "bg-white/20"
                      : "bg-gray-200 dark:bg-gray-600"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          )}

          {activeTab !== "transactions" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeTab === "payments"
                  ? "Every payment from packages and guest trials. Paid customers needing a class are clearly flagged."
                  : activeTab === "active_bookings"
                  ? "Every booking, including confirmed, attended, waitlisted, and cancelled records, ordered by submission time."
                  : activeTab === "expiring_soon"
                  ? "Active packages expiring within 7 days (Singapore date — valid through expiry day)"
                  : "Packages past expiry date. Users cannot book with these — run cleanup to mark them expired in the system."}
              </p>
              {activeTab === "expired" && (
                <button
                  type="button"
                  onClick={runExpiryCleanup}
                  disabled={isProcessingExpired}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isProcessingExpired ? "Processing…" : "Mark expired in system"}
                </button>
              )}
            </div>
          )}

          {/* Date Range & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center ml-auto">
            {(activeTab === "payments" || activeTab === "transactions" || activeTab === "active_bookings") && (
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              {(["today", "week", "month", "all"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setDateRange(range);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    dateRange === range
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {range === "all" ? "All Time" : range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
            )}

            <div className="relative">
              <Input
                type="text"
                placeholder={activeTab === "payments" ? "Search payments on this page..." : activeTab === "transactions" ? "Search token activity..." : activeTab === "active_bookings" ? "Search by name, email, or class..." : "Search by name or email..."}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  setExpiryPage(1);
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions / Expiry Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        {(activeTab === "payments" && paymentsLoading) ||
        (activeTab === "transactions" && (isLoading || transactionsFetching)) ||
        (activeTab === "active_bookings" && activeBookingsLoading) ||
        ((activeTab === "expiring_soon" || activeTab === "expired") && (expiryLoading || expiryFetching)) ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : activeTab === "payments" && paymentsError ? (
          <div className="p-12 text-center text-sm text-red-600">{paymentsError instanceof Error ? paymentsError.message : "Failed to load payments"}</div>
        ) : activeTab === "payments" ? (
          <div className="overflow-x-auto">
            <table className="w-full"><thead><tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40"><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Class / action</th><th className="px-4 py-3">Date</th></tr></thead>
              <tbody className="divide-y dark:divide-gray-700">{(paymentsData?.payments || []).filter((p) => !searchQuery || [p.customerName,p.customerEmail,p.id,p.className].some((v) => v?.toLowerCase().includes(searchQuery.toLowerCase()))).map((p) => <tr key={p.id} className={p.needsScheduling ? "bg-amber-50 dark:bg-amber-950/20" : ""}><td className="px-4 py-3"><div className="font-semibold text-gray-900 dark:text-white">{p.customerName}</div><div className="text-xs text-gray-500">{p.customerEmail || "No email"}</div><div className="font-mono text-[10px] text-gray-400">{p.id.slice(0,8)}…</div></td><td className="px-4 py-3"><div className="font-bold">{p.currency} {p.amount.toFixed(2)}</div><div className="text-xs text-gray-500">{p.flowType.replaceAll("_", " ")} · {p.provider}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${["succeeded","completed"].includes(p.status) ? "bg-emerald-100 text-emerald-700" : p.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{p.status}</span></td><td className="px-4 py-3">{p.className ? <><div className="font-medium">{p.className}</div><div className="text-xs text-gray-500">{p.classAt ? formatDate(p.classAt) : p.bookingStatus}</div></> : p.needsScheduling ? <Link href="/leads" className="inline-flex rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">Needs scheduling</Link> : <span className="text-sm text-gray-400">No class</span>}</td><td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(p.createdAt)}</td></tr>)}</tbody>
            </table>
            {!(paymentsData?.payments.length) && <div className="p-10 text-center text-sm text-gray-500">No payments found.</div>}
            {renderPagination(currentPage, Math.ceil((paymentsData?.total || 0) / itemsPerPage), paymentsData?.total || 0, itemsPerPage, setCurrentPage, setItemsPerPage, "payments")}
          </div>
        ) : activeTab === "transactions" && error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Failed to load transactions</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        ) : activeTab === "active_bookings" && activeBookingsError ? (
          <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Failed to load active bookings</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {activeBookingsError instanceof Error ? activeBookingsError.message : "An error occurred"}
            </p>
          </div>
        ) : activeTab === "active_bookings" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Booking</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Class</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Class Time</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(activeBookingsData?.bookings || []).map(booking => (
                    <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-300">{booking.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.userName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{booking.userEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.classTitle}</p>
                        {booking.location && <p className="text-xs text-gray-500 dark:text-gray-400">{booking.location}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {booking.classStartsAt ? `${formatSgtDateTime(booking.classStartsAt)} SGT` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          booking.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : booking.status === "attended"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : booking.status === "cancelled"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatSgtDateTime(booking.bookedAt)} SGT</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Booking submitted</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(activeBookingsData?.bookings.length || 0) === 0 && (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No active bookings found.</div>
            )}
            {(activeBookingsData?.bookings.length || 0) > 0 && renderPagination(
              currentPage,
              activeBookingTotalPages,
              activeBookingsData?.total || 0,
              itemsPerPage,
              setCurrentPage,
              setItemsPerPage,
              "bookings"
            )}
          </>
        ) : (activeTab === "expiring_soon" || activeTab === "expired") && expiryError ? (
          <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Failed to load expiry data</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {expiryError instanceof Error ? expiryError.message : "An error occurred"}
            </p>
          </div>
        ) : activeTab !== "transactions" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Package</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Available</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {activeTab === "expiring_soon" ? "Time left" : "Expired"}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {expiryItems.map(renderExpiryRow)}
                </tbody>
              </table>
            </div>

            {expiryItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {activeTab === "expiring_soon" ? "No tokens expiring soon" : "No expired packages found"}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery ? "Try adjusting your search" : "You're all caught up"}
                </p>
              </div>
            )}

            {expiryItems.length > 0 &&
              renderPagination(
                expiryPage,
                expiryTotalPages,
                expiryData?.total ?? 0,
                expiryItemsPerPage,
                setExpiryPage,
                setExpiryItemsPerPage,
                activeTab === "expiring_soon" ? "packages" : "expired packages"
              )}
          </>
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Transaction
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Balance
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.map((tx) => {
                const config = typeConfig[tx.displayType];
                return (
                  <tr 
                    key={tx.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {/* Transaction ID */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                          {tx.id.slice(0, 8)}...
                        </span>
                        {tx.reference && (
                          <span className="font-mono text-xs text-gray-400">
                            {tx.reference.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {tx.userAvatar ? (
                          <img
                            src={tx.userAvatar}
                            alt={tx.userName}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${getAvatarColor(tx.userName)} text-white text-sm font-semibold`}>
                            {getInitials(tx.userName)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {tx.userName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {tx.userEmail}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.color}`}>
                        <span>{config.icon}</span>
                        {config.label}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-12 rounded-lg px-2 py-1 text-sm font-bold ${
                        tx.amount > 0 
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : tx.amount < 0 
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                      }`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount === 0 ? "0" : `-${tx.amount}`}
                      </span>
                    </td>

                    {/* Balance */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                        </svg>
                        <span className="font-semibold text-gray-900 dark:text-white">{tx.balance}</span>
                      </div>
                    </td>

                    {/* Details */}
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <p className="text-sm text-gray-900 dark:text-white truncate">
                          {tx.description || '-'}
                        </p>
                        {tx.bookingId && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            <span className="text-blue-600 dark:text-blue-400">🎯 Booking: {tx.bookingId.slice(0, 8)}...</span>
                            {tx.bookedAt && (
                              <p className="mt-0.5 whitespace-nowrap">Booked: {formatDate(tx.bookedAt)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedTransaction(tx)}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                        title="View details"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No transactions found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredTransactions.length > 0 &&
          renderPagination(
            currentPage,
            totalPages,
            data?.total ?? 0,
            itemsPerPage,
            setCurrentPage,
            setItemsPerPage,
            "transactions"
          )}
        </>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-gray-800 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Transaction Details</h3>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Transaction Header */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{selectedTransaction.id}</p>
                  <p className="text-xs text-gray-400">{selectedTransaction.reference}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${typeConfig[selectedTransaction.displayType].bg} ${typeConfig[selectedTransaction.displayType].color}`}>
                  <span>{typeConfig[selectedTransaction.displayType].icon}</span>
                  {typeConfig[selectedTransaction.displayType].label}
                </span>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                {selectedTransaction.userAvatar ? (
                  <img
                    src={selectedTransaction.userAvatar}
                    alt={selectedTransaction.userName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getAvatarColor(selectedTransaction.userName)} text-white font-semibold`}>
                    {getInitials(selectedTransaction.userName)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedTransaction.userName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedTransaction.userEmail}</p>
                </div>
              </div>

              {/* Amount & Balance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount</p>
                  <p className={`text-2xl font-bold ${
                    selectedTransaction.amount > 0 
                      ? "text-emerald-600 dark:text-emerald-400"
                      : selectedTransaction.amount < 0 
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-400"
                  }`}>
                    {selectedTransaction.amount > 0 ? `+${selectedTransaction.amount}` : `-${selectedTransaction.amount}`}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Balance After</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedTransaction.balance}</p>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedTransaction.description || '-'}</p>
                {selectedTransaction.userPackageId && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">📦 Package: {selectedTransaction.userPackageId.slice(0, 8)}...</p>
                )}
                {selectedTransaction.bookingId && (
                  <div className="mt-2 text-xs">
                    <p className="text-blue-600 dark:text-blue-400">🎯 Booking: {selectedTransaction.bookingId.slice(0, 8)}...</p>
                    {selectedTransaction.bookedAt && (
                      <p className="mt-1 text-gray-500 dark:text-gray-400">
                        Booked: {formatSgtDateTime(selectedTransaction.bookedAt)} SGT
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">Transaction Date</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatSgtDateTime(selectedTransaction.createdAt)} SGT
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
              <button className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                View User Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Payment Delete Confirmation Modal */}
      {pendingDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Pending Payment</h3>
              <button
                onClick={() => setPendingDeleteTarget(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete this pending payment? This action cannot be undone.
            </p>

            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm">
              <p><span className="text-gray-500">User:</span> <span className="font-medium text-gray-900 dark:text-white">{pendingDeleteTarget.userName}</span></p>
              <p><span className="text-gray-500">Package:</span> <span className="font-medium text-gray-900 dark:text-white">{pendingDeleteTarget.packageName}</span></p>
              <p><span className="text-gray-500">Amount:</span> <span className="font-medium text-gray-900 dark:text-white">{pendingDeleteTarget.currency} {(pendingDeleteTarget.amountCents / 100).toFixed(2)}</span></p>
              <p><span className="text-gray-500">HitPay ID:</span> <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{pendingDeleteTarget.hitpayPaymentRequestId || '—'}</span></p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPendingDeleteTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeletingFromModal(true);
                  try {
                    await deletePendingPayment(pendingDeleteTarget.id);
                    setPendingDeleteTarget(null);
                  } finally {
                    setDeletingFromModal(false);
                  }
                }}
                disabled={deletingFromModal}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deletingFromModal ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
