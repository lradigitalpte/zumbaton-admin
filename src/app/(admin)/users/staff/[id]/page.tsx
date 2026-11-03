"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import SlidePanel from "@/components/ui/SlidePanel";
import StudioMenu from "@/components/ui/StudioMenu";
import StudioDate from "@/components/ui/StudioDate";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { useStaffMember, useInvalidateStaff, type StaffRole, type StaffMember } from "@/hooks/useStaff";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

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

  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin" || isSuperAdmin;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-neutral-950"></div>
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
            className="mt-4 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
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
      {(queryError || mutationError) && (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {queryError instanceof Error ? queryError.message : mutationError || "An error occurred"}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-5">
            {staff.avatarUrl ? (
              <img src={staff.avatarUrl} alt={staff.name} className="h-24 w-24 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-2xl font-semibold text-[#E4F56C]">
                {getInitials(staff.name)}
              </div>
            )}
            <div className="min-w-0 pb-1">
              <button
                onClick={() => router.push("/users/staff")}
                className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400 hover:text-neutral-950 dark:hover:text-white"
              >
                ← Staff
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold uppercase tracking-wide text-neutral-950 dark:text-white sm:text-3xl">
                  {staff.name}
                </h1>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleConfig[staff.role].pill}`}>
                  {roleConfig[staff.role].label}
                </span>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  staff.isActive ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50"
                }`}>
                  {staff.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
                {staff.email}{staff.phone ? ` · ${staff.phone}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setIsEditPanelOpen(true)}
                  className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  Edit Staff
                </button>
                <button
                  onClick={() => setShowStatusPanel(true)}
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
                >
                  {staff.isActive ? "Deactivate" : "Activate"}
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setShowRolePanel(true)}
                    className="rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c]"
                  >
                    Change Role
                  </button>
                )}
                <button
                  onClick={() => setShowPasswordPanel(true)}
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
                >
                  Reset Password
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Personal</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Full Name", staff.name],
              ["Email", staff.email],
              ["Phone", staff.phone || "-"],
              ["Blood Group", staff.bloodGroup || "-"],
              ["Date of Birth", staff.dateOfBirth ? new Date(staff.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "-"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">{label}</dt>
                <dd className="text-sm font-medium text-neutral-950 dark:text-white">{value}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-2 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5 sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">Registration Form</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {staff.physicalFormUrl ? (
                  <a
                    href={`${staff.physicalFormUrl}?cb=${Date.now()}&refresh=${forceRefreshKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                  >
                    View form
                  </a>
                ) : (
                  <span className="text-sm text-neutral-400">None yet</span>
                )}
                <button
                  onClick={() => setIsUploadPanelOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F56C] px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-[#d5e45c]"
                  title={staff.physicalFormUrl ? "Replace physical form" : "Upload physical form"}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {staff.physicalFormUrl ? "Replace" : "Upload"}
                </button>
                {staff.physicalFormUrl && (
                  <button
                    onClick={handleDeletePhysicalForm}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Delete physical form"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Access</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">Role</dt>
              <dd>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleConfig[staff.role].pill}`}>
                  {roleConfig[staff.role].label}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-2 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">Status</dt>
              <dd>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  staff.isActive ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50"
                }`}>
                  {staff.isActive ? "Active" : "Inactive"}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">Created</dt>
              <dd className="text-sm font-medium text-neutral-950 dark:text-white">
                {new Date(staff.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">Updated</dt>
              <dd className="text-sm font-medium text-neutral-950 dark:text-white">
                {staff.updatedAt ? new Date(staff.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "N/A"}
              </dd>
            </div>
          </dl>
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
              <div className="rounded-[22px] border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{mutationError}</p>
              </div>
            )}

            <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
              <p className="font-semibold uppercase tracking-wide">{staff.name}</p>
              <p className="mt-1 text-sm text-white/60">{staff.email}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-white/45">
                Current role <span className="ml-2 text-[#E4F56C]">{roleConfig[staff.role].label}</span>
              </p>
            </div>

            <div>
              <Label htmlFor="role">
                New Role <span className="text-error-500">*</span>
              </Label>
              <StudioMenu
                id="role"
                value={newRole}
                onChange={(role) => setNewRole(role as StaffRole)}
                placeholder="Select a role"
                options={roleOptions}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowRolePanel(false);
                  setMutationError(null);
                  setNewRole(staff.role);
                }}
                className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateRole}
                disabled={updateRoleMutation.isPending || newRole === staff.role}
                className="flex-1 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
              </button>
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
              <div className="rounded-[22px] border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{mutationError}</p>
              </div>
            )}

            <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{staff.name}</p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">{staff.email}</p>
            </div>

            <button
              type="button"
              onClick={() => setNewStatus(!newStatus)}
              className={`flex w-full items-center justify-between rounded-[22px] px-4 py-4 text-left ${
                newStatus ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/70"
              }`}
            >
              <span className="text-sm font-semibold">
                {newStatus ? "Staff member is active" : "Staff member is inactive"}
              </span>
              <span className={`flex h-7 w-12 items-center rounded-full p-1 ${newStatus ? "bg-neutral-950" : "bg-neutral-300"}`}>
                <span className={`h-5 w-5 rounded-full bg-white transition ${newStatus ? "translate-x-5" : ""}`} />
              </span>
            </button>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowStatusPanel(false);
                  setMutationError(null);
                  setNewStatus(staff.isActive);
                }}
                className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                disabled={updateStatusMutation.isPending || newStatus === staff.isActive}
                className="flex-1 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {updateStatusMutation.isPending ? "Updating..." : newStatus ? "Activate" : "Deactivate"}
              </button>
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
              <div className="rounded-[22px] border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{mutationError}</p>
              </div>
            )}

            <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{staff.name}</p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">{staff.email}</p>
            </div>

            <div>
              <Label htmlFor="password">
                New Password <span className="text-error-500">*</span>
              </Label>
              <Input
                className={fieldClass}
                id="password"
                type="password"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-white/45">
                Minimum 8 characters. The staff member will need to use this password to sign in.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordPanel(false);
                  setMutationError(null);
                  setNewPassword("");
                }}
                className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending || !newPassword || newPassword.length < 8}
                className="flex-1 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </button>
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
          <div className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
              {staff?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{staff?.name}</div>
              <div className="text-sm text-neutral-500 dark:text-white/50">{staff?.email}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="physicalFormFile">Select File</Label>
            <input
              id="physicalFormFile"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handlePhysicalFormFileChange}
              className="mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-950 file:mr-4 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#E4F56C] focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-white/45">
              Accepted formats: PDF, JPEG, PNG, WebP. Maximum file size: 10MB.
            </p>
            {physicalFormFile && (
              <div className="mt-2 rounded-[22px] border border-neutral-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                <p className="truncate text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
                  {physicalFormFile.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {(physicalFormFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>

          {staff?.physicalFormUrl && (
            <div className="rounded-[22px] bg-[#E4F56C]/40 p-4 text-sm text-neutral-950">
              Uploading a new file will replace the existing physical form.
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsUploadPanelOpen(false);
                setPhysicalFormFile(null);
              }}
              className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadPhysicalForm}
              disabled={!physicalFormFile || isUploading}
              className="flex-1 rounded-full bg-[#E4F56C] px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? "Uploading..." : "Upload Form"}
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
          <div className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-[#E4F56C]">
              {staff?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{staff?.name}</div>
              <div className="text-sm text-neutral-500 dark:text-white/50">{staff?.email}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="editName">
              Full Name <span className="text-error-500">*</span>
            </Label>
            <Input
              className={fieldClass}
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
              className={fieldClass}
              id="editEmail"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editPhone">Phone Number</Label>
            <Input
              className={fieldClass}
              id="editPhone"
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="editDateOfBirth">Date of Birth</Label>
            <StudioDate
              id="editDateOfBirth"
              block
              clearable
              ariaLabel="Date of birth"
              placeholder="Date of birth"
              value={editForm.dateOfBirth}
              onChange={(value) => setEditForm({ ...editForm, dateOfBirth: value })}
            />
          </div>

          <div>
            <Label htmlFor="editBloodGroup">Blood Group</Label>
            <StudioMenu
              id="editBloodGroup"
              value={editForm.bloodGroup}
              onChange={(bloodGroup) => setEditForm({ ...editForm, bloodGroup })}
              placeholder="Select blood group"
              options={bloodGroupOptions}
            />
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
              className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateStaff}
              disabled={!editForm.name || !editForm.email || isUpdating}
              className="flex-1 rounded-full bg-[#E4F56C] px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-[#d5e45c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating ? "Updating..." : "Update Staff"}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}

