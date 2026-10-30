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
    return new Date(dateStr).toLocaleString("en-SG", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Singapore",
    });
  };

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
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const statusTabs: { value: string; label: string; hint: string; count: number }[] = [
    { value: "all", label: "All", hint: "Every adjustment", count: stats.total },
    { value: "pending", label: "Pending", hint: "Waiting for approval", count: stats.pending },
    { value: "approved", label: "Approved", hint: "Ready to apply", count: stats.approved },
    { value: "completed", label: "Completed", hint: "Already on the balance", count: stats.completed },
    { value: "rejected", label: "Rejected", hint: "Declined", count: stats.rejected },
  ];

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

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-5">
        <PageBreadCrumb pageTitle="Token Adjustments" />
        <div className="flex items-center gap-3 py-16 text-sm text-neutral-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent dark:border-white dark:border-t-transparent" />
          Loading adjustments…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-w-0 space-y-5">
        <PageBreadCrumb pageTitle="Token Adjustments" />
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">Couldn’t load adjustments</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageBreadCrumb pageTitle="Token Adjustments" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Token Adjustments</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Manual credits, debits, and corrections. Approve first, then apply them to the balance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreatePanel(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white dark:bg-[#E4F56C] dark:text-neutral-950"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Adjustment
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-gray-800">
          <span className="text-neutral-400">Credits applied</span>{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{stats.totalCredits}</span>
        </div>
        <div className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-gray-800">
          <span className="text-neutral-400">Debits applied</span>{" "}
          <span className="font-semibold text-red-600 dark:text-red-400">-{stats.totalDebits}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statusTabs.map((tab) => {
          const selected = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
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
              <p className="mt-3 text-4xl font-semibold tracking-tight">{tab.count}</p>
              <p className={`mt-1 text-xs ${selected ? "text-neutral-950/70" : "text-neutral-400"}`}>{selected ? "Viewing now" : tab.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-950 dark:border-white/10 dark:bg-gray-900 dark:text-white"
          >
            <option value="all">All types</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
            <option value="correction">Correction</option>
            <option value="promo">Promo</option>
            <option value="refund">Refund</option>
          </select>
          <div className="relative min-w-0 flex-1">
            <Input
              type="text"
              placeholder="Search by name, email, or reason"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {filteredAdjustments.length === 0 ? (
          <div className="px-2 py-14 text-center">
            <h3 className="text-base font-semibold text-neutral-950 dark:text-white">No adjustments found</h3>
            <p className="mt-1 text-sm text-neutral-500">Try another filter, or create a new adjustment.</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100 dark:divide-white/10">
            {filteredAdjustments.map((adj) => {
              const tConfig = typeConfig[adj.type];
              const sConfig = statusConfig[adj.status];
              return (
                <li key={adj.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(adj.userName)}`}>
                    {getInitials(adj.userName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{adj.userName}</p>
                    <p className="truncate text-xs text-neutral-500">{adj.userEmail || "No email"} · {adj.reason}</p>
                    {adj.notes && <p className="truncate text-[11px] text-neutral-400">{adj.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tConfig.bg} ${tConfig.color}`}>{tConfig.label}</span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${sConfig.bg} ${sConfig.color}`}>{sConfig.label}</span>
                  </div>
                  <div className="sm:w-24 sm:text-right">
                    <p className={`text-sm font-semibold ${adj.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {adj.amount > 0 ? `+${adj.amount}` : adj.amount}
                    </p>
                    <p className="text-[11px] text-neutral-400">{formatDate(adj.requestedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedAdjustment(adj)} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5">
                      View
                    </button>
                    {adj.status === "pending" && (
                      <>
                        <button type="button" onClick={() => handleApprove(adj.id)} className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                          Approve
                        </button>
                        <button type="button" onClick={() => handleReject(adj.id)} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">
                          Reject
                        </button>
                      </>
                    )}
                    {adj.status === "approved" && (
                      <button type="button" onClick={() => handleComplete(adj.id)} className="rounded-full bg-[#E4F56C] px-3 py-1.5 text-xs font-semibold text-neutral-950">
                        Apply
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(u.name)} text-xs font-semibold`}>
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
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(selectedUser.name)} text-xs font-semibold`}>
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
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(selectedUser.name)} text-xs font-semibold`}>
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
                className="flex-1 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#E4F56C] dark:text-neutral-950"
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
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getAvatarColor(selectedAdjustment.userName)} font-semibold`}>
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
                    className="flex-1 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-[#E4F56C] dark:text-neutral-950"
                  >
                    Approve
                  </button>
                </>
              )}
              {selectedAdjustment.status === "approved" && (
                <button
                  onClick={() => handleComplete(selectedAdjustment.id)}
                  className="flex-1 rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950"
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
