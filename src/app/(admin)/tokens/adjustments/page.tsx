"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Input from "@/components/form/input/InputField";
import { 
  useTokenAdjustments, 
  useCreateAdjustment,
  useApproveAdjustment,
  useRejectAdjustment,
  useCompleteAdjustment,
  TokenAdjustment,
  AdjustmentType,
  AdjustmentStatus,
} from "@/hooks/useTokenAdjustments";
import { useAuth } from "@/context/AuthContext";
import { useUsers, type User } from "@/hooks/useUsers";

const typeConfig: Record<AdjustmentType, { label: string; color: string; bg: string }> = {
  credit: { label: "Credit", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
  debit: { label: "Debit", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30" },
  correction: { label: "Correction", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
  promo: { label: "Promo", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/30" },
  refund: { label: "Refund", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" },
};

const statusConfig: Record<AdjustmentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" },
  approved: { label: "Approved", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
  rejected: { label: "Rejected", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30" },
  completed: { label: "Completed", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
};

const adjustmentReasons = [
  "Class cancellation compensation",
  "Duplicate purchase refund",
  "Referral bonus",
  "System error correction",
  "Customer goodwill",
  "Promotional credit",
  "Fraudulent activity correction",
  "Account migration",
  "Other",
];

export default function TokenAdjustmentsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<TokenAdjustment | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserDropdown]);

  // Fetch adjustments from API
  const { data, isLoading, error } = useTokenAdjustments({
    status: statusFilter,
    type: typeFilter,
    search: searchQuery || undefined,
  });

  // Search users for adjustment form
  const { data: userSearchResults } = useUsers(
    { 
      search: userSearchQuery || undefined,
      pageSize: 10,
      role: 'user',
      isActive: true,
    },
    { enabled: userSearchQuery.length >= 2 && showCreatePanel }
  );

  // Mutations
  const createMutation = useCreateAdjustment();
  const approveMutation = useApproveAdjustment();
  const rejectMutation = useRejectAdjustment();
  const completeMutation = useCompleteAdjustment();

  // New adjustment form state
  const [newAdjustment, setNewAdjustment] = useState({
    userId: "",
    type: "credit" as AdjustmentType,
    amount: "",
    reason: "",
    notes: "",
  });

  // Get adjustments and stats from API data
  const adjustments = data?.adjustments || [];
  const stats = data?.stats || {
    total: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
    totalCredits: 0,
    totalDebits: 0,
  };

  // Client-side filtering for display (API already filters, this is for UI counts)
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      const matchesSearch = !searchQuery ||
        adj.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.reason.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || adj.status === statusFilter;
      const matchesType = typeFilter === "all" || adj.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [adjustments, searchQuery, statusFilter, typeFilter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
      "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500",
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const handleCreateAdjustment = async () => {
    if (!newAdjustment.userId || !newAdjustment.amount || !newAdjustment.reason) return;

    try {
      await createMutation.mutateAsync({
        userId: newAdjustment.userId,
        type: newAdjustment.type,
        amount: Number(newAdjustment.amount),
        reason: newAdjustment.reason,
        notes: newAdjustment.notes || undefined,
        requestedBy: user?.id,
      });
      setShowCreatePanel(false);
      setNewAdjustment({ userId: "", type: "credit", amount: "", reason: "", notes: "" });
      setSelectedUser(null);
      setUserSearchQuery("");
    } catch (err) {
      console.error('Failed to create adjustment:', err);
    }
  };

  const handleUserSelect = (selected: User) => {
    setSelectedUser(selected);
    setNewAdjustment({ ...newAdjustment, userId: selected.id });
    setUserSearchQuery(selected.name || selected.email);
    setShowUserDropdown(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ id, performedBy: user?.id });
      setSelectedAdjustment(null);
    } catch (err) {
      console.error('Failed to approve adjustment:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync(id);
      setSelectedAdjustment(null);
    } catch (err) {
      console.error('Failed to reject adjustment:', err);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeMutation.mutateAsync({ id, performedBy: user?.id });
      setSelectedAdjustment(null);
    } catch (err) {
      console.error('Failed to complete adjustment:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Token Adjustments" />
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading adjustments...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Token Adjustments" />
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Failed to load adjustments</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Token Adjustments" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Adjustments</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage manual token credits, debits, and corrections
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreatePanel(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-purple-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Adjustment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700">
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Approved</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Credits</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+{stats.totalCredits}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Debits</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">-{stats.totalDebits}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "completed", label: "Completed" },
              { value: "rejected", label: "Rejected" },
            ].map((filter) => {
              const count = filter.value === "all"
                ? adjustments.length
                : adjustments.filter((a) => a.status === filter.value).length;
              return (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    statusFilter === filter.value
                      ? "bg-purple-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {filter.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                    statusFilter === filter.value ? "bg-white/20" : "bg-gray-200 dark:bg-gray-600"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Type Filter & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              <option value="all">All Types</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
              <option value="correction">Correction</option>
              <option value="promo">Promo</option>
              <option value="refund">Refund</option>
            </select>

            <div className="relative">
              <Input
                type="text"
                placeholder="Search adjustments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Adjustments Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  ID
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Reason
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Requested
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAdjustments.map((adj) => {
                const tConfig = typeConfig[adj.type];
                const sConfig = statusConfig[adj.status];
                return (
                  <tr key={adj.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                        {adj.id}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${getAvatarColor(adj.userName)} text-white text-sm font-semibold`}>
                          {getInitials(adj.userName)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{adj.userName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{adj.userEmail}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${tConfig.bg} ${tConfig.color}`}>
                        {tConfig.label}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-12 rounded-lg px-2 py-1 text-sm font-bold ${
                        adj.amount > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {adj.amount > 0 ? `+${adj.amount}` : adj.amount}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <p className="text-sm text-gray-900 dark:text-white truncate">{adj.reason}</p>
                        {adj.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{adj.notes}</p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${sConfig.bg} ${sConfig.color}`}>
                        {sConfig.label}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">{adj.requestedBy}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(adj.requestedAt)}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedAdjustment(adj)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors"
                          title="View details"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {adj.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(adj.id)}
                              className="rounded-lg p-2 text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 transition-colors"
                              title="Approve"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleReject(adj.id)}
                              className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors"
                              title="Reject"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                        {adj.status === "approved" && (
                          <button
                            onClick={() => handleComplete(adj.id)}
                            className="rounded-lg p-2 text-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 transition-colors"
                            title="Complete"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAdjustments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No adjustments found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your filters or create a new adjustment
            </p>
          </div>
        )}
      </div>

      {/* Create Adjustment Panel */}
      {showCreatePanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-gray-800 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">New Token Adjustment</h3>
              <button
                onClick={() => setShowCreatePanel(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative" ref={userSearchRef}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">User *</label>
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setShowUserDropdown(true);
                    if (!e.target.value) {
                      setSelectedUser(null);
                      setNewAdjustment({ ...newAdjustment, userId: "" });
                    }
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                />
                {showUserDropdown && userSearchQuery.length >= 2 && userSearchResults?.users && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 max-h-60 overflow-y-auto">
                    {userSearchResults.users.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No users found</div>
                    ) : (
                      userSearchResults.users.map((u: User) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleUserSelect(u)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(u.name)} text-white text-xs font-semibold`}>
                              {getInitials(u.name)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {selectedUser && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-700/50">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(selectedUser.name)} text-white text-xs font-semibold`}>
                      {getInitials(selectedUser.name)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedUser.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setUserSearchQuery("");
                        setNewAdjustment({ ...newAdjustment, userId: "" });
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Type *</label>
                  <select
                    value={newAdjustment.type}
                    onChange={(e) => setNewAdjustment({ ...newAdjustment, type: e.target.value as AdjustmentType })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                    <option value="correction">Correction</option>
                    <option value="promo">Promo</option>
                    <option value="refund">Refund</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Amount *</label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={newAdjustment.amount}
                    onChange={(e) => setNewAdjustment({ ...newAdjustment, amount: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason *</label>
                <select
                  value={newAdjustment.reason}
                  onChange={(e) => setNewAdjustment({ ...newAdjustment, reason: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  <option value="">Select a reason</option>
                  {adjustmentReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  placeholder="Additional notes..."
                  value={newAdjustment.notes}
                  onChange={(e) => setNewAdjustment({ ...newAdjustment, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 resize-none"
                />
              </div>

              {/* Preview */}
              {selectedUser && newAdjustment.amount && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Preview</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(selectedUser.name)} text-white text-xs font-semibold`}>
                        {getInitials(selectedUser.name)}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedUser.name}</span>
                    </div>
                    <span className={`text-lg font-bold ${
                      newAdjustment.type === "debit" ? "text-red-600" : "text-emerald-600"
                    }`}>
                      {newAdjustment.type === "debit" ? "-" : "+"}{newAdjustment.amount} tokens
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreatePanel(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAdjustment}
                disabled={!newAdjustment.userId || !newAdjustment.amount || !newAdjustment.reason}
                className="flex-1 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Submit Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Detail Modal */}
      {selectedAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-gray-800 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Adjustment Details</h3>
              <button
                onClick={() => setSelectedAdjustment(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{selectedAdjustment.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${typeConfig[selectedAdjustment.type].bg} ${typeConfig[selectedAdjustment.type].color}`}>
                    {typeConfig[selectedAdjustment.type].label}
                  </span>
                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${statusConfig[selectedAdjustment.status].bg} ${statusConfig[selectedAdjustment.status].color}`}>
                    {statusConfig[selectedAdjustment.status].label}
                  </span>
                </div>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getAvatarColor(selectedAdjustment.userName)} text-white font-semibold`}>
                  {getInitials(selectedAdjustment.userName)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedAdjustment.userName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedAdjustment.userEmail}</p>
                </div>
              </div>

              {/* Amount */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Adjustment Amount</p>
                <p className={`text-3xl font-bold ${
                  selectedAdjustment.amount > 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                  {selectedAdjustment.amount > 0 ? `+${selectedAdjustment.amount}` : selectedAdjustment.amount} tokens
                </p>
                {selectedAdjustment.status === "completed" && selectedAdjustment.balanceBefore !== undefined && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Balance: {selectedAdjustment.balanceBefore} &rarr; {selectedAdjustment.balanceAfter}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reason</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAdjustment.reason}</p>
                {selectedAdjustment.notes && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{selectedAdjustment.notes}</p>
                )}
              </div>

              {/* Timeline */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Requested by</span>
                  <span className="text-sm text-gray-900 dark:text-white">{selectedAdjustment.requestedBy}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Requested at</span>
                  <span className="text-sm text-gray-900 dark:text-white">{formatDate(selectedAdjustment.requestedAt)}</span>
                </div>
                {selectedAdjustment.approvedBy && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Approved by</span>
                      <span className="text-sm text-gray-900 dark:text-white">{selectedAdjustment.approvedBy}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Approved at</span>
                      <span className="text-sm text-gray-900 dark:text-white">{formatDate(selectedAdjustment.approvedAt!)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedAdjustment(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
              {selectedAdjustment.status === "pending" && (
                <>
                  <button
                    onClick={() => handleReject(selectedAdjustment.id)}
                    className="flex-1 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedAdjustment.id)}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    Approve
                  </button>
                </>
              )}
              {selectedAdjustment.status === "approved" && (
                <button
                  onClick={() => handleComplete(selectedAdjustment.id)}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Complete Adjustment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
