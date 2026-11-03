"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import SlidePanel from "@/components/ui/SlidePanel";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useUsers, useInvalidateUsers, type User } from "@/hooks/useUsers";
import { useAuth } from "@/context/AuthContext";
import { useFlagUser } from "@/hooks/useFlaggedUsers";
import { useAdjustTokens } from "@/hooks/useTokenAdjustment";
import { RefreshCw, Mail } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import StudioMenu from "@/components/ui/StudioMenu";
import StudioDate from "@/components/ui/StudioDate";

// Skeleton Components
const StatCardSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 animate-pulse">
    <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
  </div>
);

const UserRowSkeleton = () => (
  <tr className="animate-pulse">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
          <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </td>
    <td className="px-4 py-3"><div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
    <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-4 py-3"><div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-4 py-3">
      <div className="flex gap-2">
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    </td>
  </tr>
);

const TableSkeleton = () => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700">
          <th className="px-4 py-3 text-left"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
          <th className="px-4 py-3 text-left"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
          <th className="px-4 py-3 text-left"><div className="h-4 w-14 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
          <th className="px-4 py-3 text-left"><div className="h-4 w-14 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
          <th className="px-4 py-3 text-left"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
          <th className="px-4 py-3 text-left"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
          <th className="px-4 py-3 text-left"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {[...Array(8)].map((_, i) => <UserRowSkeleton key={i} />)}
      </tbody>
    </table>
  </div>
);

type FilterType = "all" | "active" | "flagged" | "inactive" | "public";
type SortField = "name" | "tokenBalance" | "totalClasses" | "classesAttended" | "noShows" | "lastActive" | "joinedDate";
type SortDirection = "asc" | "desc";
type TokenFilter = "all" | "zero" | "low" | "normal" | "high";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const LOADING_TIMEOUT = 15000; // 15 seconds

