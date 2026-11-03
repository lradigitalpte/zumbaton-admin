"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useTokenTransactions, TokenTransaction, TransactionType } from "@/hooks/useTokenTransactions";
import { useTokenPackageExpiry, useTokenPackageExpiryCounts } from "@/hooks/useTokenPackageExpiry";
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
type DisplayTransactionType = "purchase" | "hold" | "consume" | "release" | "adjustment" | "admin-sale" | "expire" | "trial";

const mapTransactionType = (apiType: TransactionType): DisplayTransactionType => {
  const typeMap: Record<TransactionType, DisplayTransactionType> = {
    'purchase': 'purchase',
    'booking-hold': 'hold',
    'booking-release': 'release',
    'booking-consume': 'consume',
    'attendance-consume': 'consume',
    'no-show-consume': 'consume',
    'late-cancel-consume': 'consume',
    'admin-adjust': 'adjustment',
    'admin-sale': 'admin-sale',
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
    'admin-sale': 'admin-sale',
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
  "admin-sale": {
    label: "Admin Sale",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/30",
    icon: "⚑"
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
  { value: "admin-sale", label: "Admin Sale" },
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
  const { deletePendingPayment, deletingIds } = useDeletePendingPayment();

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

  const { data: sectionTotals } = useQuery({
    queryKey: ["activity-section-totals", dateRange],
    queryFn: async () => {
      const range = new URLSearchParams({ page: "1", pageSize: "1" });
      if (dateParams.startDate) range.set("startDate", dateParams.startDate);
      if (dateParams.endDate) range.set("endDate", dateParams.endDate);
      const [payments, bookings, transactions] = await Promise.all([
        api.get<{ success: boolean; data: { total: number } }>(`/api/payments/ledger?${range}`),
        api.get<{ success: boolean; data: { total: number } }>(`/api/bookings/active?${range}`),
        api.get<{ success: boolean; data: { total: number } }>(`/api/tokens/transactions?${range}`),
      ]);
      return {
        payments: payments.data?.data?.total ?? null,
        bookings: bookings.data?.data?.total ?? null,
        transactions: transactions.data?.data?.total ?? null,
      };
    },
  });

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
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-[#E4F56C] text-neutral-950",
      "bg-sky-100 text-sky-800",
      "bg-orange-100 text-orange-800",
      "bg-violet-100 text-violet-800",
      "bg-emerald-100 text-emerald-800",
      "bg-pink-100 text-pink-800",
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
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

  const renderPagination = (
    page: number,
    totalPages: number,
    total: number,
    perPage: number,
    onPageChange: (p: number) => void,
    onPerPageChange: (n: number) => void,
    label: string
  ) => (
    <div className="flex flex-col gap-4 border-t border-neutral-100 px-5 py-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <span>Show</span>
        <select
          value={perPage}
          onChange={(e) => {
            onPerPageChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 dark:border-white/10 dark:bg-gray-900 dark:text-white"
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
                className={`min-w-8 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  page === pageNum
                    ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                    : "text-neutral-500 hover:bg-neutral-100 dark:text-white/60 dark:hover:bg-white/10"
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

  const tabCount = (tab: PageTab): number | null => {
    if (tab === "payments") return sectionTotals?.payments ?? paymentsData?.total ?? null;
    if (tab === "transactions") return sectionTotals?.transactions ?? data?.total ?? null;
    if (tab === "active_bookings") return sectionTotals?.bookings ?? activeBookingsData?.total ?? null;
    if (tab === "expiring_soon") return expiryCountsData ? expiryCounts.expiringSoon : null;
    return expiryCountsData ? expiryCounts.expired : null;
  };

  const tabHint: Record<PageTab, string> = {
    payments: "Packages and guest trials",
    transactions: "Holds, spends, and adjustments",
    active_bookings: "Confirmed through cancelled",
    expiring_soon: "Still valid, ending within 7 days",
    expired: "Past the expiry date",
  };

  const visiblePayments = (paymentsData?.payments || []).filter((payment) =>
    !searchQuery || [payment.customerName, payment.customerEmail, payment.id, payment.className].some((value) => value?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-w-0 space-y-5">
      <PageBreadCrumb pageTitle="Payments & Activity" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Payments & Activity</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Who paid, whether it went through, and whether they have a class booked.
          </p>
        </div>
        {pendingPayments.length > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 dark:bg-amber-500/10">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
              {pendingPayments.length}
            </span>
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Unfinished checkout{pendingPayments.length === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>

      {/* Pending Payments Section */}
      {(pendingPayments.length > 0 || pendingLoading) && (
        <div className="overflow-hidden rounded-[28px] border border-amber-200 bg-amber-50 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-amber-700 dark:bg-amber-900/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-amber-700">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Unfinished Checkouts — no payment received yet
                </h3>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                  Usually the customer left HitPay without paying. Sync double-checks with HitPay; customers get one automatic reminder email.
                </p>
              </div>
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
            <ul className="divide-y divide-amber-100 dark:divide-amber-800/30">
              {pendingPayments.map((pp) => {
                const isSyncing = syncingIds.has(pp.id);
                const isDeleting = deletingIds.has(pp.id);
                const result = syncResults[pp.id];
                const amount = (pp.amountCents / 100).toFixed(2);
                return (
                  <li key={pp.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(pp.userName)}`}>
                      {getInitials(pp.userName || "?")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{pp.userName}</p>
                      <p className="truncate text-xs text-neutral-500">{pp.userEmail}</p>
                      <p className="text-[11px] text-neutral-500">{pp.packageName} · {pp.tokenCount} tokens{pp.paidOnLaterAttempt ? " · paid later, safe to delete" : ""}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{pp.currency} {amount}</p>
                      <p className="text-[11px] text-neutral-400">{formatDate(pp.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => syncPayment(pp.id)} disabled={isSyncing || isDeleting} className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">
                        {isSyncing ? "Checking…" : result?.success ? "Confirmed" : "Sync"}
                      </button>
                      <button type="button" onClick={() => setPendingDeleteTarget(pp)} disabled={isSyncing || isDeleting} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {pageTabs.map((tab) => {
          const selected = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => switchTab(tab.value)}
              aria-pressed={selected}
              className={`relative min-h-[124px] rounded-[28px] border p-5 text-left shadow-[0_10px_30px_rgba(16,24,40,0.05)] ${
                selected
                  ? "border-neutral-950 bg-[#E4F56C] text-neutral-950 ring-2 ring-neutral-950"
                  : "border-neutral-200/80 bg-white text-neutral-950 hover:border-neutral-300 dark:border-white/10 dark:bg-gray-800 dark:text-white"
              }`}
            >
              <span className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-neutral-950 bg-neutral-950 text-[#E4F56C]" : "border-neutral-300 bg-white dark:border-white/20 dark:bg-gray-900"}`}>
                {selected ? (
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3.5 8.5l3 3 6-6.5" /></svg>
                ) : null}
              </span>
              <p className={`pr-6 text-xs font-semibold uppercase tracking-wide ${selected ? "text-neutral-950/70" : "text-neutral-400"}`}>{tab.label}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{tabCount(tab.value) ?? "—"}</p>
              <p className={`mt-1 text-xs ${selected ? "text-neutral-950/70" : "text-neutral-400"}`}>{selected ? "Viewing now" : tabHint[tab.value]}</p>
            </button>
          );
        })}
      </div>

      {activeTab === "transactions" && (
        <div className="flex flex-wrap gap-2">
          {[
            ["Purchased", `+${stats.totalPurchased}`],
            ["Consumed", String(stats.totalConsumed)],
            ["Expired", String(stats.totalExpired)],
            ["Released", `+${stats.totalReleased}`],
            ["Adjusted", `${stats.totalAdjusted >= 0 ? "+" : ""}${stats.totalAdjusted}`],
            ["Today", String(stats.todayTransactions)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-gray-800">
              <span className="text-neutral-400">{label}</span>{" "}
              <span className="font-semibold text-neutral-950 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {activeTab === "transactions" && (
            <div className="flex flex-wrap gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5">
              {typeFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => { setTypeFilter(filter.value); setCurrentPage(1); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${typeFilter === filter.value ? "bg-white text-neutral-950 shadow-sm dark:bg-gray-700 dark:text-white" : "text-neutral-500"}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
          {activeTab !== "transactions" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-sm text-neutral-500">
                {activeTab === "payments"
                  ? "Paid customers who still need a class stay highlighted."
                  : activeTab === "active_bookings"
                    ? "Every booking, newest submission first."
                    : activeTab === "expiring_soon"
                      ? "Active packages that run out within 7 days."
                      : "Packages past their expiry date."}
              </p>
              {activeTab === "expired" && (
                <button type="button" onClick={runExpiryCleanup} disabled={isProcessingExpired} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  {isProcessingExpired ? "Processing…" : "Mark expired in system"}
                </button>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto">
            {(activeTab === "payments" || activeTab === "transactions" || activeTab === "active_bookings") && (
              <div className="flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5">
                {(["today", "week", "month", "all"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => { setDateRange(range); setCurrentPage(1); }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${dateRange === range ? "bg-white text-neutral-950 shadow-sm dark:bg-gray-700 dark:text-white" : "text-neutral-500"}`}
                  >
                    {range === "all" ? "All time" : range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            )}
            <input
              type="search"
              placeholder="Search name or email"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); setExpiryPage(1); }}
              className="h-9 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm outline-none focus:border-neutral-400 sm:w-56 dark:border-white/10 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
        {(activeTab === "payments" && paymentsLoading) ||
        (activeTab === "transactions" && (isLoading || transactionsFetching)) ||
        (activeTab === "active_bookings" && activeBookingsLoading) ||
        ((activeTab === "expiring_soon" || activeTab === "expired") && (expiryLoading || expiryFetching)) ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E4F56C] border-t-transparent"></div>
            <p className="mt-4 text-sm text-neutral-400">Loading…</p>
          </div>
        ) : activeTab === "payments" && paymentsError ? (
          <div className="p-12 text-center text-sm text-red-600">{paymentsError instanceof Error ? paymentsError.message : "Failed to load payments"}</div>
        ) : activeTab === "payments" ? (
          <>
            <ul className="divide-y divide-neutral-100 dark:divide-white/5">
              {visiblePayments.length === 0 ? (
                <li className="px-6 py-14 text-center text-sm text-neutral-400">{searchQuery ? "No payments on this page match that search." : "No payments found."}</li>
              ) : visiblePayments.map((payment) => {
                const paid = ["succeeded", "completed"].includes(payment.status);
                return (
                  <li key={payment.id} className={`flex flex-col gap-3 px-5 py-4 transition hover:bg-neutral-50 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:px-6 ${payment.needsScheduling ? "bg-amber-50/70 dark:bg-amber-950/20" : ""}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(payment.customerName)}`}>{getInitials(payment.customerName || "?")}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{payment.customerName || "No name"}</p>
                      <p className="truncate text-xs text-neutral-500">{payment.customerEmail || "No email"}</p>
                    </div>
                    <div className="sm:w-28 sm:text-right">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{payment.currency} {payment.amount.toFixed(2)}</p>
                      <p className="text-[11px] capitalize text-neutral-400">{payment.flowType.replaceAll("_", " ")} · {payment.provider}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${paid ? "bg-[#E4F56C] text-neutral-950" : payment.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>{payment.status}</span>
                    <div className="min-w-0 sm:w-44">
                      {payment.className ? (
                        <>
                          <p className="truncate text-sm font-medium text-neutral-950 dark:text-white">{payment.className}</p>
                          <p className="text-[11px] text-neutral-400">{payment.classAt ? formatDate(payment.classAt) : payment.bookingStatus}</p>
                        </>
                      ) : payment.needsScheduling ? (
                        <Link href="/leads" className="inline-flex rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white">Needs a class</Link>
                      ) : (
                        <span className="text-xs text-neutral-400">No class</span>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-neutral-400 sm:w-32 sm:text-right">{formatDate(payment.createdAt)}</p>
                  </li>
                );
              })}
            </ul>
            {(paymentsData?.payments.length || 0) > 0 && renderPagination(currentPage, Math.ceil((paymentsData?.total || 0) / itemsPerPage), paymentsData?.total || 0, itemsPerPage, setCurrentPage, setItemsPerPage, "payments")}
          </>
        ) : activeTab === "transactions" && error ? (
          <div className="p-12 text-center text-sm text-red-600">{error instanceof Error ? error.message : "Failed to load activity"}</div>
        ) : activeTab === "active_bookings" && activeBookingsError ? (
          <div className="p-12 text-center text-sm text-red-600">{activeBookingsError instanceof Error ? activeBookingsError.message : "Failed to load bookings"}</div>
        ) : activeTab === "active_bookings" ? (
          <>
            <ul className="divide-y divide-neutral-100 dark:divide-white/5">
              {(activeBookingsData?.bookings.length || 0) === 0 ? (
                <li className="px-6 py-14 text-center text-sm text-neutral-400">No bookings found.</li>
              ) : (activeBookingsData?.bookings || []).map((booking) => (
                <li key={booking.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-neutral-50 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:px-6">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(booking.userName)}`}>{getInitials(booking.userName || "?")}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{booking.userName}</p>
                    <p className="truncate text-xs text-neutral-500">{booking.userEmail}</p>
                  </div>
                  <div className="min-w-0 sm:w-48">
                    <p className="truncate text-sm font-medium text-neutral-950 dark:text-white">{booking.classTitle}</p>
                    <p className="truncate text-[11px] text-neutral-400">{booking.location || "No location"}</p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-white/70">{booking.classStartsAt ? formatDate(booking.classStartsAt) : "—"}</p>
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${booking.status === "confirmed" ? "bg-[#E4F56C] text-neutral-950" : booking.status === "attended" ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : booking.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{booking.status.replaceAll("_", " ")}</span>
                  <p className="shrink-0 text-xs text-neutral-400 sm:w-32 sm:text-right">{formatDate(booking.bookedAt)}</p>
                </li>
              ))}
            </ul>
            {(activeBookingsData?.bookings.length || 0) > 0 && renderPagination(currentPage, activeBookingTotalPages, activeBookingsData?.total || 0, itemsPerPage, setCurrentPage, setItemsPerPage, "bookings")}
          </>
        ) : (activeTab === "expiring_soon" || activeTab === "expired") && expiryError ? (
          <div className="p-12 text-center text-sm text-red-600">{expiryError instanceof Error ? expiryError.message : "Failed to load expiry data"}</div>
        ) : activeTab !== "transactions" ? (
          <>
            <ul className="divide-y divide-neutral-100 dark:divide-white/5">
              {expiryItems.length === 0 ? (
                <li className="px-6 py-14 text-center text-sm text-neutral-400">{searchQuery ? "No one matches that search." : activeTab === "expiring_soon" ? "No packages expiring in the next 7 days." : "No expired packages."}</li>
              ) : expiryItems.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-neutral-50 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:px-6">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(item.userName)}`}>{getInitials(item.userName || "?")}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{item.userName}</p>
                    <p className="truncate text-xs text-neutral-500">{item.userEmail}</p>
                  </div>
                  <div className="min-w-0 sm:w-40">
                    <p className="truncate text-sm font-medium text-neutral-950 dark:text-white">{item.packageName}</p>
                    <p className="text-[11px] text-neutral-400">{item.availableTokens} left{item.tokensHeld > 0 ? ` · ${item.tokensHeld} held` : ""}</p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-white/70">{formatExpiryDate(item.expiresAt)}</p>
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${activeTab === "expiring_soon" ? (item.daysUntilExpiry <= 1 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800") : item.isProcessed ? "bg-neutral-100 text-neutral-600" : "bg-red-100 text-red-700"}`}>
                    {activeTab === "expiring_soon"
                      ? item.daysUntilExpiry <= 0 ? "Expires today" : item.daysUntilExpiry === 1 ? "Tomorrow" : `${item.daysUntilExpiry} days left`
                      : item.isProcessed ? "Cleared" : `${item.daysSinceExpiry}d ago`}
                  </span>
                  <Link href={`/users/${item.userId}`} className="shrink-0 text-xs font-semibold text-neutral-950 underline dark:text-white">View member</Link>
                </li>
              ))}
            </ul>
            {expiryItems.length > 0 && renderPagination(expiryPage, expiryTotalPages, expiryData?.total ?? 0, expiryItemsPerPage, setExpiryPage, setExpiryItemsPerPage, activeTab === "expiring_soon" ? "packages" : "expired packages")}
          </>
        ) : (
          <>
            <ul className="divide-y divide-neutral-100 dark:divide-white/5">
              {filteredTransactions.length === 0 ? (
                <li className="px-6 py-14 text-center text-sm text-neutral-400">No activity matches that filter.</li>
              ) : filteredTransactions.map((tx) => {
                const config = typeConfig[tx.displayType];
                const amountLabel = tx.amount > 0 ? `+${tx.amount}` : String(tx.amount);
                return (
                  <li key={tx.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-neutral-50 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:px-6">
                    {tx.userAvatar ? (
                      <img src={tx.userAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(tx.userName)}`}>{getInitials(tx.userName || "?")}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{tx.userName}</p>
                      <p className="truncate text-xs text-neutral-500">{tx.description || tx.userEmail}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${config.bg} ${config.color}`}>{config.label}</span>
                    <div className="sm:w-16 sm:text-right">
                      <p className={`text-sm font-semibold ${tx.amount > 0 ? "text-emerald-700" : tx.amount < 0 ? "text-red-600" : "text-neutral-500"}`}>{amountLabel}</p>
                      <p className="text-[11px] text-neutral-400">Bal {tx.balance}</p>
                    </div>
                    <p className="shrink-0 text-xs text-neutral-400 sm:w-32 sm:text-right">{formatDate(tx.createdAt)}</p>
                    <button type="button" onClick={() => setSelectedTransaction(tx)} className="shrink-0 text-xs font-semibold text-neutral-950 underline dark:text-white">Details</button>
                  </li>
                );
              })}
            </ul>
            {filteredTransactions.length > 0 && renderPagination(currentPage, totalPages, data?.total ?? 0, itemsPerPage, setCurrentPage, setItemsPerPage, "transactions")}
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
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(selectedTransaction.userName)}`}>
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
