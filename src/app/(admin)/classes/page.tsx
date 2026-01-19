"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import AttendanceModal from "@/components/attendance/AttendanceModal";
import { useInvalidateEntity, createEntityKeys } from "@/hooks/useEntityQuery";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import type { ClassWithAvailability, ClassListResponse } from "@/api/schemas";
import { useCancelClass } from "@/hooks/useClasses";
import { useRoomsList } from "@/hooks/useRooms";

// Skeleton Components
const StatCardSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-700"></div>
      <div className="flex-1">
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  </div>
);

const ClassCardSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
      <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
    </div>
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      <div className="flex justify-between mt-2">
        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  </div>
);

const ClassListSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 animate-pulse">
    <div className="p-4 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
      <div className="flex-1">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
      <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
    </div>
  </div>
);

// Transform API class data to display format
interface DisplayClass {
  id: string;
  name: string;
  instructor: string;
  instructorAvatar: string;
  dayOfWeek: string;
  time: string;
  duration: number;
  capacity: number;
  enrolled: number;
  tokenCost: number;
  status: "active" | "cancelled" | "full" | "completed";
  description: string;
  recurrenceType?: 'single' | 'recurring' | 'course';
  recurrencePattern?: Record<string, unknown> | null;
  scheduledAt: string;
  location?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  level?: string;
  classType?: string;
}

// Helper to get day of week from date
function getDayOfWeek(dateStr: string): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

