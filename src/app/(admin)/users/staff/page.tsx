"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
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
  <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden animate-pulse">
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

const roleConfig: Record<StaffRole, { label: string; color: string; bgColor: string; description: string }> = {
  super_admin: {
    label: "Super Admin",
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    description: "Full system access, user management, system settings",
  },
  admin: {
    label: "Admin",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    description: "Day-to-day operations, reports, user management",
  },
  staff: {
    label: "Staff",
    color: "text-indigo-700 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    description: "General staff access, bookings, attendance",
  },
  receptionist: {
    label: "Reception",
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    description: "Bookings, check-ins, customer service",
  },
  instructor: {
    label: "Instructor",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    description: "Class management, attendance, student info",
  },
};


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

  const getRoleColor = (role: StaffRole) => {
    switch (role) {
      case "super_admin":
        return "from-purple-500 to-purple-600";
      case "admin":
        return "from-blue-500 to-blue-600";
      case "staff":
        return "from-indigo-500 to-indigo-600";
      case "receptionist":
        return "from-emerald-500 to-emerald-600";
      case "instructor":
        return "from-amber-500 to-amber-600";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Staff Management" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage internal users and their access permissions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Refresh data"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreatePanel(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {(queryError || createError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {queryError instanceof Error ? queryError.message : createError || "An error occurred"}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Staff</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Super Admins</p>
          <p className="text-2xl font-bold text-purple-600">{stats.superAdmins}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Admins</p>
          <p className="text-2xl font-bold text-blue-600">{stats.admins}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Staff</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.staff}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Reception</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.reception}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Instructors</p>
          <p className="text-2xl font-bold text-amber-600">{stats.instructors}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as StaffRole | "all")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="receptionist">Reception</option>
              <option value="instructor">Instructor</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (
        <StaffTableSkeleton />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Staff Member</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Last Login</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      {loading ? "Loading..." : "No staff members found"}
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${getRoleColor(staff.role)} text-sm font-semibold text-white`}>
                            {staff.avatarUrl ? (
                              <img src={staff.avatarUrl} alt={staff.name} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              getInitials(staff.name)
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{staff.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{staff.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${roleConfig[staff.role].bgColor} ${roleConfig[staff.role].color}`}>
                          {roleConfig[staff.role].label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          staff.isActive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                            : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${staff.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                          {staff.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatLastLogin(staff.lastLogin)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewStaff(staff.id)}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Role Permissions Overview</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(["super_admin", "admin", "staff", "receptionist", "instructor"] as StaffRole[]).map((role) => (
            <div key={role} className={`p-4 rounded-xl ${roleConfig[role].bgColor}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-semibold ${roleConfig[role].color}`}>{roleConfig[role].label}</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{roleConfig[role].description}</p>
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
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
            </div>
          )}

          <div>
            <Label htmlFor="name">
              Full Name <span className="text-error-500">*</span>
            </Label>
            <Input
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
            <select
              id="role"
              value={newStaff.role}
              onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as StaffRole })}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              <option value="receptionist">Reception</option>
              <option value="instructor">Instructor</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {roleConfig[newStaff.role].description}
            </p>
          </div>

          <div>
            <Label htmlFor="password">
              Temporary Password <span className="text-error-500">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter temporary password (min 8 characters)"
              value={newStaff.password}
              onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Minimum 8 characters. An email with these credentials will be sent to the staff member. They can change their password after signing in.
            </p>
          </div>

          <div>
            <Label htmlFor="dateOfBirth">
              Date of Birth
            </Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={newStaff.dateOfBirth}
              onChange={(e) => setNewStaff({ ...newStaff, dateOfBirth: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="bloodGroup">
              Blood Group
            </Label>
            <select
              id="bloodGroup"
              value={newStaff.bloodGroup}
              onChange={(e) => setNewStaff({ ...newStaff, bloodGroup: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              <option value="">Select blood group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <div>
            <Label htmlFor="physicalForm">
              Physical Form (Registration Form)
            </Label>
            <input
              id="physicalForm"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handlePhysicalFormChange}
              className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:file:bg-brand-600 dark:file:hover:bg-brand-700"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Accepted formats: PDF, JPEG, PNG, WebP. Maximum file size: 10MB.
            </p>
            {physicalFormUrl && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  ✓ File uploaded successfully
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={() => {
                setShowCreatePanel(false);
                setCreateError(null);
              }}
              className="flex-1"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStaff}
              className="flex-1"
              disabled={!newStaff.name || !newStaff.email || !newStaff.password || newStaff.password.length < 8 || isCreating}
            >
              {isCreating ? "Creating..." : "Create Staff Member"}
            </Button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
