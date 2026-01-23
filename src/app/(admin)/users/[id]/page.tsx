"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useUser, useInvalidateUser, type UserDetail } from "@/hooks/useUser";
import { RefreshCw, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

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

// Removed placeholder arrays - now using real state

type TabType = "overview" | "classes" | "tokens" | "notes";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { invalidateDetail } = useInvalidateUser();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isAdjustPanelOpen, setIsAdjustPanelOpen] = useState(false);
  const [mode, setMode] = useState<"sell" | "adjust">("sell");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [expiryDays, setExpiryDays] = useState("365"); // Default to 1 year
  const [packages, setPackages] = useState<Array<{ id: string; name: string; tokenCount: number; validityDays: number; priceCents: number; currency: string }>>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [discount, setDiscount] = useState("");
  const [userPackages, setUserPackages] = useState<Array<{ id: string; packageName: string; tokensRemaining: number; expiresAt: string; status: string }>>([]);
  const [isLoadingUserPackages, setIsLoadingUserPackages] = useState(false);
  const [isLoadingTakingTooLong, setIsLoadingTakingTooLong] = useState(false);
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
  const [classHistory, setClassHistory] = useState<ClassHistory[]>([]);
  const [isLoadingClassHistory, setIsLoadingClassHistory] = useState(false);
  const [tokenTransactions, setTokenTransactions] = useState<TokenTransaction[]>([]);
  const [isLoadingTokenTransactions, setIsLoadingTokenTransactions] = useState(false);
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isProcessingTokens, setIsProcessingTokens] = useState(false);
  const toast = useToast();

  // Fetch user detail with React Query caching
  const { data: user, isLoading: loading, error: queryError, refetch } = useUser(userId, forceRefreshKey);

  // Initialize edit form when user data loads
  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
        bloodGroup: user.bloodGroup || "",
      });
      setNotes(user.notes || "");
    }
  }, [user]);

  // Fetch class history when classes tab is active
  useEffect(() => {
    if (activeTab === "classes" && user?.id && !isLoadingClassHistory) {
      setIsLoadingClassHistory(true);
      const bookingsUrl = `/api/bookings?userId=${user.id}&pageSize=100`;
      api.get<{ success: boolean; data: { bookings: Array<{ id: string; class: { title: string; instructor_name: string; scheduled_at: string; duration_minutes: number }; status: string; booked_at: string }> } }>(bookingsUrl)
        .then((response: any) => {
          if (response.error) {
            console.error("Failed to fetch class history:", response.error);
            setClassHistory([]);
            return;
          }
          if (response.data?.success && response.data.data?.bookings) {
            const history: ClassHistory[] = response.data.data.bookings.map((booking: any) => {
              const classDate = new Date(booking.class.scheduled_at);
              const endTime = new Date(classDate.getTime() + (booking.class.duration_minutes * 60000));
              return {
                id: booking.id,
                className: booking.class.title,
                instructor: booking.class.instructor_name || "TBA",
                date: booking.class.scheduled_at,
                time: `${classDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} - ${endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
                status: booking.status === "confirmed" ? "attended" : booking.status === "cancelled" ? "cancelled" : booking.status === "no_show" ? "no-show" : "attended",
              };
            });
            setClassHistory(history);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch class history:", err);
        })
        .finally(() => {
          setIsLoadingClassHistory(false);
        });
    }
  }, [activeTab, user?.id]);

  // Fetch token transactions when tokens tab is active
  useEffect(() => {
    if (activeTab === "tokens" && user?.id && !isLoadingTokenTransactions) {
      setIsLoadingTokenTransactions(true);
      const transactionsUrl = `/api/tokens/transactions?userId=${user.id}&pageSize=100`;
      api.get(transactionsUrl)
        .then((response: any) => {
          if (response.error) {
            console.error("Failed to fetch token transactions:", response.error);
            setTokenTransactions([]);
            return;
          }
          if (response.data?.success && response.data.data?.transactions) {
            const transactions: TokenTransaction[] = response.data.data.transactions.map((tx: any) => ({
              id: tx.id,
              type: tx.transaction_type === "purchase" ? "purchase" : 
                    tx.transaction_type === "attendance-consume" || tx.transaction_type === "no-show-consume" ? "consume" :
                    tx.transaction_type === "expire" ? "expire" :
                    tx.transaction_type === "admin-adjust" ? "adjustment" :
                    tx.transaction_type === "booking-release" ? "release" :
                    tx.transaction_type === "booking-hold" ? "hold" : "adjustment",
              amount: tx.tokens_change,
              balance: tx.tokens_after,
              description: tx.description || "",
              date: tx.created_at,
            }));
            setTokenTransactions(transactions);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch token transactions:", err);
          setTokenTransactions([]);
        })
        .finally(() => {
          setIsLoadingTokenTransactions(false);
        });
    }
  }, [activeTab, user?.id]);

  // Fetch user packages
  useEffect(() => {
    if (user?.id) {
      setIsLoadingUserPackages(true);
      api.get<{ success: boolean; data: { packages: Array<{ id: string; packageName: string; tokensRemaining: number; expiresAt: string; status: string }> } }>(`/api/user-packages?userId=${user.id}&status=active`)
        .then((response) => {
          if (response.error) {
            console.error("Failed to fetch user packages:", response.error);
            return;
          }
          if (response.data?.success && response.data.data?.packages) {
            setUserPackages(
              response.data.data.packages.map((pkg) => ({
                id: pkg.id,
                packageName: pkg.packageName || "Adjustment Package",
                tokensRemaining: pkg.tokensRemaining,
                expiresAt: pkg.expiresAt,
                status: pkg.status,
              }))
            );
          }
        })
        .catch((err) => {
          console.error("Failed to fetch user packages:", err);
        })
        .finally(() => {
          setIsLoadingUserPackages(false);
        });
    }
  }, [user?.id, forceRefreshKey]);

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

  // Fetch packages when panel opens
  useEffect(() => {
    if (isAdjustPanelOpen && mode === "sell") {
      setIsLoadingPackages(true);
      api.get<{ success: boolean; data: { packages: Array<{ id: string; name: string; tokenCount: number; validityDays: number; priceCents: number; currency: string }> } }>("/api/packages?isActive=true&pageSize=100")
        .then((response) => {
          if (response.error) {
            console.error("Failed to fetch packages:", response.error);
            toast.showToast(response.error.message || "Failed to load packages", "error");
            return;
          }
          if (response.data?.success && response.data.data?.packages) {
            setPackages(response.data.data.packages.map((pkg: { id: string; name: string; tokenCount: number; validityDays: number; priceCents: number; currency: string }) => ({
              id: pkg.id,
              name: pkg.name,
              tokenCount: pkg.tokenCount,
              validityDays: pkg.validityDays,
              priceCents: pkg.priceCents,
              currency: pkg.currency || "SGD",
            })));
          }
        })
        .catch((err) => {
          console.error("Failed to fetch packages:", err);
          toast.showToast("Failed to load packages", "error");
        })
        .finally(() => {
          setIsLoadingPackages(false);
        });
    }
  }, [isAdjustPanelOpen, mode, toast]);

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

  const handleSellOrAdjustTokens = async () => {
    if (!user) {
      toast.showToast("User data not available", "error");
      return;
    }

    if (mode === "sell") {
      if (!selectedPackageId) {
        toast.showToast("Please select a package", "error");
        return;
      }
      try {
        const selectedPkg = packages.find((p) => p.id === selectedPackageId);
        const discountPercent = discount ? parseFloat(discount) : 0;
        const originalPrice = selectedPkg ? selectedPkg.priceCents / 100 : 0;
        const discountAmount = (originalPrice * discountPercent) / 100;
        const finalPrice = Math.max(0, originalPrice - discountAmount);
        
        // Build reason with discount info if applicable
        let reasonText = adjustmentReason || "";
        if (discountPercent > 0) {
          const discountInfo = `Discount: ${discountPercent}% ($${discountAmount.toFixed(2)} off) - Original: $${originalPrice.toFixed(2)}, Final: $${finalPrice.toFixed(2)}`;
          reasonText = reasonText ? `${reasonText} | ${discountInfo}` : discountInfo;
        }

        const response = await api.post<{ success: boolean; data: { tokensAdded: number }; error?: { message: string } }>("/api/user-packages", {
          userId: user.id,
          packageId: selectedPackageId,
          paymentId: `admin-sale-${Date.now()}${discountPercent > 0 ? `-discount-${discountPercent}pct` : ""}`,
        });
        if (response.error) {
          throw new Error(response.error.message || "Failed to sell package");
        }
        if (response.data?.success) {
          const discountMsg = discountPercent > 0 ? ` (with ${discountPercent}% discount - $${discountAmount.toFixed(2)} off)` : "";
          toast.showToast(`Package sold successfully! ${response.data.data.tokensAdded} tokens added.${discountMsg}`, "success");
          setIsAdjustPanelOpen(false);
          setMode("sell");
          setSelectedPackageId("");
          setAdjustmentReason("");
          setDiscount("");
          // Refresh user data
          setForceRefreshKey(prev => prev + 1);
          invalidateDetail(user.id);
          queryClient.invalidateQueries({ queryKey: ["user", user.id] });
          router.refresh();
        } else {
          throw new Error("Failed to sell package");
        }
      } catch (error) {
        console.error("Error selling package:", error);
        toast.showToast(error instanceof Error ? error.message : "Failed to sell package", "error");
      } finally {
        setIsProcessingTokens(false);
      }
    } else {
      // Adjust mode
      if (!adjustmentAmount || !adjustmentReason) {
        toast.showToast("Please fill in all fields", "error");
        setIsProcessingTokens(false);
        return;
      }
      try {
        const response = await api.post<{ success: boolean; error?: { message: string } }>("/api/tokens/adjust", {
          userId: user.id,
          tokensChange: parseInt(adjustmentAmount),
          reason: adjustmentReason,
          expiryDays: parseInt(adjustmentAmount) > 0 ? parseInt(expiryDays) : undefined, // Only set expiry for positive adjustments
        });
        if (response.error) {
          throw new Error(response.error.message || "Failed to adjust tokens");
        }
        if (response.data?.success) {
          toast.showToast(`Tokens ${parseInt(adjustmentAmount) >= 0 ? "added" : "removed"} successfully!`, "success");
          setIsAdjustPanelOpen(false);
          setMode("sell");
          setAdjustmentAmount("");
          setAdjustmentReason("");
          setExpiryDays("365"); // Reset to default
          // Refresh user data
          setForceRefreshKey(prev => prev + 1);
          invalidateDetail(user.id);
          queryClient.invalidateQueries({ queryKey: ["user", user.id] });
          router.refresh();
        } else {
          throw new Error("Failed to adjust tokens");
        }
      } catch (error) {
        console.error("Error adjusting tokens:", error);
        toast.showToast(error instanceof Error ? error.message : "Failed to adjust tokens", "error");
      } finally {
        setIsProcessingTokens(false);
      }
    }
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
      formData.append('userId', userId);

      const uploadResponse = await fetch('/api/users/upload-physical-form', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          // Don't set Content-Type, let browser set it with boundary
        },
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.error?.message || 'Failed to upload file');
      }

      // Step 2: Update user profile with the physical form URL
      const updateResponse = await fetch(`/api/users/${userId}/physical-form`, {
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
        throw new Error(updateResult.error?.message || 'Failed to update user profile');
      }

      toast.showToast('Physical form uploaded successfully', 'success');
      setIsUploadPanelOpen(false);
      setPhysicalFormFile(null);
      
      // Optimistically update UI immediately
      setForceRefreshKey(prev => prev + 1);
      
      // Wait a moment for the API to process the update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
      });
      
      // Invalidate all user queries
      invalidateDetail(userId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      const refetchResult = await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
      
      // Also trigger Next.js router refresh for server-side updates
      router.refresh();
      
      // If refetch didn't work, try invalidating all user queries
      if (!refetchResult.data) {
        queryClient.invalidateQueries({
          queryKey: ['user'],
        });
        await refetch();
        setForceRefreshKey(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Error uploading physical form:', error);
      toast.showToast(error.message || 'Failed to upload physical form', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhysicalForm = async () => {
    if (!user.physicalFormUrl) {
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

      const response = await fetch(`/api/users/${userId}/physical-form`, {
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
        queryKey: ['user', 'detail', userId],
        exact: true,
      });
      
      // Invalidate all user queries
      invalidateDetail(userId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      const deleteRefetchResult = await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
      
      // Also trigger Next.js router refresh for server-side updates
      router.refresh();
      
      // If refetch didn't work, try invalidating all user queries
      if (!deleteRefetchResult.data) {
        queryClient.invalidateQueries({
          queryKey: ['user'],
        });
        await refetch();
        setForceRefreshKey(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Error deleting physical form:', error);
      toast.showToast(error.message || 'Failed to delete physical form', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editForm.name || !editForm.email) {
      toast.showToast('Name and email are required', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to update user');
      }

      const response = await fetch(`/api/users/${userId}`, {
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
        throw new Error(result.error?.message || result.message || 'Failed to update user');
      }

      toast.showToast('User updated successfully', 'success');
      setIsEditPanelOpen(false);
      
      // Optimistically update UI immediately
      setForceRefreshKey(prev => prev + 1);
      
      // Wait a moment for the API to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
      });
      
      // Invalidate all user queries
      invalidateDetail(userId);
      
      // Force immediate refetch with fresh data
      await queryClient.refetchQueries({
        queryKey: ['user', 'detail', userId],
        exact: true,
        type: 'active',
      });
      
      // Also manually refetch using the hook's refetch function
      await refetch();
      
      // Force another refresh key update after refetch
      setForceRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.showToast(error.message || 'Failed to update user', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "classes", label: "Class History" },
    { key: "tokens", label: "Token History" },
    { key: "notes", label: "Notes" },
  ];

  // Cache-buster so non-technical users always see the latest file without clearing cache
  const physicalFormUrlWithNoCache = user.physicalFormUrl
    ? `${user.physicalFormUrl}?cb=${Date.now()}`
    : null;

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
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
          >
            Sell Tokens
          </button>
          <button 
            onClick={() => setIsEditPanelOpen(true)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            Edit User
          </button>
        </div>
      </div>

      {/* User Header Card */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-xl font-bold text-white">
                {getInitials(user.name)}
              </div>
            )}
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
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.dateOfBirth 
                        ? new Date(user.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                        : "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Blood Group</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{user.bloodGroup || "-"}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Registration Form</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {user.physicalFormUrl ? (
                        <>
                          <a
                            href={physicalFormUrlWithNoCache || user.physicalFormUrl}
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
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Early Bird Status</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.earlyBirdEligible ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                            Eligible
                          </span>
                          {user.earlyBirdExpiresAt && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              (Expires: {new Date(user.earlyBirdExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">Not Eligible</span>
                      )}
                    </dd>
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

              {/* User Packages */}
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700 md:col-span-2">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Token Packages</h3>
                {isLoadingUserPackages ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading packages...</span>
                  </div>
                ) : userPackages.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No active packages</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Package
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Tokens Remaining
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Expiry Date
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {userPackages.map((pkg) => {
                          const expiryDate = new Date(pkg.expiresAt);
                          const isExpiringSoon = expiryDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days
                          const isExpired = expiryDate.getTime() < Date.now();
                          return (
                            <tr key={pkg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {pkg.packageName}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {pkg.tokensRemaining}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={isExpired ? "text-red-600 dark:text-red-400" : isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}>
                                  {expiryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    pkg.status === "active"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                      : pkg.status === "expired"
                                      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                      : "bg-gray-50 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400"
                                  }`}
                                >
                                  {pkg.status.charAt(0).toUpperCase() + pkg.status.slice(1)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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
                {classHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No class history available yet.
                    </td>
                  </tr>
                ) : (
                  classHistory.map((cls) => (
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
                {isLoadingTokenTransactions ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
                        <span className="ml-2">Loading token transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : tokenTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No token transactions yet.
                    </td>
                  </tr>
                ) : (
                  tokenTransactions.map((tx) => (
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
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700"
                >
                  {notes ? "Edit Note" : "Add Note"}
                </button>
              )}
            </div>
            {isEditingNotes ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    rows={8}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter admin notes for this user..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setIsSavingNotes(true);
                      try {
                        const response = await api.put(`/api/users/${user.id}`, {
                          preferences: {
                            ...((user as any).preferences || {}),
                            notes: notes,
                          },
                        });
                        if (response.error) {
                          throw new Error(response.error.message || "Failed to save notes");
                        }
                        toast.showToast("Notes saved successfully", "success");
                        setIsEditingNotes(false);
                        setForceRefreshKey(prev => prev + 1);
                        invalidateDetail(user.id);
                        await refetch();
                      } catch (error) {
                        console.error("Error saving notes:", error);
                        toast.showToast(error instanceof Error ? error.message : "Failed to save notes", "error");
                      } finally {
                        setIsSavingNotes(false);
                      }
                    }}
                    disabled={isSavingNotes}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingNotes ? "Saving..." : "Save Notes"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingNotes(false);
                      setNotes(user.notes || "");
                    }}
                    disabled={isSavingNotes}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : notes ? (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{notes}</p>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">No notes yet for this user.</p>
              </div>
            )}
          </div>
        )}
      </div>

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
              {getInitials(user.name)}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
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

          {user.physicalFormUrl && (
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

      {/* Edit User Panel */}
      <SlidePanel
        isOpen={isEditPanelOpen}
        onClose={() => {
          setIsEditPanelOpen(false);
          // Reset form to current user data
          if (user) {
            setEditForm({
              name: user.name || "",
              email: user.email || "",
              phone: user.phone || "",
              dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
              bloodGroup: user.bloodGroup || "",
            });
          }
        }}
        title="Edit User"
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
                if (user) {
                  setEditForm({
                    name: user.name || "",
                    email: user.email || "",
                    phone: user.phone || "",
                    dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
                    bloodGroup: user.bloodGroup || "",
                  });
                }
              }}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateUser}
              disabled={!editForm.name || !editForm.email || isUpdating}
              className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </div>
      </SlidePanel>

      {/* Token Sell/Adjust Panel */}
      <SlidePanel
        isOpen={isAdjustPanelOpen}
        onClose={() => {
          setIsAdjustPanelOpen(false);
          setMode("sell");
          setSelectedPackageId("");
          setAdjustmentAmount("");
          setAdjustmentReason("");
          setDiscount("");
        }}
        title="Sell Tokens"
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

          {/* Mode Toggle */}
          <div>
            <Label>Mode</Label>
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={() => {
                  setMode("sell");
                  setSelectedPackageId("");
                  setAdjustmentAmount("");
                  setExpiryDays("365");
                }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  mode === "sell"
                    ? "bg-brand-500 text-white"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                Sell Package
              </button>
              <button
                onClick={() => {
                  setMode("adjust");
                  setSelectedPackageId("");
                }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  mode === "adjust"
                    ? "bg-brand-500 text-white"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                Adjust Tokens
              </button>
            </div>
          </div>

          {mode === "sell" ? (
            <>
              <div>
                <Label htmlFor="package">Select Package</Label>
                {isLoadingPackages ? (
                  <div className="mt-1.5 flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading packages...</span>
                  </div>
                ) : (
                  <select
                    id="package"
                    value={selectedPackageId}
                    onChange={(e) => setSelectedPackageId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Select a package...</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} - {pkg.tokenCount} tokens ({pkg.validityDays} days) - ${(pkg.priceCents / 100).toFixed(2)} {pkg.currency}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedPackageId && (
                <div className="rounded-xl border-2 border-dashed border-gray-300 p-4 dark:border-gray-600">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Package Details</div>
                  {(() => {
                    const selectedPkg = packages.find((p) => p.id === selectedPackageId);
                    if (!selectedPkg) return null;
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + selectedPkg.validityDays);
                    return (
                      <>
                        <div className="mt-2 space-y-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Tokens: <span className="text-brand-600">{selectedPkg.tokenCount}</span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Expiry Date: <span className="text-brand-600">{expiryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Valid for {selectedPkg.validityDays} days
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">New Balance Preview</div>
                        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                          {user.tokenBalance + selectedPkg.tokenCount}{" "}
                          <span className="text-base font-normal text-gray-500">tokens</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div>
                <Label htmlFor="discount">Discount Percentage (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                      setDiscount(value);
                    }
                  }}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Enter discount percentage (e.g., 10 for 10% off, 25 for 25% off)
                </p>
              </div>

              {selectedPackageId && discount && (() => {
                const selectedPkg = packages.find((p) => p.id === selectedPackageId);
                if (!selectedPkg) return null;
                const originalPrice = selectedPkg.priceCents / 100;
                const discountPercent = parseFloat(discount) || 0;
                const discountAmount = (originalPrice * discountPercent) / 100;
                const finalPrice = Math.max(0, originalPrice - discountAmount);
                return (
                  <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-4 dark:border-blue-600 dark:bg-blue-900/20">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Price Summary</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Original Price:</span>
                        <span className="font-medium text-gray-900 dark:text-white">${originalPrice.toFixed(2)} {selectedPkg.currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Discount ({discountPercent}%):</span>
                        <span className="font-medium text-red-600 dark:text-red-400">-${discountAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="font-semibold text-gray-900 dark:text-white">Final Price:</span>
                        <span className="font-bold text-lg text-brand-600">${finalPrice.toFixed(2)} {selectedPkg.currency}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <Label htmlFor="reason-sell">Reason (Optional)</Label>
                <textarea
                  id="reason-sell"
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                  placeholder="Enter reason for this sale (optional)..."
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
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

              {parseInt(adjustmentAmount) > 0 && (
                <div>
                  <Label htmlFor="expiryDays">Expiry Duration (Days)</Label>
                  <Input
                    id="expiryDays"
                    type="number"
                    min="1"
                    placeholder="365"
                    value={expiryDays}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || (!isNaN(parseInt(value)) && parseInt(value) > 0)) {
                        setExpiryDays(value);
                      }
                    }}
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Number of days until these tokens expire. Default is 365 days (1 year).
                  </p>
                  {expiryDays && !isNaN(parseInt(expiryDays)) && parseInt(expiryDays) > 0 && (
                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Expiry Date Preview</div>
                      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsAdjustPanelOpen(false);
                setMode("sell");
                setSelectedPackageId("");
                setAdjustmentAmount("");
                setAdjustmentReason("");
                setExpiryDays("365");
              }}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSellOrAdjustTokens}
              disabled={
                isProcessingTokens ||
                (mode === "sell"
                  ? !selectedPackageId
                  : !adjustmentAmount || !adjustmentReason)
              }
              className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessingTokens && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              )}
              {isProcessingTokens
                ? "Processing..."
                : mode === "sell"
                ? "Sell Package"
                : "Apply Adjustment"}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}