// Helper to format time from ISO string
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// Helper to get initials from name
function getInitials(name: string | null): string {
  if (!name) return "??";
  
  // Handle multiple instructors (comma-separated names)
  if (name.includes(',')) {
    const names = name.split(',').map(n => n.trim());
    // Get first letter of each instructor's first name
    return names
      .map(n => n.split(' ')[0]?.[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 3); // Allow up to 3 instructors to show
  }
  
  // Single instructor - original logic
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Transform API class to display class
function transformClass(cls: ClassWithAvailability): DisplayClass {
  // Determine display status
  let status: "active" | "cancelled" | "full" | "completed" = "active";
  if (cls.status === "cancelled") {
    status = "cancelled";
  } else if (cls.status === "completed") {
    status = "completed";
  } else if (cls.spotsRemaining <= 0) {
    status = "full";
  } else {
    // Check if the class date has passed for ALL class types
    const classDate = new Date(cls.scheduledAt);
    const now = new Date();
    // Add buffer to account for class duration - class is considered past after its end time
    const classEndTime = new Date(classDate);
    classEndTime.setMinutes(classEndTime.getMinutes() + (cls.durationMinutes || 60));
    
    // If class end time has passed and status is still scheduled, mark as completed
    // Note: For recurring classes, individual instances are marked, but the parent card
    // shows aggregate status based on all instances
    if (classEndTime < now && cls.status === 'scheduled') {
      status = "completed";
    }
  }

  return {
    id: cls.id,
    name: cls.title,
    instructor: cls.instructorName || "Unassigned",
    instructorAvatar: getInitials(cls.instructorName),
    dayOfWeek: getDayOfWeek(cls.scheduledAt),
    time: formatTime(cls.scheduledAt),
    duration: cls.durationMinutes,
    capacity: cls.capacity,
    enrolled: cls.bookedCount,
    tokenCost: cls.tokenCost,
    status,
    description: cls.description || "",
    recurrenceType: cls.recurrenceType || 'single',
    recurrencePattern: cls.recurrencePattern,
    scheduledAt: cls.scheduledAt,
    location: cls.location || null,
    roomId: cls.roomId || null,
    level: cls.level,
    classType: cls.classType,
  };
}

// Loading timeout in milliseconds (15 seconds)
const LOADING_TIMEOUT = 15000;

export default function ClassesPage() {
  // Fetch rooms to get room names
  const { data: roomsData } = useRoomsList();
  const rooms = roomsData?.rooms || [];
  
  // Create a map of roomId to room name
  const roomMap = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(room => {
      if (room.id) {
        map.set(room.id, room.name);
      }
    });
    return map;
  }, [rooms]);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "cancelled" | "full">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [attendanceModal, setAttendanceModal] = useState<{
    isOpen: boolean;
    classData: DisplayClass | null;
  }>({ isOpen: false, classData: null });
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; classId: string | null; className: string }>({
    isOpen: false,
    classId: null,
    className: "",
  });
  const [recurringPanel, setRecurringPanel] = useState<{
    isOpen: boolean;
    recurringClasses: DisplayClass[];
    parentClass: DisplayClass | null;
  }>({
    isOpen: false,
    recurringClasses: [],
    parentClass: null,
  });
  const [detailsPanel, setDetailsPanel] = useState<{
    isOpen: boolean;
    classData: DisplayClass | null;
  }>({
    isOpen: false,
    classData: null,
  });
  const [bookingsPanel, setBookingsPanel] = useState<{
    isOpen: boolean;
    parentClass: DisplayClass | null;
    bookings: Array<{
      id: string;
      userId: string;
      userName: string;
      userEmail: string;
      classId: string;
      className: string;
      scheduledAt: string;
      status: string;
      bookedAt: string;
    }>;
  }>({
    isOpen: false,
    parentClass: null,
    bookings: [],
  });

  // Cancel/Delete class mutation
  const cancelClassMutation = useCancelClass();

  // Fetch classes from API with caching using custom query for classes response format
  const keys = createEntityKeys("classes");
  const { 
    data: classesResponse, 
    isLoading, 
    error, 
    refetch,
    isFetching
  } = useQuery({
    queryKey: keys.list(),
    queryFn: async () => {
      const response = await api.get<{ data: ClassListResponse }>("/api/classes");
      
      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch classes");
      }
      
      // The API returns { success, data: { classes, total, page, pageSize, hasMore } }
      return response.data?.data;
    },
    staleTime: 0, // Always fetch fresh data to show accurate booking counts
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds to catch booking updates
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });

  // Extract classes array from response
  const apiClasses = classesResponse?.classes || [];

  // Cache invalidation hook
  const { invalidateAll } = useInvalidateEntity("classes");

  // Handle loading timeout
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isLoading && !loadingTimeout) {
      timeoutId = setTimeout(() => {
        setLoadingTimeout(true);
      }, LOADING_TIMEOUT);
    }
    
    if (!isLoading) {
      setLoadingTimeout(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, loadingTimeout]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setLoadingTimeout(false);
    invalidateAll();
    refetch();
  }, [invalidateAll, refetch]);

  // Transform API data to display format
  const classes = useMemo(() => {
    return apiClasses.map(cls => {
      const displayClass = transformClass(cls);
      // Add room name if roomId exists
      if (displayClass.roomId && roomMap.has(displayClass.roomId)) {
        displayClass.roomName = roomMap.get(displayClass.roomId) || null;
      }
      return displayClass;
    });
  }, [apiClasses, roomMap]);

  // Group recurring classes - show only the first occurrence as the parent
  // For recurring classes, we show a special parent card that represents the series
  const groupedClasses = useMemo(() => {
    const singleClasses: DisplayClass[] = [];
    const recurringGroups = new Map<string, DisplayClass[]>();
    
    classes.forEach((cls) => {
      // Check if this is a recurring or course class
      // Also check if the name contains a date pattern (occurrence classes have "- MM/DD/YYYY" suffix)
      const isRecurringType = cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course';
      const isOccurrenceClass = /-\s*\d{1,2}\/\d{1,2}\/\d{4}$/.test(cls.name);
      
      if (isRecurringType || isOccurrenceClass) {
        // Extract base name (remove date suffix for occurrence classes)
        const baseName = cls.name.replace(/-\s*\d{1,2}\/\d{1,2}\/\d{4}$/, '').trim();
        
        // Create a key based on base class name, instructor, time, and recurrence pattern
        const patternKey = cls.recurrencePattern 
          ? JSON.stringify(cls.recurrencePattern)
          : '';
        // Use base name for grouping
        const groupKey = `${baseName}-${cls.instructor}-${cls.time}-${patternKey}`;
        
        if (!recurringGroups.has(groupKey)) {
          recurringGroups.set(groupKey, []);
        }
        recurringGroups.get(groupKey)!.push(cls);
      } else {
        singleClasses.push(cls);
      }
    });

    // For each recurring group, create a special parent card
    const recurringParents: DisplayClass[] = [];
    recurringGroups.forEach((group) => {
      // Sort by scheduled date
      const sorted = [...group].sort((a, b) => 
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      
      // Get the first class as base
      const firstClass = sorted[0];
      const baseName = firstClass.name.replace(/-\s*\d{1,2}\/\d{1,2}\/\d{4}$/, '').trim();
      
      // Find the next upcoming session (not completed)
      const now = new Date();
      const nextUpcoming = sorted.find(c => {
        const classEndTime = new Date(c.scheduledAt);
        classEndTime.setMinutes(classEndTime.getMinutes() + c.duration);
        return classEndTime > now && c.status !== 'completed' && c.status !== 'cancelled';
      }) || sorted[0]; // Fallback to first if all are past
      
      // Calculate aggregate stats for the recurring series
      // For enrolled: sum across all sessions (total bookings)
      const totalEnrolled = sorted.reduce((sum, c) => sum + c.enrolled, 0);
      // For capacity: use per-session capacity (all instances should have the same capacity)
      // Don't sum - capacity is per session, not total
      const perSessionCapacity = nextUpcoming.capacity || firstClass.capacity;
      const activeCount = sorted.filter(c => c.status === 'active').length;
      const completedCount = sorted.filter(c => c.status === 'completed').length;
      
      // Determine parent status: active if any instance is active, completed only if ALL are completed
      let parentStatus: DisplayClass["status"] = "active";
      if (activeCount === 0 && completedCount === sorted.length) {
        // All instances are completed
        parentStatus = "completed";
      } else if (sorted.every(c => c.status === "cancelled")) {
        parentStatus = "cancelled";
      } else if (sorted.every(c => c.status === "full")) {
        parentStatus = "full";
      } else if (activeCount > 0) {
        // At least one is active
        parentStatus = "active";
      }
      
      // Create a special parent card for the recurring series
      // Use the next upcoming session's date/time for display
      const parentCard: DisplayClass = {
        ...nextUpcoming,
        name: baseName,
        enrolled: totalEnrolled, // Total enrolled across all sessions
        capacity: perSessionCapacity, // Capacity per session (not total)
        status: parentStatus,
        // Mark this as a parent card (we'll use this to style it differently)
        recurrenceType: firstClass.recurrenceType,
      };
      
      recurringParents.push(parentCard);
    });

    return {
      single: singleClasses,
      recurring: recurringParents,
      recurringGroups: recurringGroups,
    };
  }, [classes]);

  // Get all instances for a recurring class
  const getRecurringInstances = (parentClass: DisplayClass): DisplayClass[] => {
    // Extract base name (remove date suffix if present)
    const baseName = parentClass.name.replace(/-\s*\d{1,2}\/\d{1,2}\/\d{4}$/, '').trim();
    const patternKey = parentClass.recurrencePattern 
      ? JSON.stringify(parentClass.recurrencePattern)
      : '';
    const groupKey = `${baseName}-${parentClass.instructor}-${parentClass.time}-${patternKey}`;
    
    const group = groupedClasses.recurringGroups.get(groupKey);
    if (!group) return [];
    
    // Sort by scheduled date
    return [...group].sort((a, b) => 
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  };

  // Open recurring classes panel
  const openRecurringPanel = (parentClass: DisplayClass) => {
    const instances = getRecurringInstances(parentClass);
    setRecurringPanel({
      isOpen: true,
      recurringClasses: instances,
      parentClass,
    });
  };

  // Close recurring classes panel
  const closeRecurringPanel = () => {
    setRecurringPanel({
      isOpen: false,
      recurringClasses: [],
      parentClass: null,
    });
  };

  // Open class details panel
  const openDetailsPanel = (cls: DisplayClass) => {
    setDetailsPanel({
      isOpen: true,
      classData: cls,
    });
  };

  // Close class details panel
  const closeDetailsPanel = () => {
    setDetailsPanel({
      isOpen: false,
      classData: null,
    });
  };

  // Open bookings panel for recurring class
  const openBookingsPanel = async (parentClass: DisplayClass) => {
    try {
      // Get all instances of this recurring class
      const instances = getRecurringInstances(parentClass);
      const classIds = instances.map(inst => inst.id);

      // Fetch bookings for all instances
      const bookingsPromises = classIds.map(async (classId) => {
        try {
          const response = await api.get<{
            success: boolean;
            data: {
              class: { 
                id: string; 
                name: string; 
                scheduledAt: string;
              };
              attendees: Array<{
                id: string;
                userId: string;
                name: string;
                checkedInAt: string;
              }>;
            };
          }>(`/api/attendance/class/${classId}/attendees`);

          if (response.data?.success && response.data.data) {
            const classData = response.data.data.class;
            const attendees = response.data.data.attendees;
            
            return attendees.map(attendee => ({
              id: attendee.id,
              userId: attendee.userId,
              userName: attendee.name,
              userEmail: '',
              classId: classData.id,
              className: classData.name,
              scheduledAt: classData.scheduledAt,
              status: attendee.checkedInAt ? 'attended' : 'confirmed',
              bookedAt: '',
            }));
          }
        } catch (err) {
          console.error(`Error fetching bookings for class ${classId}:`, err);
        }
        return [];
      });

      const allBookings = (await Promise.all(bookingsPromises)).flat();

      setBookingsPanel({
        isOpen: true,
        parentClass,
        bookings: allBookings,
      });
    } catch (error) {
      console.error('Error fetching bookings:', error);
      // Still open panel with empty bookings
      setBookingsPanel({
        isOpen: true,
        parentClass,
        bookings: [],
      });
    }
  };

  // Close bookings panel
  const closeBookingsPanel = () => {
    setBookingsPanel({
      isOpen: false,
      parentClass: null,
      bookings: [],
    });
  };

  // Combine single and recurring parent classes for display
  // For "completed" filter, show individual completed instances instead of parent cards
  const displayClasses = useMemo(() => {
    if (filter === "completed") {
      // For completed filter, show all individual completed classes (including occurrences)
      return classes.filter(c => c.status === "completed").sort((a, b) => 
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
    }
    // For other filters, show parent cards for recurring classes
    return [...groupedClasses.single, ...groupedClasses.recurring].sort((a, b) => 
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  }, [groupedClasses, classes, filter]);

  const openAttendanceModal = (cls: DisplayClass) => {
    setAttendanceModal({ isOpen: true, classData: cls });
  };

  const closeAttendanceModal = () => {
    setAttendanceModal({ isOpen: false, classData: null });
  };

  const handleDeleteClick = (cls: DisplayClass) => {
    setDeleteConfirm({ isOpen: true, classId: cls.id, className: cls.name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.classId) return;

    try {
      await cancelClassMutation.mutateAsync(deleteConfirm.classId);
      setDeleteConfirm({ isOpen: false, classId: null, className: "" });
      // The mutation will automatically invalidate and refetch the classes list
    } catch (error) {
      console.error("Failed to cancel class:", error);
      // You might want to show a toast notification here
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, classId: null, className: "" });
  };

  const filteredClasses = displayClasses.filter((cls) => {
    // For completed filter, displayClasses already contains only completed classes
    // For other filters, apply the filter logic
    let matchesFilter = true;
    if (filter !== "all" && filter !== "completed") {
      if (filter === "active") {
        matchesFilter = cls.status === "active";
      } else if (filter === "cancelled") {
        matchesFilter = cls.status === "cancelled";
      } else if (filter === "full") {
        matchesFilter = cls.status === "full";
      }
    }
    // For "completed" filter, displayClasses already filtered, so all match
    // For "all" filter, show everything
    
    const matchesSearch =
      cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.instructor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusStyles = (status: DisplayClass["status"]) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
      case "full":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800";
      case "completed":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getCapacityColor = (enrolled: number, capacity: number) => {
    const percentage = (enrolled / capacity) * 100;
    if (percentage >= 100) return "bg-amber-500";
    if (percentage >= 75) return "bg-emerald-500";
    if (percentage >= 50) return "bg-blue-500";
    return "bg-gray-300 dark:bg-gray-600";
  };

  // Calculate stats from individual classes (not grouped) to show accurate counts
  // This counts all individual class instances, including occurrences from recurring classes
  const stats = {
    total: classes.length,
    active: classes.filter((c) => c.status === "active").length,
    completed: classes.filter((c) => c.status === "completed").length,
    full: classes.filter((c) => c.status === "full").length,
    cancelled: classes.filter((c) => c.status === "cancelled").length,
    totalEnrolled: classes.reduce((sum, c) => sum + c.enrolled, 0),
    totalCapacity: classes.reduce((sum, c) => sum + c.capacity, 0),
  };

  // Helper to get class type badge
  const getClassTypeBadge = (recurrenceType?: 'single' | 'recurring' | 'course') => {
    const type = recurrenceType || 'single';
    
    const badges = {
      single: {
        label: 'Single',
        className: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800',
      },
      recurring: {
        label: 'Recurring',
        className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
      },
      course: {
        label: 'Course',
        className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
      },
    };
    
    const badge = badges[type];
    if (!badge) return null;
    
    return (
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  // Helper to format date for single classes
  const formatClassDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Classes Management" />
        
        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>

        {/* Header Actions Skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
          <div className="flex gap-3 animate-pulse">
            <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>

        {/* Classes Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <ClassCardSkeleton key={i} />)}
        </div>
        
        {loadingTimeout && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">Taking longer than expected</p>
            <button 
              onClick={handleRefresh}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Classes Management" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-16 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="mt-4 text-lg font-medium text-red-900 dark:text-red-100">Failed to load classes</p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error.message || "An unexpected error occurred"}</p>
          <button 
            onClick={handleRefresh}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Classes Management" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Classes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enrolled</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEnrolled}<span className="text-sm font-normal text-gray-400">/{stats.totalCapacity}</span></p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fill Rate</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalCapacity > 0 ? Math.round((stats.totalEnrolled / stats.totalCapacity) * 100) : 0}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "All", count: stats.total },
            { key: "active", label: "Active", count: stats.active },
            { key: "completed", label: "Completed", count: stats.completed },
            { key: "cancelled", label: "Cancelled", count: stats.cancelled },
            { key: "full", label: "Full", count: stats.full },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                filter === tab.key
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                filter === tab.key
                  ? "bg-white/20 dark:bg-gray-900/20"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-gray-300 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 sm:w-64"
            />
          </div>

          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-gray-100 dark:bg-gray-800" : ""}`}
            >
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-gray-100 dark:bg-gray-800" : ""}`}
            >
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          <Link href="/classes/new">
            <Button>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Class
            </Button>
          </Link>
        </div>
      </div>

      {/* Classes Grid */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((cls) => (
            <div
              key={cls.id}
              className={`group relative overflow-hidden rounded-2xl border transition-all hover:shadow-lg ${
                (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') 
                  ? 'cursor-pointer border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20' 
                  : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
              }`}
              onClick={(e) => {
                // For completed classes, show details instead of recurring panel
                if (cls.status === 'completed' && !(e.target as HTMLElement).closest('button, a')) {
                  openDetailsPanel(cls);
                } else if ((cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') && 
                    !(e.target as HTMLElement).closest('button, a')) {
                  openRecurringPanel(cls);
                }
              }}
            >
              {/* Header */}
              <div className={`border-b p-5 ${
                (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                  ? 'border-blue-200 dark:border-blue-800'
                  : 'border-gray-100 dark:border-gray-800'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold ${
                        (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {cls.name}
                        {(cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') && (
                          <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">
                            (Series)
                          </span>
                        )}
                      </h3>
                      {getClassTypeBadge(cls.recurrenceType)}
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getStatusStyles(cls.status)}`}>
                        {cls.status}
                      </span>
                    </div>
                    <p className={`mt-1 text-sm line-clamp-1 ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {cls.description}
                    </p>
                  </div>
                  <button className="rounded-lg p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-800">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className={`p-5 ${
                (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                  ? 'bg-blue-50/30 dark:bg-blue-900/10'
                  : ''
              }`}>
                {/* Instructor */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white ${
                    (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                      : 'bg-linear-to-br from-blue-500 to-purple-600'
                  }`}>
                    {cls.instructorAvatar}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {cls.instructor}
                    </p>
                    <p className={`text-xs ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Instructor
                    </p>
                  </div>
                </div>

                {/* Schedule Info */}
                <div className={`mt-4 grid gap-3 ${
                  cls.recurrenceType === 'single' 
                    ? 'grid-cols-2' 
                    : (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                }`}>
                  {cls.recurrenceType === 'single' && (
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{formatClassDate(cls.scheduledAt)}</p>
                    </div>
                  )}
                  {(cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') && (
                    <div className={`rounded-xl p-3 ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-gray-50 dark:bg-gray-800/50'
                    }`}>
                      <p className={`text-xs ${
                        (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {cls.status === 'completed' ? 'Date' : 'Next Session'}
                      </p>
                      <p className={`mt-0.5 text-sm font-medium ${
                        (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {formatClassDate(cls.scheduledAt)}
                      </p>
                    </div>
                  )}
                  {cls.recurrenceType !== 'single' && !(cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') && (
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Day</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{cls.dayOfWeek}</p>
                    </div>
                  )}
                  <div className={`rounded-xl p-3 ${
                    (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-gray-50 dark:bg-gray-800/50'
                  }`}>
                    <p className={`text-xs ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Time
                    </p>
                    <p className={`mt-0.5 text-sm font-medium ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {cls.time}
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 ${
                    (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-gray-50 dark:bg-gray-800/50'
                  }`}>
                    <p className={`text-xs ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Duration
                    </p>
                    <p className={`mt-0.5 text-sm font-medium ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {cls.duration}m
                    </p>
                  </div>
                </div>

                {/* Location/Room */}
                {(cls.roomName || cls.location) && (
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-300">
                      {cls.roomName || cls.location || "No location"}
                    </span>
                  </div>
                )}

                {/* Capacity */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Capacity</span>
                    <span className="font-medium text-gray-900 dark:text-white">{cls.enrolled}/{cls.capacity}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full transition-all ${getCapacityColor(cls.enrolled, cls.capacity)}`}
                      style={{ width: `${Math.min((cls.enrolled / cls.capacity) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Token Cost */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{cls.tokenCost} {cls.tokenCost === 1 ? "Token" : "Tokens"}</span>
                  </div>
                  {(cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="font-medium">{getRecurringInstances(cls).length} sessions</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetailsPanel(cls);
                      }}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                      title="View Details"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    {/* For recurring parent cards, show "View Bookings" instead of QR */}
                    {cls.status !== 'completed' && (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openBookingsPanel(cls);
                        }}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                        title="View Bookings"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                    ) : cls.status === 'completed' ? (
                      /* For completed classes, show attendance button to view attendees */
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAttendanceModal(cls);
                        }}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                        title="View Attendance"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                    ) : (
                      /* For single active classes, show QR button */
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAttendanceModal(cls);
                        }}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors"
                        title="Start Attendance"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </button>
                    )}
                    {/* Edit Button - Hide for completed classes */}
                    {cls.status !== 'completed' && (
                      <Link 
                        href={`/classes/new?id=${cls.id}`}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
                        title="Edit Class"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(cls);
                      }}
                      disabled={cancelClassMutation.isPending}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Cancel Class"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Class</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Instructor</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Schedule</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Capacity</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tokens</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredClasses.map((cls) => (
                  <tr 
                    key={cls.id} 
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') 
                        ? 'cursor-pointer' 
                        : ''
                    }`}
                    onClick={(e) => {
                      // For completed classes, show details instead of recurring panel
                      if (cls.status === 'completed' && !(e.target as HTMLElement).closest('button, a')) {
                        openDetailsPanel(cls);
                      } else if ((cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') && 
                          !(e.target as HTMLElement).closest('button, a')) {
                        openRecurringPanel(cls);
                      }
                    }}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">{cls.name}</p>
                          {getClassTypeBadge(cls.recurrenceType)}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{cls.duration} minutes</p>
                        {(cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {getRecurringInstances(cls).length} sessions
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-600 text-xs font-medium text-white">
                          {cls.instructorAvatar}
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white">{cls.instructor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {cls.recurrenceType === 'single' ? (
                          <>
                            <p className="font-medium text-gray-900 dark:text-white">{formatClassDate(cls.scheduledAt)}</p>
                            <p className="text-gray-500 dark:text-gray-400">{cls.time}</p>
                          </>
                        ) : (
                          <>
                            {/* For completed classes, show the actual date instead of day of week */}
                            {cls.status === 'completed' ? (
                              <>
                                <p className="font-medium text-gray-900 dark:text-white">{formatClassDate(cls.scheduledAt)}</p>
                                <p className="text-gray-500 dark:text-gray-400">{cls.time}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-gray-900 dark:text-white">{cls.dayOfWeek}</p>
                                <p className="text-gray-500 dark:text-gray-400">{cls.time}</p>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900 dark:text-white">{cls.enrolled}/{cls.capacity}</span>
                          <span className="text-gray-500 dark:text-gray-400">{Math.round((cls.enrolled / cls.capacity) * 100)}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                          <div
                            className={`h-full rounded-full ${getCapacityColor(cls.enrolled, cls.capacity)}`}
                            style={{ width: `${Math.min((cls.enrolled / cls.capacity) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <svg className="h-3 w-3 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{cls.tokenCost}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusStyles(cls.status)}`}>
                        {cls.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* For recurring parent cards, show "View Bookings" instead of QR */}
                        {cls.status !== 'completed' && (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBookingsPanel(cls);
                            }}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                            title="View Bookings"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                        ) : cls.status === 'completed' ? (
                          /* For completed classes, show attendance button to view attendees */
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAttendanceModal(cls);
                            }}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                            title="View Attendance"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                        ) : (
                          /* For single active classes, show QR button */
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAttendanceModal(cls);
                            }}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors"
                            title="Start Attendance"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                          </button>
                        )}
                        {/* Edit Button - Hide for completed classes */}
                        {cls.status !== 'completed' && (
                          <Link 
                            href={`/classes/new?id=${cls.id}`}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
                            title="Edit Class"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(cls);
                          }}
                          disabled={cancelClassMutation.isPending}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Cancel Class"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredClasses.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No classes found</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Attendance Modal */}
      {attendanceModal.classData && (
        <AttendanceModal
          isOpen={attendanceModal.isOpen}
          onClose={closeAttendanceModal}
          classData={{
            id: attendanceModal.classData.id,
            name: attendanceModal.classData.name,
            instructor: attendanceModal.classData.instructor,
            time: attendanceModal.classData.time,
            enrolled: attendanceModal.classData.enrolled,
            capacity: attendanceModal.classData.capacity,
            status: attendanceModal.classData.status,
          }}
        />
      )}

      {/* Recurring Classes Slider Panel */}
      {recurringPanel.isOpen && recurringPanel.parentClass && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={closeRecurringPanel}
          />
          
          {/* Panel */}
          <div className="relative w-full sm:w-[500px] h-[80vh] sm:h-[600px] bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {recurringPanel.parentClass.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {recurringPanel.recurringClasses.length} {recurringPanel.recurringClasses.length === 1 ? 'session' : 'sessions'}
                </p>
              </div>
              <button
                onClick={closeRecurringPanel}
                className="ml-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {recurringPanel.recurringClasses.map((instance) => (
                  <div
                    key={instance.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getStatusStyles(instance.status)}`}>
                            {instance.status}
                          </span>
                          {getClassTypeBadge(instance.recurrenceType)}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {new Date(instance.scheduledAt).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
                            <p className="font-medium text-gray-900 dark:text-white">{instance.time}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Capacity</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {instance.enrolled}/{instance.capacity}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tokens</p>
                            <p className="font-medium text-gray-900 dark:text-white">{instance.tokenCost}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <Link 
                          href={`/classes/new?id=${instance.id}`}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                          title="Edit"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(instance);
                          }}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                          title="Cancel"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Class Details Slider Panel */}
      {detailsPanel.isOpen && detailsPanel.classData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={closeDetailsPanel}
          />
          
          {/* Panel */}
          <div className="relative w-full sm:w-[500px] h-[80vh] sm:h-[600px] bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {detailsPanel.classData.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Class Details
                </p>
              </div>
              <button
                onClick={closeDetailsPanel}
                className="ml-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Status and Type */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getClassTypeBadge(detailsPanel.classData.recurrenceType)}
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getStatusStyles(detailsPanel.classData.status)}`}>
                    {detailsPanel.classData.status}
                  </span>
                </div>

                {/* Description */}
                {detailsPanel.classData.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{detailsPanel.classData.description}</p>
                  </div>
                )}

                {/* Schedule Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date & Time</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {detailsPanel.classData.recurrenceType === 'single' 
                        ? formatClassDate(detailsPanel.classData.scheduledAt)
                        : detailsPanel.classData.dayOfWeek
                      }
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{detailsPanel.classData.time}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{detailsPanel.classData.duration} minutes</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Capacity</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {detailsPanel.classData.enrolled} / {detailsPanel.classData.capacity}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Token Cost</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {detailsPanel.classData.tokenCost} {detailsPanel.classData.tokenCost === 1 ? 'token' : 'tokens'}
                    </p>
                  </div>
                </div>

                {/* Location/Room */}
                {(detailsPanel.classData.roomName || detailsPanel.classData.location) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</h3>
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {detailsPanel.classData.roomName || detailsPanel.classData.location || "No location specified"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Instructor */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Instructor</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-medium text-white">
                      {detailsPanel.classData.instructorAvatar}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{detailsPanel.classData.instructor}</p>
                  </div>
                </div>

                {/* Level and Type */}
                {(detailsPanel.classData.level || detailsPanel.classData.classType) && (
                  <div className="grid grid-cols-2 gap-4">
                    {detailsPanel.classData.level && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Level</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {detailsPanel.classData.level.replace('_', ' ')}
                        </p>
                      </div>
                    )}
                    {detailsPanel.classData.classType && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Class Type</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {detailsPanel.classData.classType}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bookings Panel for Recurring Classes */}
      {bookingsPanel.isOpen && bookingsPanel.parentClass && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={closeBookingsPanel}
          />
          
          {/* Panel */}
          <div className="relative w-full sm:w-[500px] h-[80vh] sm:h-[600px] bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {bookingsPanel.parentClass.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {bookingsPanel.bookings.length} {bookingsPanel.bookings.length === 1 ? 'booking' : 'bookings'} across all sessions
                </p>
              </div>
              <button
                onClick={closeBookingsPanel}
                className="ml-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {bookingsPanel.bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">No bookings found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">No students have booked this class series yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group bookings by class session */}
                  {Array.from(new Set(bookingsPanel.bookings.map(b => b.classId))).map(classId => {
                    const classBookings = bookingsPanel.bookings.filter(b => b.classId === classId);
                    const firstBooking = classBookings[0];
                    const classDate = new Date(firstBooking.scheduledAt);
                    
                    return (
                      <div key={classId} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                        <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                            {firstBooking.className}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {classDate.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })} at {classDate.toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {classBookings.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-medium text-white">
                                {booking.userName
                                  .split(' ')
                                  .map(n => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {booking.userName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {booking.status === 'attended' ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">✓ Attended</span>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400">Confirmed</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cancel Class</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Are you sure you want to cancel <span className="font-medium text-gray-900 dark:text-white">{deleteConfirm.className}</span>? This action will cancel the class and refund tokens to enrolled students.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={cancelClassMutation.isPending}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={cancelClassMutation.isPending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelClassMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cancelling...
                    </span>
                  ) : (
                    "Yes, Cancel Class"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
