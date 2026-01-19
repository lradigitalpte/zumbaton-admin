"use client";

import { useState, useMemo } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Input from "@/components/form/input/InputField";
import { useTokenTransactions, TokenTransaction, TransactionType } from "@/hooks/useTokenTransactions";

// Map API transaction types to display types
type DisplayTransactionType = "purchase" | "hold" | "consume" | "release" | "adjustment" | "expire";

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
  };
  return typeMap[apiType] || 'adjustment';
};

// Map display filter to API types
const getApiTypeFilter = (displayType: string): string | undefined => {
  if (displayType === 'all') return undefined;
  
  // For display types that map to multiple API types, we filter client-side
  const typeMap: Record<string, string> = {
    'purchase': 'purchase',
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
};

const typeFilters: { value: string; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "purchase", label: "Purchase" },
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

export default function TokenTransactionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const [selectedTransaction, setSelectedTransaction] = useState<DisplayTransaction | null>(null);

  // Calculate date range params for API
  const dateParams = useMemo(() => {
    if (dateRange === "all") return {};
    const now = new Date();
    const endDate = now.toISOString();
    let startDate: string;
    
    if (dateRange === "today") {
      startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    } else if (dateRange === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    
    return { startDate, endDate };
  }, [dateRange]);

  // Fetch transactions from API
  const { data, isLoading, error } = useTokenTransactions({
    type: getApiTypeFilter(typeFilter),
    startDate: dateParams.startDate,
    endDate: dateParams.endDate,
    search: searchQuery || undefined,
    page: currentPage,
    pageSize: itemsPerPage,
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Token Transactions" />
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading transactions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Token Transactions" />
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Failed to load transactions</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Token Transactions" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Transactions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track all token movements across your platform
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
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

      {/* Filters & Search */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Type Filter Tabs */}
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

          {/* Date Range & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

            <div className="relative">
              <Input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
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

      {/* Transactions Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
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
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            <span className="text-blue-600 dark:text-blue-400">🎯 Booking: {tx.bookingId.slice(0, 8)}...</span>
                          </p>
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
        {filteredTransactions.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>of {filteredTransactions.length} transactions</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
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
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-8 rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                        currentPage === pageNum
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
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
                  <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">🎯 Booking: {selectedTransaction.bookingId.slice(0, 8)}...</p>
                )}
              </div>

              {/* Timestamp */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">Transaction Date</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(selectedTransaction.createdAt).toLocaleString()}
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
    </div>
  );
}
