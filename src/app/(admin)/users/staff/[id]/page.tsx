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
import { RefreshCw, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const toast = useToast();

  // Use React Query hook with caching - automatically handles loading, error, and data
  const { data: staff, isLoading: loading, error: queryError, refetch } = useStaffMember(staffId);
  
  // Separate state for form/mutation errors
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
  const [physicalFormFile, setPhysicalFormFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    bloodGroup: "",
  });

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
      setEditForm({
        name: staff.name || "",
        email: staff.email || "",
        phone: staff.phone || "",
        dateOfBirth: staff.dateOfBirth ? new Date(staff.dateOfBirth).toISOString().split('T')[0] : "",
        bloodGroup: staff.bloodGroup || "",
      });
    }
  }, [staff]);

  // Manual refresh function - invalidates cache and refetches
  const handleRefresh = () => {
    invalidateDetail(staffId);
    refetch();
  };

  const handlePhysicalFormFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.showToast('Invalid file type. Please upload a PDF, JPEG, PNG, or WebP file.', 'error');
        return;
      }
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.showToast('File size too large. Maximum size is 10MB.', 'error');
        return;
      }
      setPhysicalFormFile(file);
    }
  };

  const handleUploadPhysicalForm = async () => {
    if (!physicalFormFile) {
      toast.showToast('Please select a file to upload', 'error');
      return;
    }

    setIsUploading(true);
    try {
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to upload files');
      }

      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', physicalFormFile);
      formData.append('userId', staffId);

      const uploadResponse = await fetch('/api/users/upload-physical-form', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.error?.message || 'Failed to upload file');
      }

      // Step 2: Update staff profile with the physical form URL
      const updateResponse = await fetch(`/api/users/${staffId}/physical-form`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          physicalFormUrl: uploadResult.data.url,
        }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.success) {
        throw new Error(updateResult.error?.message || 'Failed to update staff profile');
      }

      toast.showToast('Physical form uploaded successfully', 'success');
      setIsUploadPanelOpen(false);
      setPhysicalFormFile(null);
      
      // Optimistically update UI immediately
      setForceRefreshKey(prev => prev + 1);
      
      // Wait a moment for the API to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: ['staff', 'detail', staffId],
        exact: true,
      });
      
      // Invalidate all staff queries
      invalidateDetail(staffId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['staff', 'detail', staffId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error uploading physical form:', error);
      toast.showToast(error.message || 'Failed to upload physical form', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhysicalForm = async () => {
    if (!staff?.physicalFormUrl) {
      return;
    }

    if (!confirm('Are you sure you want to delete this physical form? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to delete files');
      }

      const response = await fetch(`/api/users/${staffId}/physical-form`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete physical form');
      }

      // Optimistically update UI immediately
      setForceRefreshKey(prev => prev + 1);
      
      toast.showToast('Physical form deleted successfully', 'success');
      
      // Wait a moment for the API to process the deletion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: ['staff', 'detail', staffId],
        exact: true,
      });
      
      // Invalidate all staff queries
      invalidateDetail(staffId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['staff', 'detail', staffId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      const deleteRefetchResult = await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deleting physical form:', error);
      toast.showToast(error.message || 'Failed to delete physical form', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editForm.name || !editForm.email) {
      toast.showToast('Name and email are required', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to update staff');
      }

      const response = await fetch(`/api/users/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          dateOfBirth: editForm.dateOfBirth || null,
          bloodGroup: editForm.bloodGroup || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || result.message || 'Failed to update staff');
      }

      toast.showToast('Staff updated successfully', 'success');
      setIsEditPanelOpen(false);
      
      // Optimistically update UI immediately
      setForceRefreshKey(prev => prev + 1);
      
      // Wait a moment for the API to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: ['staff', 'detail', staffId],
        exact: true,
      });
      
      // Invalidate all staff queries
      invalidateDetail(staffId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['staff', 'detail', staffId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating staff:', error);
      toast.showToast(error.message || 'Failed to update staff', 'error');
    } finally {
      setIsUpdating(false);
    }
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
                onClick={() => setIsEditPanelOpen(true)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                Edit Staff
              </button>
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
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">
                    {staff.dateOfBirth 
                      ? new Date(staff.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      : "-"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Blood Group</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{staff.bloodGroup || "-"}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Registration Form</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {staff.physicalFormUrl ? (
                      <>
                        <a
                          href={`${staff.physicalFormUrl}?cb=${Date.now()}&refresh=${forceRefreshKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          View Registration Form
                        </a>
                        <button
                          onClick={() => setIsUploadPanelOpen(true)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Replace physical form"
                        >
                          <Upload className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleDeletePhysicalForm}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Delete physical form"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                        <button
                          onClick={() => setIsUploadPanelOpen(true)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Upload physical form"
                        >
                          <Upload className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </dd>
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

      {/* Physical Form Upload Panel */}
      <SlidePanel
        isOpen={isUploadPanelOpen}
        onClose={() => {
          setIsUploadPanelOpen(false);
          setPhysicalFormFile(null);
        }}
        title="Upload Physical Form"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-lg font-semibold text-white">
              {staff?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{staff?.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{staff?.email}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="physicalFormFile">Select File</Label>
            <input
              id="physicalFormFile"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handlePhysicalFormFileChange}
              className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:file:bg-brand-600 dark:file:hover:bg-brand-700"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Accepted formats: PDF, JPEG, PNG, WebP. Maximum file size: 10MB.
            </p>
            {physicalFormFile && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {physicalFormFile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(physicalFormFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {staff?.physicalFormUrl && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> Uploading a new file will replace the existing physical form.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsUploadPanelOpen(false);
                setPhysicalFormFile(null);
              }}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadPhysicalForm}
              disabled={!physicalFormFile || isUploading}
              className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload Form'}
            </button>
          </div>
        </div>
      </SlidePanel>

      {/* Edit Staff Panel */}
      <SlidePanel
        isOpen={isEditPanelOpen}
        onClose={() => {
          setIsEditPanelOpen(false);
          // Reset form to current staff data
          if (staff) {
            setEditForm({
              name: staff.name || "",
              email: staff.email || "",
              phone: staff.phone || "",
              dateOfBirth: staff.dateOfBirth ? new Date(staff.dateOfBirth).toISOString().split('T')[0] : "",
              bloodGroup: staff.bloodGroup || "",
            });
          }
        }}
        title="Edit Staff"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-lg font-semibold text-white">
              {staff?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{staff?.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{staff?.email}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="editName">
              Full Name <span className="text-error-500">*</span>
            </Label>
            <Input
              id="editName"
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editEmail">
              Email Address <span className="text-error-500">*</span>
            </Label>
            <Input
              id="editEmail"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editPhone">Phone Number</Label>
            <Input
              id="editPhone"
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editDateOfBirth">Date of Birth</Label>
            <Input
              id="editDateOfBirth"
              type="date"
              value={editForm.dateOfBirth}
              onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editBloodGroup">Blood Group</Label>
            <select
              id="editBloodGroup"
              value={editForm.bloodGroup}
              onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
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

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsEditPanelOpen(false);
                if (staff) {
                  setEditForm({
                    name: staff.name || "",
                    email: staff.email || "",
                    phone: staff.phone || "",
                    dateOfBirth: staff.dateOfBirth ? new Date(staff.dateOfBirth).toISOString().split('T')[0] : "",
                    bloodGroup: staff.bloodGroup || "",
                  });
                }
              }}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateStaff}
              disabled={!editForm.name || !editForm.email || isUpdating}
              className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update Staff'}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}

