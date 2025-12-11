"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { useStaffMember, useInvalidateStaff, type StaffRole, type StaffMember } from "@/hooks/useStaff";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

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

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const staffId = params.id as string;
  const { invalidateAll, invalidateDetail, invalidateList } = useInvalidateStaff();

  // Use React Query hook with caching - automatically handles loading, error, and data
  const { data: staff, isLoading: loading, error: queryError, refetch } = useStaffMember(staffId);
  
  // Separate state for form/mutation errors
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Panels
  const [showRolePanel, setShowRolePanel] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);

  // Form states
  const [newRole, setNewRole] = useState<StaffRole>("receptionist");
  const [newStatus, setNewStatus] = useState(true);
  const [newPassword, setNewPassword] = useState("");

  // Initialize form states when staff data loads
  useEffect(() => {
    if (staff) {
      setNewRole(staff.role);
      setNewStatus(staff.isActive);
    }
  }, [staff]);

  // Manual refresh function - invalidates cache and refetches
  const handleRefresh = () => {
    invalidateDetail(staffId);
    refetch();
  };

  // Mutation for updating role
  const updateRoleMutation = useMutation({
    mutationFn: async (role: StaffRole) => {
      const response = await api.put<{ data: StaffMember }>(`/api/users/${staffId}`, { role });
      if (response.error) {
        throw new Error(response.error.message || "Failed to update role");
      }
      return response.data?.data;
    },
    onSuccess: () => {
      setShowRolePanel(false);
      // Invalidate cache to refresh data
      invalidateDetail(staffId);
      invalidateList(); // Also invalidate list in case user goes back
      refetch();
    },
    onError: (err: Error) => {
      setMutationError(err.message || "Failed to update role");
    },
  });

  const handleUpdateRole = () => {
    if (!staff) return;
    setMutationError(null);
    updateRoleMutation.mutate(newRole);
  };

  // Mutation for updating status
  const updateStatusMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const response = await api.put<{ data: StaffMember }>(`/api/users/${staffId}`, { isActive });
      if (response.error) {
        throw new Error(response.error.message || "Failed to update status");
      }
      return response.data?.data;
    },
    onSuccess: () => {
      setShowStatusPanel(false);
      // Invalidate cache to refresh data
      invalidateDetail(staffId);
      invalidateList(); // Also invalidate list in case user goes back
      refetch();
    },
    onError: (err: Error) => {
      setMutationError(err.message || "Failed to update status");
    },
  });

  const handleUpdateStatus = () => {
    if (!staff) return;
    setMutationError(null);
    updateStatusMutation.mutate(newStatus);
  };

  // Mutation for resetting password
  const resetPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!password) {
        throw new Error("Password is required");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      const response = await api.post(`/api/users/${staffId}/reset-password`, { password });
      if (response.error) {
        throw new Error(response.error.message || "Failed to reset password");
      }
      return response.data;
    },
    onSuccess: () => {
      setNewPassword("");
      setShowPasswordPanel(false);
      setMutationError(null);
    },
    onError: (err: Error) => {
      setMutationError(err.message || "Failed to reset password");
    },
  });

  const handleResetPassword = () => {
    if (!newPassword) {
      setMutationError("Password is required");
      return;
    }
    setMutationError(null);
    resetPasswordMutation.mutate(newPassword);
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

  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin" || isSuperAdmin;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading staff details...</p>
      </div>
    );
  }

  if (queryError && !staff) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Staff Details" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {queryError instanceof Error ? queryError.message : "Failed to load staff member"}
          </p>
          <button
            onClick={() => router.push("/users/staff")}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Back to Staff Management
          </button>
        </div>
      </div>
    );
  }

  if (!staff) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Staff Details" />

      {/* Error Messages */}
      {(queryError || mutationError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {queryError instanceof Error ? queryError.message : mutationError || "An error occurred"}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => router.push("/users/staff")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white w-fit"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Staff Management
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowStatusPanel(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {staff.isActive ? "Deactivate" : "Activate"}
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setShowRolePanel(true)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Change Role
                </button>
              )}
              <button
                onClick={() => setShowPasswordPanel(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Reset Password
              </button>
            </>
          )}
        </div>
      </div>

      {/* Staff Header Card */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br ${getRoleColor(staff.role)} text-xl font-bold text-white`}>
              {staff.avatarUrl ? (
                <img src={staff.avatarUrl} alt={staff.name} className="h-full w-full rounded-full object-cover" />
              ) : (
                getInitials(staff.name)
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{staff.name}</h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleConfig[staff.role].bgColor} ${roleConfig[staff.role].color}`}>
                  {roleConfig[staff.role].label}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  staff.isActive 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${staff.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {staff.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-1 flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400 sm:flex-row sm:gap-4">
                <span>{staff.email}</span>
                {staff.phone && <span>{staff.phone}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Details */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Staff Information</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Personal Information</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Full Name</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{staff.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Email</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{staff.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Phone</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{staff.phone || "-"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Staff Information</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Role</dt>
                  <dd>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleConfig[staff.role].bgColor} ${roleConfig[staff.role].color}`}>
                      {roleConfig[staff.role].label}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
                  <dd>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      staff.isActive 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${staff.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                      {staff.isActive ? "Active" : "Inactive"}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Created At</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(staff.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Last Updated</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">
                    {staff.updatedAt ? new Date(staff.updatedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }) : "N/A"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Change Role Panel */}
      {isSuperAdmin && (
        <SlidePanel
          isOpen={showRolePanel}
          onClose={() => {
            setShowRolePanel(false);
            setMutationError(null);
            setNewRole(staff.role);
          }}
          title="Change Role"
          size="md"
        >
          <div className="space-y-6">
            {mutationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{mutationError}</p>
              </div>
            )}

            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{staff.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{staff.email}</p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Current Role: <span className="font-medium">{roleConfig[staff.role].label}</span>
              </p>
            </div>

            <div>
              <Label htmlFor="role">
                New Role <span className="text-error-500">*</span>
              </Label>
              <select
                id="role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as StaffRole)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                <option value="receptionist">Reception</option>
                <option value="instructor">Instructor</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {roleConfig[newRole].description}
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => {
                  setShowRolePanel(false);
                  setMutationError(null);
                  setNewRole(staff.role);
                }}
                className="flex-1"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateRole}
                className="flex-1"
                disabled={updateRoleMutation.isPending || newRole === staff.role}
              >
                {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
              </Button>
            </div>
          </div>
        </SlidePanel>
      )}

      {/* Change Status Panel */}
      {isAdmin && (
        <SlidePanel
          isOpen={showStatusPanel}
          onClose={() => {
            setShowStatusPanel(false);
            setMutationError(null);
            setNewStatus(staff.isActive);
          }}
          title={staff.isActive ? "Deactivate Staff" : "Activate Staff"}
          size="md"
        >
          <div className="space-y-6">
            {mutationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{mutationError}</p>
              </div>
            )}

            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{staff.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{staff.email}</p>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <input
                type="checkbox"
                id="isActive"
                checked={newStatus}
                onChange={(e) => setNewStatus(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                {newStatus ? "Staff member is active" : "Staff member is inactive"}
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => {
                  setShowStatusPanel(false);
                  setMutationError(null);
                  setNewStatus(staff.isActive);
                }}
                className="flex-1"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatus}
                className="flex-1"
                disabled={updateStatusMutation.isPending || newStatus === staff.isActive}
              >
                {updateStatusMutation.isPending ? "Updating..." : newStatus ? "Activate" : "Deactivate"}
              </Button>
            </div>
          </div>
        </SlidePanel>
      )}

      {/* Reset Password Panel */}
      {isAdmin && (
        <SlidePanel
          isOpen={showPasswordPanel}
          onClose={() => {
            setShowPasswordPanel(false);
            setMutationError(null);
            setNewPassword("");
          }}
          title="Reset Password"
          size="md"
        >
          <div className="space-y-6">
            {mutationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{mutationError}</p>
              </div>
            )}

            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{staff.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{staff.email}</p>
            </div>

            <div>
              <Label htmlFor="password">
                New Password <span className="text-error-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Minimum 8 characters. The staff member will need to use this password to sign in.
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => {
                  setShowPasswordPanel(false);
                  setMutationError(null);
                  setNewPassword("");
                }}
                className="flex-1"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                className="flex-1"
                disabled={resetPasswordMutation.isPending || !newPassword || newPassword.length < 8}
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </SlidePanel>
      )}
    </div>
  );
}