export default function UsersPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  
  const { invalidateAll } = useInvalidateUsers();
  const flagMutation = useFlagUser();
  
  // Loading timeout state
  const [isLoadingTakingTooLong, setIsLoadingTakingTooLong] = useState(false);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  
  // Filters
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tokenFilter, setTokenFilter] = useState<TokenFilter>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "been" | "never">("all");
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100); // Get all users, paginate client-side for now
  
  // Slide panel - Flag user
  const [userToFlag, setUserToFlag] = useState<User | null>(null);
  const [flagReason, setFlagReason] = useState<string>("");
  const [flagNotes, setFlagNotes] = useState("");
  const [flagError, setFlagError] = useState<string | null>(null);
  
  // Slide panel - Create user
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createAsChild, setCreateAsChild] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    bloodGroup: "",
    physicalForm: null as File | null,
    username: "", // for child: login identifier, used in plus-address
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [physicalFormUrl, setPhysicalFormUrl] = useState<string | null>(null);
  const toast = useToast();
  
  // Resend email state
  const [resendingEmailTo, setResendingEmailTo] = useState<string | null>(null);
  const [showResendEmailPanel, setShowResendEmailPanel] = useState(false);
  const [userToResendEmail, setUserToResendEmail] = useState<User | null>(null);
  
  // Show/hide advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Flag reason options
  const flagReasonOptions = [
    { value: "excessive_no_shows", label: "Excessive No-Shows" },
    { value: "payment_issues", label: "Payment Issues" },
    { value: "policy_violation", label: "Policy Violation" },
    { value: "account_review", label: "Account Review" },
    { value: "other", label: "Other" },
  ];

  // Build query filters for API
  const apiFilters = useMemo(() => {
    const filters: Record<string, unknown> = {
      page: 1,
      pageSize: 100, // Get all users in one call
      role: 'user', // Only regular users (not staff)
    };
    
    if (filter === 'active') filters.isActive = true;
    else if (filter === 'inactive') filters.isActive = false;
    else if (filter === 'flagged') filters.isFlagged = true;
    
    if (searchQuery) filters.search = searchQuery;
    if (sortField && sortField !== "classesAttended") filters.sortBy = sortField === 'joinedDate' ? 'createdAt' : sortField;
    if (sortDirection) filters.sortOrder = sortDirection;
    
    return filters;
  }, [filter, searchQuery, sortField, sortDirection]);

  // Fetch users with React Query caching - only when auth is ready
  const shouldFetch = !authLoading && !!currentUser;
  
  const { data: usersData, isLoading: loading, error: queryError, refetch } = useUsers(apiFilters, {
    enabled: shouldFetch, // Only fetch when auth is ready
    cacheBuster: forceRefreshKey, // Include cacheBuster to force refresh
  });
  
  const users: User[] = usersData?.users || [];
  
  // Loading timeout effect - shows a message if loading takes too long
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    
    if (loading) {
      setIsLoadingTakingTooLong(false); // Reset when loading starts
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
    invalidateAll();
    refetch();
  };

  // Always render page structure - don't block (like staff page)
  // Filtering logic
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Status filter ("public" filters by signup source instead of status)
      const matchesStatus =
        filter === "all"
          ? true
          : filter === "public"
            ? user.signupSource === "public"
            : user.status === filter;
      
      // Search filter
      const matchesSearch = searchQuery === "" ||
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.phone && user.phone.includes(searchQuery));
      
      // Token filter
      let matchesTokens = true;
      if (tokenFilter === "zero") matchesTokens = user.tokenBalance === 0;
      else if (tokenFilter === "low") matchesTokens = user.tokenBalance > 0 && user.tokenBalance <= 3;
      else if (tokenFilter === "normal") matchesTokens = user.tokenBalance > 3 && user.tokenBalance <= 10;
      else if (tokenFilter === "high") matchesTokens = user.tokenBalance > 10;
      
      const attended = user.classesAttended || 0;
      const matchesAttendance =
        attendanceFilter === "all"
          ? true
          : attendanceFilter === "been"
            ? attended > 0
            : attended === 0;
      
      return matchesStatus && matchesSearch && matchesTokens && matchesAttendance;
    });
  }, [users, filter, searchQuery, tokenFilter, attendanceFilter]);

  // Sorting logic
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "tokenBalance":
          comparison = a.tokenBalance - b.tokenBalance;
          break;
        case "totalClasses":
          comparison = a.totalClasses - b.totalClasses;
          break;
        case "classesAttended":
          comparison = (a.classesAttended || 0) - (b.classesAttended || 0);
          break;
        case "noShows":
          comparison = a.noShows - b.noShows;
          break;
        case "lastActive":
          comparison = new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime();
          break;
        case "joinedDate":
          comparison = new Date(a.joinedDate).getTime() - new Date(b.joinedDate).getTime();
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredUsers, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedUsers.slice(start, start + itemsPerPage);
  }, [sortedUsers, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFilter("all");
    setSearchQuery("");
    setTokenFilter("all");
    setAttendanceFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = filter !== "all" || searchQuery !== "" || tokenFilter !== "all" || attendanceFilter !== "all";

  const getStatusStyle = (status: User["status"]) => {
    switch (status) {
      case "active":
        return "bg-[#E4F56C] text-neutral-950";
      case "flagged":
        return "bg-neutral-950 text-[#E4F56C]";
      case "inactive":
        return "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };


  const handleFlagUser = async () => {
    if (!userToFlag || !flagReason) return;
    
    setFlagError(null);
    
    try {
      await flagMutation.mutateAsync({
        userId: userToFlag.id,
      });
      
      // Close panel and reset
      setUserToFlag(null);
      setFlagReason("");
      setFlagNotes("");
      
      // Refresh data
      invalidateAll();
      refetch();
    } catch (error) {
      setFlagError(error instanceof Error ? error.message : "Failed to flag user");
    }
  };

  const handlePhysicalFormChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setCreateError('Invalid file type. Please upload a PDF, JPEG, PNG, or WebP file.');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setCreateError('File size too large. Maximum size is 10MB.');
      return;
    }

    setNewUser({ ...newUser, physicalForm: file });
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
      setNewUser({ ...newUser, physicalForm: null });
    }
  };

  // Build unique auth email for child (plus-addressing so emails still go to parent inbox)
  const getChildAuthEmail = (parentEmail: string, username: string): string => {
    const at = parentEmail.indexOf("@");
    if (at === -1) return parentEmail;
    const local = parentEmail.slice(0, at);
    const domain = parentEmail.slice(at);
    const slug = username.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "") || "child";
    return `${local}+onestepfitness.${slug}${domain}`;
  };

  const handleCreateUser = async () => {
    const isChild = createAsChild;
    if (isChild) {
      if (!newUser.name || !newUser.email || !newUser.username || !newUser.dateOfBirth) {
        setCreateError("For a child, please fill in Full Name, Parent/Guardian Email, Username, and Date of Birth.");
        return;
      }
    } else {
      if (!newUser.name || !newUser.email || !newUser.phone) {
        setCreateError("Please fill in all required fields (Full Name, Email, Phone).");
        return;
      }
    }

    // Generate a temporary password (8 characters)
    const generatePassword = () => {
      const lowercase = 'abcdefghijklmnopqrstuvwxyz'
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const numbers = '0123456789'
      const special = '!@#$%^&*'
      const allChars = lowercase + uppercase + numbers + special
      let password = ''
      // Ensure at least one of each type
      password += lowercase[Math.floor(Math.random() * lowercase.length)]
      password += uppercase[Math.floor(Math.random() * uppercase.length)]
      password += numbers[Math.floor(Math.random() * numbers.length)]
      password += special[Math.floor(Math.random() * special.length)]
      // Fill the rest randomly to make it 8 characters total
      for (let i = password.length; i < 8; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)]
      }
      // Shuffle the password
      return password.split('').sort(() => Math.random() - 0.5).join('')
    }
    const tempPassword = generatePassword();

    setIsCreating(true);
    setCreateError(null);

    const emailForAuth = isChild ? getChildAuthEmail(newUser.email, newUser.username) : newUser.email;
    const phoneForProfile = isChild ? (newUser.phone || null) : newUser.phone;

    try {
      const response = await api.post<{ data: any }>("/api/users", {
        name: newUser.name,
        email: emailForAuth,
        phone: phoneForProfile || undefined,
        role: "user",
        password: tempPassword,
        dateOfBirth: newUser.dateOfBirth || undefined,
        bloodGroup: newUser.bloodGroup || undefined,
        physicalFormUrl: physicalFormUrl || undefined,
        ...(isChild && newUser.username ? { username: newUser.username.trim().toLowerCase() } : {}),
        ...(isChild && newUser.email ? { guardianEmail: newUser.email.trim().toLowerCase() } : {}),
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create user");
      }

      const userId = (response.data as any)?.id || (response.data as any)?.data?.id;
      const userName = newUser.name;

      // Send welcome email and registration form email separately (don't fail user creation if emails fail)
      if (userId) {
        let welcomeEmailSent = false;
        let registrationFormSent = false;
        
        // Step 1: Send welcome email
        try {
          await api.post(`/api/users/${userId}/send-welcome-email`, {
            temporaryPassword: tempPassword,
          });
          welcomeEmailSent = true;
        } catch (emailError: any) {
          console.error("Failed to send welcome email:", emailError);
        }

        // Step 2: Send registration form email (after welcome email)
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error("Failed to get session for registration form:", sessionError);
          } else if (!session?.access_token) {
            console.error("No access token available for registration form");
          } else {
            console.log("Sending registration form email for user:", userId);
            const formResponse = await fetch('/api/registration-form/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ userId }),
            });

            if (!formResponse.ok) {
              const errorText = await formResponse.text();
              console.error("Registration form API error:", {
                status: formResponse.status,
                statusText: formResponse.statusText,
                body: errorText,
              });
            } else {
              const formResult = await formResponse.json();
              if (formResult.success) {
                registrationFormSent = true;
                console.log("Registration form email sent successfully");
              } else {
                console.error("Failed to send registration form:", formResult.error);
              }
            }
          }
        } catch (formError: any) {
          console.error("Failed to send registration form email:", formError);
          console.error("Error details:", {
            message: formError?.message,
            stack: formError?.stack,
          });
        }

        // Show appropriate toast message based on what was sent
        if (welcomeEmailSent && registrationFormSent) {
          toast.showToast(
            isChild
              ? `Child "${userName}" created successfully! Welcome email and registration form sent to parent/guardian (${newUser.email}).`
              : `User "${userName}" created successfully! Welcome email and registration form sent to ${newUser.email}.`,
            "success"
          );
        } else if (welcomeEmailSent) {
          toast.showToast(`User "${userName}" created successfully! Welcome email sent, but registration form failed. You can resend it from the user details page.`, "warning");
        } else if (registrationFormSent) {
          toast.showToast(`User "${userName}" created successfully! Registration form sent, but welcome email failed. You can resend it using the email icon.`, "warning");
        } else {
          toast.showToast(`User "${userName}" created successfully, but email sending failed. You can resend emails from the user details page.`, "warning");
        }
      } else {
        toast.showToast(`User "${userName}" created successfully!`, "success");
      }

      // Reset form and close panel
      setCreateAsChild(false);
      setNewUser({
        name: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        bloodGroup: "",
        physicalForm: null,
        username: "",
      });
      setPhysicalFormUrl(null);
      setShowCreatePanel(false);
      setCreateError(null);
      
      // Increment refresh key to force new query
      setForceRefreshKey(prev => prev + 1);
      
      // Wait a moment for the API to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Invalidate and refetch user list
      invalidateAll();
      
      // Force refetch with cache-busting
      await refetch();
      
      // Increment again after refetch to ensure UI updates
      setForceRefreshKey(prev => prev + 1);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user");
      console.error("Error creating user:", err);
      toast.showToast(err.message || "Failed to create user", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleResendEmailClick = (user: User) => {
    setUserToResendEmail(user);
    setShowResendEmailPanel(true);
  };

  const handleResendEmail = async () => {
    if (!userToResendEmail) return;
    
    setResendingEmailTo(userToResendEmail.id);
    
    try {
      const response = await api.post<{ success: boolean; message?: string; userEmail?: string }>(
        `/api/users/${userToResendEmail.id}/resend-email`
      );

      if (response.error) {
        throw new Error(response.error.message || "Failed to resend email");
      }

      toast.showToast(`Welcome email with new password resent successfully to ${userToResendEmail.email}`, "success");
      setShowResendEmailPanel(false);
      setUserToResendEmail(null);
    } catch (err: any) {
      console.error("Error resending email:", err);
      toast.showToast(err.message || "Failed to resend email", "error");
    } finally {
      setResendingEmailTo(null);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: "all", label: "All Users" },
    { key: "active", label: "Active" },
    { key: "flagged", label: "Flagged" },
    { key: "inactive", label: "Inactive" },
    { key: "public", label: "Self-signup" },
  ];

  // Memoize filter counts to avoid re-computing on every render
  const filterCounts = useMemo(() => {
    return {
      all: users.length,
      active: users.filter((u) => u.status === "active").length,
      flagged: users.filter((u) => u.status === "flagged").length,
      inactive: users.filter((u) => u.status === "inactive").length,
      public: users.filter((u) => u.signupSource === "public").length,
    };
  }, [users]);
  
  const getFilterCount = (filterKey: FilterType) => filterCounts[filterKey];

  // Stats - memoized to avoid expensive recalculations
  const stats = useMemo(() => {
    return {
      totalTokens: users.reduce((sum, u) => sum + u.tokenBalance, 0),
      wentToClass: users.filter((u) => (u.classesAttended || 0) > 0).length,
      classesAttended: users.reduce((sum, u) => sum + (u.classesAttended || 0), 0),
      showRate: (() => {
        const attended = users.reduce((sum, u) => sum + (u.classesAttended || 0), 0);
        const finished = attended + users.reduce((sum, u) => sum + u.noShows, 0);
        return finished > 0 ? Math.round((attended / finished) * 100) : 0;
      })(),
    };
  }, [users]);
  
  const { totalTokens, wentToClass, classesAttended, showRate } = stats;

  // Pagination range - memoized
  const paginationRange = useMemo(() => {
    const range: (number | string)[] = [];
    const showEllipsis = totalPages > 7;
    
    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) range.push(i);
        range.push("...");
        range.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        range.push(1);
        range.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) range.push(i);
      } else {
        range.push(1);
        range.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) range.push(i);
        range.push("...");
        range.push(totalPages);
      }
    }
    return range;
  }, [currentPage, totalPages]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
            Users{" "}
            <span className="inline-flex h-7 w-9 translate-y-[-1px] items-center justify-center rounded-full bg-[#E4F56C] align-middle text-neutral-950">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
            Who is coming to class, how many they have done, and what they still hold in tokens.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreatePanel(true)}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            <span className="text-base leading-none">+</span>
            Create User
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

      {loading ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <p className="text-sm font-medium text-neutral-500 dark:text-white/60">Total Users</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">{users.length}</p>
        </div>
        <div className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-5 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <p className="text-sm font-medium">Active Tokens</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{totalTokens}</p>
        </div>
        <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-5 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]">
          <p className="text-sm font-medium text-white/60">Went to class</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{wentToClass}</p>
          <p className="mt-1 text-xs text-white/50">of {users.length} members</p>
        </div>
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <p className="text-sm font-medium text-neutral-500 dark:text-white/60">Classes attended</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">{classesAttended}</p>
          <p className="mt-1 text-xs text-neutral-400">{showRate}% show up</p>
        </div>
      </div>
      )}

      {/* Main Card */}
      <div className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
        <div className="px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-950 placeholder-neutral-400 focus:border-neutral-950 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white sm:w-72"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Advanced Filters Toggle */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  showAdvancedFilters || hasActiveFilters
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {hasActiveFilters && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E4F56C] text-xs text-neutral-950">
                    {[filter !== "all", tokenFilter !== "all", attendanceFilter !== "all"].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex flex-wrap gap-4">
                {/* Token Balance Filter */}
                <div className="min-w-[150px]">
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Token Balance
                  </label>
                  <StudioMenu
                    value={tokenFilter}
                    onChange={(value) => { setTokenFilter(value as TokenFilter); setCurrentPage(1); }}
                    placeholder="All balances"
                    options={[
                      { value: "all", label: "All balances" },
                      { value: "zero", label: "Zero (0)" },
                      { value: "low", label: "Low (1-3)" },
                      { value: "normal", label: "Normal (4-10)" },
                      { value: "high", label: "High (10+)" },
                    ]}
                  />
                </div>
                
                <div className="min-w-[150px]">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">
                    Attendance
                  </label>
                  <StudioMenu
                    value={attendanceFilter}
                    onChange={(value) => { setAttendanceFilter(value as typeof attendanceFilter); setCurrentPage(1); }}
                    placeholder="Everyone"
                    options={[
                      { value: "all", label: "Everyone" },
                      { value: "been", label: "Been to class" },
                      { value: "never", label: "Not yet" },
                    ]}
                  />
                </div>
                
                {/* Clear Filters */}
                {hasActiveFilters && (
                  <div className="flex items-end">
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear All
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Filter Tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleFilterChange(tab.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                    filter === tab.key
                      ? "bg-[#E4F56C] text-neutral-950"
                      : "bg-white text-neutral-500 dark:bg-neutral-950 dark:text-white/60"
                  }`}
                >
                  {getFilterCount(tab.key)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Info */}
        {hasActiveFilters && (
          <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-2 dark:border-gray-800 dark:bg-gray-800/30">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing <span className="font-semibold text-gray-900 dark:text-white">{filteredUsers.length}</span> results
              {filteredUsers.length !== users.length && (
                <> out of <span className="font-semibold text-gray-900 dark:text-white">{users.length}</span> total users</>
              )}
            </p>
          </div>
        )}

        {/* Table - Show loading or error inline */}
        {authLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
            <p className="ml-4 text-sm text-gray-500 dark:text-gray-400">Loading authentication...</p>
          </div>
        ) : queryError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
              Failed to load users
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              {queryError instanceof Error ? queryError.message : String(queryError)}
            </p>
            <button
              onClick={handleRefresh}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <TableSkeleton />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    User
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort("tokenBalance")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Tokens
                    <SortIcon field="tokenBalance" />
                  </button>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort("classesAttended")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Classes
                    <SortIcon field="classesAttended" />
                  </button>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Show rate
                  </span>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort("lastActive")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Last Active
                    <SortIcon field="lastActive" />
                  </button>
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {paginatedUsers.map((user) => (
                <tr
                  key={user.id}
                  className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-[#E4F56C]">
                          {getInitials(user.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
                            {user.name}
                          </span>
                          {user.signupSource === "public" && (
                            <span className="shrink-0 rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-700 dark:bg-lime-900/40 dark:text-lime-300">
                              Self-signup
                            </span>
                          )}
                        </div>
                        <div className="truncate text-sm text-gray-500 dark:text-gray-400">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-neutral-950 px-2.5 text-sm font-semibold text-[#E4F56C]">
                      {user.tokenBalance}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <p className="text-lg font-semibold leading-none text-neutral-950 dark:text-white">{user.classesAttended || 0}</p>
                    <p className="mt-1 text-xs text-neutral-400">{user.totalClasses} booked</p>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {(() => {
                      const finished = (user.classesAttended || 0) + user.noShows;
                      if (finished === 0) {
                        return <span className="text-xs text-neutral-400">No classes yet</span>;
                      }
                      const rate = Math.round(((user.classesAttended || 0) / finished) * 100);
                      return (
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          rate >= 80
                            ? "bg-[#E4F56C] text-neutral-950"
                            : rate >= 50
                              ? "bg-neutral-950 text-white"
                              : "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/60"
                        }`}>
                          {rate}% show
                        </span>
                      );
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusStyle(
                        user.status
                      )}`}
                    >
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.lastActive).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {user.status !== "flagged" && (
                        <button
                          onClick={() => setUserToFlag(user)}
                          className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-white"
                        >
                          Flag
                        </button>
                      )}
                      <button
                        onClick={() => handleResendEmailClick(user)}
                        disabled={resendingEmailTo === user.id}
                        className="rounded-lg p-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Resend welcome email"
                      >
                        <Mail className={`h-4 w-4 ${resendingEmailTo === user.id ? 'animate-pulse' : ''}`} />
                      </button>
                      <Link
                        href={`/users/${user.id}`}
                        className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Empty State */}
          {paginatedUsers.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No users found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your search or filter criteria.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Pagination Footer */}
        {sortedUsers.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            {/* Items per page */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Show</span>
              <span className="inline-block w-24">
                <StudioMenu
                  size="sm"
                  value={String(itemsPerPage)}
                  onChange={(value) => handleItemsPerPageChange(Number(value))}
                  placeholder="Rows"
                  options={ITEMS_PER_PAGE_OPTIONS.map((option) => ({ value: String(option), label: String(option) }))}
                />
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">per page</span>
            </div>

            {/* Page info and navigation */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {(currentPage - 1) * itemsPerPage + 1}
                </span>
                {" - "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {Math.min(currentPage * itemsPerPage, sortedUsers.length)}
                </span>
                {" of "}
                <span className="font-medium text-gray-900 dark:text-white">{sortedUsers.length}</span>
              </span>

              {/* Page buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
                  title="First page"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
                  title="Previous page"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {paginationRange.map((page, index) => (
                  <button
                    key={index}
                    onClick={() => typeof page === "number" && setCurrentPage(page)}
                    disabled={page === "..."}
                    className={`min-w-8 rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
                      page === currentPage
                        ? "bg-brand-500 text-white"
                        : page === "..."
                        ? "cursor-default text-gray-400"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
                  title="Next page"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
                  title="Last page"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        )}
      </div>

      {/* Flag User Panel */}
      <SlidePanel
        isOpen={!!userToFlag}
        onClose={() => {
          setUserToFlag(null);
          setFlagReason("");
          setFlagNotes("");
        }}
        title="Flag User"
      >
        {userToFlag && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              {userToFlag.avatarUrl ? (
                <img
                  src={userToFlag.avatarUrl}
                  alt={userToFlag.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-lg font-semibold text-white">
                  {getInitials(userToFlag.name)}
                </div>
              )}
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {userToFlag.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{userToFlag.email}</div>
              </div>
            </div>

            {/* Warning Notice */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="font-medium text-amber-800 dark:text-amber-200">
                    Flagging a User
                  </div>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    Flagged users will be marked for review. They can still book classes but will be visible in the flagged users list.
                  </p>
                </div>
              </div>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{userToFlag.tokenBalance}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Tokens</div>
              </div>
              <div className="rounded-[22px] bg-[#E4F56C] p-3 text-center text-neutral-950">
                <div className="text-2xl font-semibold">{userToFlag.classesAttended || 0}</div>
                <div className="text-xs">Attended</div>
              </div>
              <div className="rounded-[22px] bg-neutral-950 p-3 text-center text-white">
                <div className="text-2xl font-semibold">{userToFlag.totalClasses}</div>
                <div className="text-xs text-white/50">Booked</div>
              </div>
            </div>

            {/* Flag Reason */}
            <div>
              <Label htmlFor="flagReason">Reason for Flagging *</Label>
              <StudioMenu
                id="flagReason"
                value={flagReason}
                onChange={setFlagReason}
                placeholder="Select a reason..."
                options={[{ value: "", label: "Select a reason..." }, ...flagReasonOptions.map((option) => ({ value: option.value, label: option.label }))]}
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="flagNotes">Additional Notes</Label>
              <textarea
                id="flagNotes"
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                placeholder="Add any additional notes or context about why this user is being flagged..."
                value={flagNotes}
                onChange={(e) => {
                  setFlagNotes(e.target.value);
                  setFlagError(null);
                }}
              />
              {flagError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{flagError}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setUserToFlag(null);
                  setFlagReason("");
                  setFlagNotes("");
                  setFlagError(null);
                }}
                disabled={flagMutation.isPending}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagUser}
                disabled={!flagReason || flagMutation.isPending}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {flagMutation.isPending ? "Flagging..." : "Flag User"}
              </button>
            </div>
          </div>
        )}
      </SlidePanel>

      {/* Create User Panel */}
      <SlidePanel
        isOpen={showCreatePanel}
        onClose={() => {
          setShowCreatePanel(false);
          setCreateError(null);
          setCreateAsChild(false);
          setNewUser({
            name: "",
            email: "",
            phone: "",
            dateOfBirth: "",
            bloodGroup: "",
            physicalForm: null,
            username: "",
          });
          setPhysicalFormUrl(null);
        }}
        title="Create New User"
        size="md"
      >
        <div className="space-y-6">
          {createError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
            </div>
          )}

          {/* Adult / Child toggle */}
          <div>
            <Label className="mb-2 block">Create as</Label>
            <div className="flex rounded-lg border border-gray-300 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setCreateAsChild(false)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  !createAsChild
                    ? "bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Adult
              </button>
              <button
                type="button"
                onClick={() => setCreateAsChild(true)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  createAsChild
                    ? "bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Child
              </button>
            </div>
            {createAsChild && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Child account uses parent/guardian email. Welcome and registration emails will be sent there.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="name">
              {createAsChild ? "Child's Full Name" : "Full Name"} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              placeholder={createAsChild ? "e.g. Jane Doe" : "John Doe"}
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
          </div>

          {createAsChild && (
            <div>
              <Label htmlFor="username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="e.g. janedoe (for sign-in)"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="lowercase"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Child will sign in with this username (not email). Letters, numbers, dots, dashes only.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="email">
              {createAsChild ? "Parent / Guardian Email" : "Email Address"} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={createAsChild ? "parent@example.com" : "john.doe@example.com"}
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="phone">
              Phone Number {!createAsChild && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+65 1234 5678"
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            />
            {createAsChild && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Optional — parent/guardian phone
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="dateOfBirth">
              Date of Birth {createAsChild && <span className="text-red-500">*</span>}
            </Label>
            <StudioDate
              id="dateOfBirth"
              block
              clearable
              ariaLabel="Date of birth"
              placeholder="Date of birth"
              value={newUser.dateOfBirth}
              onChange={(value) => setNewUser({ ...newUser, dateOfBirth: value })}
            />
          </div>

          <div>
            <Label htmlFor="bloodGroup">
              Blood Group
            </Label>
            <StudioMenu
              id="bloodGroup"
              value={newUser.bloodGroup}
              onChange={(value) => setNewUser({ ...newUser, bloodGroup: value })}
              placeholder="Select blood group"
              options={["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"].map((value) => ({ value, label: value || "Select blood group" }))}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setShowCreatePanel(false);
                setCreateError(null);
                setCreateAsChild(false);
                setNewUser({
                  name: "",
                  email: "",
                  phone: "",
                  dateOfBirth: "",
                  bloodGroup: "",
                  physicalForm: null,
                  username: "",
                });
                setPhysicalFormUrl(null);
              }}
              disabled={isCreating}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateUser}
              disabled={
                isCreating ||
                (createAsChild
                  ? !newUser.name || !newUser.email || !newUser.username || !newUser.dateOfBirth
                  : !newUser.name || !newUser.email || !newUser.phone)
              }
              className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? "Creating..." : createAsChild ? "Create Child" : "Create User"}
            </button>
          </div>
        </div>
      </SlidePanel>

      {/* Resend Email Panel */}
      <SlidePanel
        isOpen={showResendEmailPanel}
        onClose={() => {
          setShowResendEmailPanel(false);
          setUserToResendEmail(null);
          setResendingEmailTo(null);
        }}
        title="Resend Welcome Email"
        size="md"
      >
        {userToResendEmail && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              {userToResendEmail.avatarUrl ? (
                <img
                  src={userToResendEmail.avatarUrl}
                  alt={userToResendEmail.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-600 text-lg font-semibold text-white">
                  {getInitials(userToResendEmail.name)}
                </div>
              )}
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {userToResendEmail.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{userToResendEmail.email}</div>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-medium text-blue-800 dark:text-blue-200">
                    What happens when you resend the email?
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-300">
                    <li>• A new temporary password will be generated</li>
                    <li>• The old password will be invalidated</li>
                    <li>• Welcome email will be sent to: <strong>{userToResendEmail.email}</strong></li>
                    <li>• The email will include sign-in instructions and the new password</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Email Display */}
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email will be sent to:</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{userToResendEmail.email}</div>
            </div>

            {/* Sign-in Instructions */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sign-in URL:</div>
              <div className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-900 px-3 py-2 rounded border">
                https://onestepfitness.sg/signin
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowResendEmailPanel(false);
                  setUserToResendEmail(null);
                  setResendingEmailTo(null);
                }}
                disabled={resendingEmailTo === userToResendEmail.id}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleResendEmail}
                disabled={resendingEmailTo === userToResendEmail.id}
                className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resendingEmailTo === userToResendEmail.id ? "Sending..." : "Resend Email"}
              </button>
            </div>
          </div>
        )}
      </SlidePanel>
    </div>
  );
}
