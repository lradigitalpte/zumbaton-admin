"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useUser, useInvalidateUser, type UserDetail } from "@/hooks/useUser";
import { RefreshCw } from "lucide-react";

const LOADING_TIMEOUT = 15000; // 15 seconds

interface ClassHistory {
  id: string;
  className: string;
  instructor: string;
  date: string;
  time: string;
  status: "attended" | "no-show" | "cancelled";
}

interface TokenTransaction {
  id: string;
  type: "purchase" | "consume" | "hold" | "release" | "adjustment" | "expire";
  amount: number;
  balance: number;
  description: string;
  date: string;
}

// Placeholder for class history (TODO: Fetch from API)
const demoClassHistory: ClassHistory[] = [];

// Placeholder for token transactions (TODO: Fetch from API)
const demoTokenTransactions: TokenTransaction[] = [];

type TabType = "overview" | "classes" | "tokens" | "notes";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { invalidateDetail } = useInvalidateUser();
  
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isAdjustPanelOpen, setIsAdjustPanelOpen] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [isLoadingTakingTooLong, setIsLoadingTakingTooLong] = useState(false);

  // Fetch user detail with React Query caching
  const { data: user, isLoading: loading, error: queryError, refetch } = useUser(userId);

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

  // Manual refresh function
  const handleRefresh = () => {
    setIsLoadingTakingTooLong(false);
    invalidateDetail(userId);
    refetch();
  };

  // Show loading state
  if (loading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="User Details" />
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {isLoadingTakingTooLong 
              ? "Loading is taking longer than expected..." 
              : "Loading user details..."}
          </p>
          {isLoadingTakingTooLong && (
            <button
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Show error state
  if (queryError || !user) {
    return (
      <div>
        <PageBreadCrumb pageTitle="User Details" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
            Failed to load user
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {queryError instanceof Error ? queryError.message : "User not found"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/users")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const getStatusStyle = (status: UserDetail["status"]) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "flagged":
        return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400";
      case "inactive":
        return "bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-500/10 dark:text-gray-400";
      default:
        return "bg-gray-50 text-gray-600 ring-gray-500/20";
    }
  };

  const getClassStatusStyle = (status: ClassHistory["status"]) => {
    switch (status) {
      case "attended":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "no-show":
        return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
      case "cancelled":
        return "bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  const getTransactionTypeStyle = (type: TokenTransaction["type"]) => {
    switch (type) {
      case "purchase":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "consume":
        return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
      case "hold":
        return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
      case "release":
        return "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400";
      case "adjustment":
        return "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400";
      case "expire":
        return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  const handleAdjustTokens = () => {
    console.log("Adjusting tokens:", {
      userId: user.id,
      amount: parseInt(adjustmentAmount),
      reason: adjustmentReason,
    });
    setIsAdjustPanelOpen(false);
    setAdjustmentAmount("");
    setAdjustmentReason("");
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "classes", label: "Class History" },
    { key: "tokens", label: "Token History" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div>
      <PageBreadCrumb pageTitle="User Details" />

      {/* Back button and actions */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/users")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Users
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAdjustPanelOpen(true)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Adjust Tokens
          </button>
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
            Edit User
          </button>
        </div>
      </div>

      {/* User Header Card */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-xl font-bold text-white">
              {getInitials(user.name)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusStyle(
                    user.status
                  )}`}
                >
                  {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </span>
              </div>
              <div className="mt-1 flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400 sm:flex-row sm:gap-4">
                <span>{user.email}</span>
                <span>{user.phone}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className={`text-2xl font-bold ${user.tokenBalance === 0 ? "text-red-600" : user.tokenBalance < 3 ? "text-amber-600" : "text-emerald-600"}`}>
                {user.tokenBalance}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Tokens</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{user.totalClasses}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Classes</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${user.noShows >= 3 ? "text-red-600" : user.noShows > 0 ? "text-amber-600" : "text-gray-900 dark:text-white"}`}>
                {user.noShows}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">No-Shows</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 dark:bg-brand-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Personal Information */}
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Personal Information</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Full Name</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Email</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Phone</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{user.phone || "-"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Address</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-48">
                      {user.address || "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Emergency Contact</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-48">
                      {user.emergencyContact || "-"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Membership Information */}
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Membership Information</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Member Since</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(user.joinedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Last Active</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(user.lastActive).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
                    <dd>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusStyle(
                          user.status
                        )}`}
                      >
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Token Balance</dt>
                    <dd className={`text-sm font-bold ${user.tokenBalance === 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {user.tokenBalance} tokens
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Attendance Rate</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.totalClasses > 0 
                        ? Math.round(((user.totalClasses - user.noShows) / user.totalClasses) * 100)
                        : 0}%
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Quick Stats */}
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700 md:col-span-2">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Activity Summary</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{user.totalClasses}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Total Classes</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <div className="text-2xl font-bold text-emerald-600">{user.totalClasses - user.noShows}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Attended</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <div className={`text-2xl font-bold ${user.noShows > 0 ? "text-amber-600" : "text-gray-900 dark:text-white"}`}>{user.noShows}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">No-Shows</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <div className="text-2xl font-bold text-brand-600">{user.tokenBalance}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Current Tokens</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === "classes" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Class
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Instructor
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date & Time
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {demoClassHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No class history available yet.
                    </td>
                  </tr>
                ) : (
                  demoClassHistory.map((cls) => (
                    <tr key={cls.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-medium text-gray-900 dark:text-white">{cls.className}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {cls.instructor}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(cls.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{cls.time}</div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getClassStatusStyle(
                            cls.status
                          )}`}
                        >
                          {cls.status.charAt(0).toUpperCase() + cls.status.slice(1).replace("-", " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tokens Tab */}
        {activeTab === "tokens" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Description
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {demoTokenTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No token transactions yet.
                    </td>
                  </tr>
                ) : (
                  demoTokenTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTransactionTypeStyle(
                          tx.type
                        )}`}
                      >
                        {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {tx.description}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <span className={`font-semibold ${tx.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                      {tx.balance}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Admin Notes</h3>
              <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                Add Note
              </button>
            </div>
            {user.notes ? (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-sm text-gray-700 dark:text-gray-300">{user.notes}</p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Last updated: March 10, 2024
                </p>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">No notes yet for this user.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Token Adjustment Panel */}
      <SlidePanel
        isOpen={isAdjustPanelOpen}
        onClose={() => {
          setIsAdjustPanelOpen(false);
          setAdjustmentAmount("");
          setAdjustmentReason("");
        }}
        title="Adjust Tokens"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-lg font-semibold text-white">
              {getInitials(user.name)}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Balance</div>
            <div className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
              {user.tokenBalance} <span className="text-lg font-normal text-gray-500">tokens</span>
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Adjustment Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="e.g., 5 or -2"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Use positive numbers to add tokens, negative to remove.
            </p>
          </div>

          <div>
            <Label htmlFor="reason">Reason for Adjustment</Label>
            <textarea
              id="reason"
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              placeholder="Enter reason for this adjustment..."
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
            />
          </div>

          {adjustmentAmount && (
            <div className="rounded-xl border-2 border-dashed border-gray-300 p-4 dark:border-gray-600">
              <div className="text-sm text-gray-500 dark:text-gray-400">New Balance Preview</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {user.tokenBalance + parseInt(adjustmentAmount || "0")}{" "}
                <span className="text-base font-normal text-gray-500">tokens</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsAdjustPanelOpen(false);
                setAdjustmentAmount("");
                setAdjustmentReason("");
              }}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleAdjustTokens}
              disabled={!adjustmentAmount || !adjustmentReason}
              className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply Adjustment
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}