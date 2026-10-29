"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import SlidePanel from "@/components/ui/SlidePanel";
import StudioMenu from "@/components/ui/StudioMenu";
import StudioDate from "@/components/ui/StudioDate";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { useStaff, useInvalidateStaff, type StaffRole, type StaffMember } from "@/hooks/useStaff";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";

// Skeleton Components
const StatCardSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
      <div>
        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  </div>
);

const StaffCardSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="flex items-start gap-4">
      <div className="h-14 w-14 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
        <div className="flex items-center gap-4">
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  </div>
);

const StaffTableSkeleton = () => (
  <div className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 animate-pulse">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th className="px-6 py-4 text-left"><div className="h-3 w-24 bg-gray-200 dark:bg-gray-600 rounded"></div></th>
            <th className="px-6 py-4 text-left"><div className="h-3 w-12 bg-gray-200 dark:bg-gray-600 rounded"></div></th>
            <th className="px-6 py-4 text-left"><div className="h-3 w-14 bg-gray-200 dark:bg-gray-600 rounded"></div></th>
            <th className="px-6 py-4 text-left"><div className="h-3 w-20 bg-gray-200 dark:bg-gray-600 rounded"></div></th>
            <th className="px-6 py-4 text-right"><div className="h-3 w-16 bg-gray-200 dark:bg-gray-600 rounded ml-auto"></div></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {[...Array(6)].map((_, i) => (
            <tr key={i}>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  <div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                    <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
              <td className="px-6 py-4"><div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
              <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
              <td className="px-6 py-4">
                <div className="flex justify-end gap-2">
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

type Status = "active" | "inactive";
const LOADING_TIMEOUT = 15000; // 15 seconds

const fieldClass =
  "!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5";

const roleConfig: Record<StaffRole, { label: string; pill: string; description: string }> = {
  super_admin: {
    label: "Super Admin",
    pill: "bg-neutral-950 text-[#E4F56C]",
    description: "Full system access, user management, system settings",
  },
  admin: {
    label: "Admin",
    pill: "bg-[#E4F56C] text-neutral-950",
    description: "Day-to-day operations, reports, user management",
  },
  staff: {
    label: "Staff",
    pill: "bg-neutral-100 text-neutral-950 dark:bg-white/10 dark:text-white",
    description: "General staff access, bookings, attendance",
  },
  receptionist: {
    label: "Reception",
    pill: "border border-neutral-200 bg-white text-neutral-950 dark:border-white/15 dark:bg-transparent dark:text-white",
    description: "Bookings, check-ins, customer service",
  },
  instructor: {
    label: "Instructor",
    pill: "bg-neutral-800 text-white",
    description: "Class management, attendance, student info",
  },
};

const roleOptions = (Object.keys(roleConfig) as StaffRole[]).map((role) => ({
  value: role,
  label: roleConfig[role].label,
  hint: roleConfig[role].description,
}));

const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => ({
  value: group,
  label: group,
}));


export default function StaffManagementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const { invalidateAll } = useInvalidateStaff();
  
  // Loading timeout state
  const [isLoadingTakingTooLong, setIsLoadingTakingTooLong] = useState(false);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);

  // Use React Query hook with caching - automatically handles loading, error, and data
  const { data: staffMembers = [], isLoading: loading, error: queryError, refetch } = useStaff({
    searchQuery: searchQuery || undefined,
    statusFilter,
    roleFilter,
  }, {
    cacheBuster: forceRefreshKey, // Include cacheBuster to force refresh
  });
  
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
  
  // Separate state for form/create errors
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const toast = useToast();

  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    phone: "",
    role: "receptionist" as StaffRole,
    password: "",
    dateOfBirth: "",
    bloodGroup: "",
    physicalForm: null as File | null,
  });
  const [physicalFormUrl, setPhysicalFormUrl] = useState<string | null>(null);

  // Manual refresh function - invalidates cache and refetches
  const handleRefresh = () => {
    setIsLoadingTakingTooLong(false);
    invalidateAll();
    refetch();
  };

  const handlePhysicalFormChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setNewStaff({ ...newStaff, physicalForm: file });
    setCreateError(null);

    // Upload file immediately using fetch (FormData needs to be sent without JSON.stringify)
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to upload files');
      }

      const response = await fetch('/api/users/upload-physical-form', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to upload physical form');
      }

      const data = await response.json();
      if (data.success && data.data?.url) {
        setPhysicalFormUrl(data.data.url);
      } else {
        throw new Error('Failed to upload physical form');
      }
    } catch (error) {
      console.error('Error uploading physical form:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to upload physical form');
      setNewStaff({ ...newStaff, physicalForm: null });
    }
  };

  // Filter staff by role
  const filteredStaff = useMemo(() => {
    return staffMembers.filter((staff) => {
      const matchesSearch =
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || staff.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? staff.isActive : !staff.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staffMembers, searchQuery, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: staffMembers.length,
      active: staffMembers.filter((s) => s.isActive).length,
      superAdmins: staffMembers.filter((s) => s.role === "super_admin").length,
      admins: staffMembers.filter((s) => s.role === "admin").length,
      staff: staffMembers.filter((s) => s.role === "staff").length,
      reception: staffMembers.filter((s) => s.role === "receptionist").length,
      instructors: staffMembers.filter((s) => s.role === "instructor").length,
    };
  }, [staffMembers]);

  const formatLastLogin = (date: string | null | undefined) => {
    if (!date) return "Never";
    try {
      const now = new Date();
      const loginDate = new Date(date);
      const diffMs = now.getTime() - loginDate.getTime();
      
      // Handle invalid dates or future dates
      if (isNaN(diffMs) || diffMs < 0) return "Never";
      
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      // For longer periods, show the date
      return loginDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: loginDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch {
      return "Never";
    }
  };

  const handleCreateStaff = async () => {
    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      setCreateError("Please fill in all required fields");
      return;
    }

    if (newStaff.password.length < 8) {
      setCreateError("Password must be at least 8 characters");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await api.post<{ data: any }>("/api/users", {
        name: newStaff.name,
        email: newStaff.email,
        phone: newStaff.phone || null,
        role: newStaff.role,
        password: newStaff.password || undefined,
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create staff member");
      }

      // Show success message
      const staffName = newStaff.name;
      toast.showToast(`Staff member "${staffName}" created successfully! An email with their credentials has been sent to ${newStaff.email}.`, "success");

      // Reset form and close modal
      setNewStaff({
        name: "",
        email: "",
        phone: "",
        role: "receptionist",
        password: "",
        dateOfBirth: "",
        bloodGroup: "",
        physicalForm: null,
      });
      setPhysicalFormUrl(null);
      setShowCreatePanel(false);
      setCreateError(null);
      
      // Increment refresh key to force new query
      setForceRefreshKey(prev => prev + 1);
      
      // Wait a moment for the API to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Invalidate and refetch staff list to show new member
      invalidateAll();
      
      // Force refetch with cache-busting
      await refetch();
      
      // Increment again after refetch to ensure UI updates
      setForceRefreshKey(prev => prev + 1);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create staff member");
      console.error("Error creating staff:", err);
      toast.showToast(err.message || "Failed to create staff member", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewStaff = (staffId: string) => {
    router.push(`/users/staff/${staffId}`);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
            Staff{" "}
            <span className="inline-flex h-7 w-9 translate-y-[-1px] items-center justify-center rounded-full bg-[#E4F56C] align-middle text-neutral-950">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
            Manage internal users and their access permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreatePanel(true)}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            <span className="text-base leading-none">+</span>
            Add Staff Member
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {(queryError || createError) && (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {queryError instanceof Error ? queryError.message : createError || "An error occurred"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        {[
          { label: "Total Staff", value: stats.total, tone: "white" },
          { label: "Active", value: stats.active, tone: "lime" },
          { label: "Super Admins", value: stats.superAdmins, tone: "black" },
          { label: "Admins", value: stats.admins, tone: "white" },
          { label: "Staff", value: stats.staff, tone: "white" },
          { label: "Reception", value: stats.reception, tone: "white" },
          { label: "Instructors", value: stats.instructors, tone: "white" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={
              stat.tone === "lime"
                ? "rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-4 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]"
                : stat.tone === "black"
                ? "rounded-[28px] border border-neutral-950 bg-neutral-950 p-4 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]"
                : "rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800"
            }
          >
            <p className={`text-[11px] font-medium uppercase tracking-[0.14em] ${stat.tone === "black" ? "text-white/50" : stat.tone === "lime" ? "text-neutral-950/60" : "text-neutral-400"}`}>
              {stat.label}
            </p>
            <p className={`mt-2 text-3xl font-semibold tracking-tight ${stat.tone === "white" ? "text-neutral-950 dark:text-white" : ""}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-11 pr-4 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {([{ value: "all", label: "All Roles" }, ...roleOptions.map((role) => ({ value: role.value, label: role.label }))] as { value: StaffRole | "all"; label: string }[]).map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setRoleFilter(role.value)}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold ${
                  roleFilter === role.value
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ] as { value: "all" | "active" | "inactive"; label: string }[]).map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={() => setStatusFilter(status.value)}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold ${
                  statusFilter === status.value
                    ? "bg-[#E4F56C] text-neutral-950"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (
        <StaffTableSkeleton />
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-neutral-200/80 dark:border-white/10">
                  <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Staff Member</th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Role</th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Status</th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Last Login</th>
                  <th className="px-6 py-4 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-500">
                      No staff members found
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => (
                    <tr key={staff.id} className="border-b border-neutral-100 last:border-0 dark:border-white/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {staff.avatarUrl ? (
                            <img src={staff.avatarUrl} alt={staff.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
                              {getInitials(staff.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{staff.name}</p>
                            <p className="truncate text-sm text-neutral-500 dark:text-white/50">{staff.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${roleConfig[staff.role].pill}`}>
                          {roleConfig[staff.role].label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          staff.isActive
                            ? "bg-[#E4F56C] text-neutral-950"
                            : "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50"
                        }`}>
                          {staff.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-500 dark:text-white/50">
                        {formatLastLogin(staff.lastLogin)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleViewStaff(staff.id)}
                            className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Legend */}
      <div className="rounded-[28px] border border-neutral-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
        <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Role Permissions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(["super_admin", "admin", "staff", "receptionist", "instructor"] as StaffRole[]).map((role) => (
            <div key={role} className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleConfig[role].pill}`}>
                {roleConfig[role].label}
              </span>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-white/50">{roleConfig[role].description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add Staff Slide Panel */}
      <SlidePanel
        isOpen={showCreatePanel}
        onClose={() => {
          setShowCreatePanel(false);
          setCreateError(null);
          setNewStaff({
            name: "",
            email: "",
            phone: "",
            role: "receptionist",
            password: "",
            dateOfBirth: "",
            bloodGroup: "",
            physicalForm: null,
          });
          setPhysicalFormUrl(null);
        }}
        title="Add Staff Member"
        size="md"
      >
        <div className="space-y-6">
          {createError && (
            <div className="rounded-[22px] border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
            </div>
          )}

          <div>
            <Label htmlFor="name">
              Full Name <span className="text-error-500">*</span>
            </Label>
            <Input
              className={fieldClass}
              id="name"
              type="text"
              placeholder="John Doe"
              value={newStaff.name}
              onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="email">
              Email Address <span className="text-error-500">*</span>
            </Label>
            <Input
              className={fieldClass}
              id="email"
              type="email"
              placeholder="john.doe@zumbathon.com"
              value={newStaff.email}
              onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="phone">
              Phone Number <span className="text-error-500">*</span>
            </Label>
            <Input
              className={fieldClass}
              id="phone"
              type="tel"
              placeholder="+65 1234 5678"
              value={newStaff.phone}
              onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="role">
              Role <span className="text-error-500">*</span>
            </Label>
            <StudioMenu
              id="role"
              value={newStaff.role}
              onChange={(role) => setNewStaff({ ...newStaff, role: role as StaffRole })}
              placeholder="Select a role"
              options={roleOptions}
            />
          </div>

          <div>
            <Label htmlFor="password">
              Temporary Password <span className="text-error-500">*</span>
            </Label>
            <Input
              className={fieldClass}
              id="password"
              type="password"
              placeholder="Enter temporary password (min 8 characters)"
              value={newStaff.password}
              onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
            />
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-white/45">
              Minimum 8 characters. An email with these credentials will be sent to the staff member. They can change their password after signing in.
            </p>
          </div>

          <div>
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <StudioDate
              id="dateOfBirth"
              block
              clearable
              ariaLabel="Date of birth"
              placeholder="Date of birth"
              value={newStaff.dateOfBirth}
              onChange={(value) => setNewStaff({ ...newStaff, dateOfBirth: value })}
            />
          </div>

          <div>
            <Label htmlFor="bloodGroup">Blood Group</Label>
            <StudioMenu
              id="bloodGroup"
              value={newStaff.bloodGroup}
              onChange={(bloodGroup) => setNewStaff({ ...newStaff, bloodGroup })}
              placeholder="Select blood group"
              options={bloodGroupOptions}
            />
          </div>

          <div>
            <Label htmlFor="physicalForm">Physical Form (Registration Form)</Label>
            <input
              id="physicalForm"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handlePhysicalFormChange}
              className="mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-950 file:mr-4 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#E4F56C] focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-white/45">
              Accepted formats: PDF, JPEG, PNG, WebP. Maximum file size: 10MB.
            </p>
            {physicalFormUrl && (
              <div className="mt-2 rounded-[22px] bg-[#E4F56C]/40 p-3 text-sm font-semibold text-neutral-950">
                File uploaded
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreatePanel(false);
                setCreateError(null);
              }}
              className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateStaff}
              disabled={!newStaff.name || !newStaff.email || !newStaff.password || newStaff.password.length < 8 || isCreating}
              className="flex-1 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCreating ? "Creating..." : "Create Staff Member"}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
