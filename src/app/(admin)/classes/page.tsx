"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import DateRangePicker from "@/components/common/DateRangePicker";
import AttendanceModal from "@/components/attendance/AttendanceModal";
import { useInvalidateEntity, createEntityKeys } from "@/hooks/useEntityQuery";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import StudioMenu from "@/components/ui/StudioMenu";
import StudioDate from "@/components/ui/StudioDate";
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
  isOutdoor?: boolean;
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
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore" });
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

// Helper: true if string looks like an avatar URL
function isAvatarUrl(s: string): boolean {
  return typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://'));
}

// Instructor avatar: show image if URL, else initials in a colored circle
function InstructorAvatar({ avatarOrInitials, initials, className = "h-8 w-8" }: {
  avatarOrInitials: string;
  initials: string;
  className?: string;
  gradientClass?: string;
}) {
  if (isAvatarUrl(avatarOrInitials)) {
    return (
      <img
        src={avatarOrInitials}
        alt=""
        className={`${className} rounded-full object-cover`}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center rounded-full bg-neutral-950 text-xs font-medium text-[#E4F56C] ${className}`}>
      {initials}
    </div>
  );
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
    isOutdoor: (cls as any).isOutdoor || false,
  };
}

// Loading timeout in milliseconds (15 seconds)
const LOADING_TIMEOUT = 15000;

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function getCurrentSgtYearMonth() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  return {
    year: parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10),
    month: parseInt(parts.find((p) => p.type === "month")?.value || "1", 10),
  };
}

function getMonthBounds(year: number, month: number) {
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${monthStr}-01`,
    to: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

function toSgtIsoStart(ymd: string) {
  return new Date(`${ymd}T00:00:00+08:00`).toISOString();
}

function toSgtIsoEnd(ymd: string) {
  return new Date(`${ymd}T23:59:59.999+08:00`).toISOString();
}

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
  const currentSgt = getCurrentSgtYearMonth();
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "cancelled" | "full">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list"); // Default to table view
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [dateMode, setDateMode] = useState<"month" | "day" | "range" | "all">("month");
  const [monthFilter, setMonthFilter] = useState<number | "">(currentSgt.month);
  const [yearFilter, setYearFilter] = useState(currentSgt.year);
  const [dayFilter, setDayFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const effectiveDateRange = useMemo(() => {
    if (dateMode === "day" && dayFilter) {
      return { from: dayFilter, to: dayFilter };
    }
    if (dateMode === "month") {
      if (monthFilter) {
        return getMonthBounds(yearFilter, monthFilter);
      }
      return { from: `${yearFilter}-01-01`, to: `${yearFilter}-12-31` };
    }
    if (dateMode === "range" && (dateFrom || dateTo)) {
      return { from: dateFrom, to: dateTo };
    }
    return { from: "", to: "" };
  }, [dateMode, dayFilter, monthFilter, yearFilter, dateFrom, dateTo]);
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
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [refundConfirm, setRefundConfirm] = useState<(typeof bookingsPanel.bookings)[number] | null>(null);
  const [bookingNotice, setBookingNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

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
    queryKey: [...keys.list(), filter, currentPage, pageSize, dateMode, effectiveDateRange.from, effectiveDateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        lifecycle: filter,
      });

      if (filter === "active" || filter === "full") {
        params.set("sort", "scheduled_at_asc");
      } else {
        params.set("sort", "scheduled_at_desc");
      }

      const rangeFrom = effectiveDateRange.from;
      const rangeTo = effectiveDateRange.to;

      if (rangeFrom) {
        params.set("startDate", toSgtIsoStart(rangeFrom));
      }
      if (rangeTo) {
        params.set("endDate", toSgtIsoEnd(rangeTo));
      } else if (filter === "completed" && !rangeFrom) {
        const todayParts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Singapore",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        params.set("endDate", toSgtIsoEnd(todayParts));
      }
      
      const response = await api.get<{ data: ClassListResponse }>(`/api/classes?${params.toString()}`);
      
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
  const totalClasses = classesResponse?.total || 0;
  const hasMore = classesResponse?.hasMore || false;
  const apiStats = classesResponse?.stats; // Aggregated stats from API

  // Fetch instructors for avatar URLs
  const { data: instructorsResponse } = useQuery({
    queryKey: ["instructors", "list"],
    queryFn: async () => {
      const res = await api.get<{ data: { instructors: Array<{ id: string; name: string; avatarUrl: string | null }> } }>("/api/instructors");
      if (res.error) throw new Error(res.error.message);
      return res.data?.data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const instructorsList = instructorsResponse?.instructors ?? [];

  // Map instructor id / name -> avatar URL for lookup
  const avatarByInstructorId = useMemo(() => {
    const map = new Map<string, string>();
    instructorsList.forEach((i) => {
      if (i.avatarUrl) map.set(i.id, i.avatarUrl);
    });
    return map;
  }, [instructorsList]);
  const avatarByInstructorName = useMemo(() => {
    const map = new Map<string, string>();
    instructorsList.forEach((i) => {
      if (!i.avatarUrl) return;
      const n = (i.name || "").toLowerCase().trim().replace(/\s+/g, " ");
      if (n) map.set(n, i.avatarUrl);
      const first = (i.name || "").trim().split(/\s+/)[0]?.toLowerCase();
      if (first && !map.has(first)) map.set(first, i.avatarUrl);
    });
    return map;
  }, [instructorsList]);
  
  // Reset to page 1 when filter or date range changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, dateMode, dayFilter, monthFilter, yearFilter, dateFrom, dateTo]);

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

  // Transform API data to display format (with instructor avatar lookup)
  const classes = useMemo(() => {
    return apiClasses.map(cls => {
      const displayClass = transformClass(cls);
      // Add room name if roomId exists
      if (displayClass.roomId && roomMap.has(displayClass.roomId)) {
        displayClass.roomName = roomMap.get(displayClass.roomId) || null;
      }
      // Resolve instructor avatar: by id first, then by name (full or first name)
      const avatarUrl =
        (cls.instructorId && avatarByInstructorId.get(cls.instructorId)) ??
        (cls.instructorName
          ? avatarByInstructorName.get(cls.instructorName.trim().toLowerCase().replace(/\s+/g, " ")) ??
            avatarByInstructorName.get(cls.instructorName.trim().split(/\s+/)[0]?.toLowerCase() ?? "")
          : null);
      displayClass.instructorAvatar = avatarUrl || getInitials(cls.instructorName);
      return displayClass;
    });
  }, [apiClasses, roomMap, avatarByInstructorId, avatarByInstructorName]);

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

  const handleAdminCancelAndRefund = async (booking: (typeof bookingsPanel.bookings)[number]) => {
    setCancellingBookingId(booking.id);
    setBookingNotice(null);
    const response = await api.delete(`/api/bookings/${booking.id}`, {
      userId: booking.userId,
      forceRefund: true,
      reason: 'Same-day booking is not allowed. Your booking has been cancelled and your token has been fully refunded. We apologize for the inconvenience.',
    });
    setCancellingBookingId(null);
    setRefundConfirm(null);

    if (response.error) {
      setBookingNotice({ tone: "error", text: response.error.message || "Failed to cancel the booking" });
      return;
    }

    setBookingsPanel((current) => ({
      ...current,
      bookings: current.bookings.filter((item) => item.id !== booking.id),
    }));
    setBookingNotice({ tone: "ok", text: "Booking cancelled, tokens refunded, and the email is queued." });
  };

  // Combine single and recurring parent classes for display
  // For "completed" filter, show individual completed instances instead of parent cards
  const displayClasses = useMemo(() => {
    if (filter === "completed") {
      // For completed filter, show all individual completed classes (including occurrences)
      // Sort by most recent first (descending)
      return classes.filter(c => c.status === "completed").sort((a, b) => 
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      );
    }
    // For other filters, show parent cards for recurring classes
    const combined = [...groupedClasses.single, ...groupedClasses.recurring];
    const now = new Date();

    if (filter === "active" || filter === "full") {
      // Upcoming-first (soonest first)
      return combined.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }

    if (filter === "cancelled") {
      // Most recent first
      return combined.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    }

    // "All": show recent past first, then upcoming soonest.
    const pastOrNow: DisplayClass[] = [];
    const future: DisplayClass[] = [];
    combined.forEach((c) => {
      const t = new Date(c.scheduledAt).getTime();
      if (t <= now.getTime()) pastOrNow.push(c);
      else future.push(c);
    });
    pastOrNow.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    future.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return [...pastOrNow, ...future];
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
    const matchesSearch =
      cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.instructor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const pageStart = totalClasses === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalClasses);
  const totalPages = Math.max(1, Math.ceil(totalClasses / pageSize));

  const getStatusStyles = (status: DisplayClass["status"]) => {
    switch (status) {
      case "active":
        return "border-transparent bg-[#E4F56C] text-neutral-950";
      case "cancelled":
        return "border-transparent bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50";
      case "full":
        return "border-transparent bg-neutral-950 text-[#E4F56C]";
      case "completed":
        return "border-transparent bg-neutral-950 text-white";
      default:
        return "border-transparent bg-neutral-100 text-neutral-700";
    }
  };

  const getCapacityColor = (enrolled: number, capacity: number) => {
    const percentage = (enrolled / capacity) * 100;
    if (percentage >= 100) return "bg-[#E4F56C]";
    if (percentage >= 50) return "bg-neutral-950 dark:bg-white";
    return "bg-neutral-300 dark:bg-white/30";
  };

  // Stats: use API aggregated stats (all classes in filter/date range) when available
  const stats = apiStats ? {
    total: apiStats.total,
    active: apiStats.active,
    completed: apiStats.completed,
    full: apiStats.full,
    cancelled: apiStats.cancelled,
    totalEnrolled: apiStats.totalEnrolled ?? classes.reduce((sum, c) => sum + c.enrolled, 0),
    totalCapacity: apiStats.totalCapacity ?? classes.reduce((sum, c) => sum + c.capacity, 0),
  } : {
    total: totalClasses,
    active: classes.filter((c) => c.status === "active").length,
    completed: classes.filter((c) => c.status === "completed").length,
    full: classes.filter((c) => c.status === "full").length,
    cancelled: classes.filter((c) => c.status === "cancelled").length,
    totalEnrolled: classes.reduce((sum, c) => sum + c.enrolled, 0),
    totalCapacity: classes.reduce((sum, c) => sum + c.capacity, 0),
  };
  const hasDateFilter = Boolean(effectiveDateRange.from || effectiveDateRange.to);
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentSgt.year + 1; y >= currentSgt.year - 2; y--) {
      years.push(y);
    }
    return years;
  }, [currentSgt.year]);

  // Helper to get class type badge
  const getClassTypeBadge = (recurrenceType?: 'single' | 'recurring' | 'course') => {
    const type = recurrenceType || 'single';
    
    const badges = {
        single: {
        label: 'Single',
        className: 'border-transparent bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/70',
      },
      recurring: {
        label: 'Recurring',
        className: 'border-transparent bg-neutral-950 text-white',
      },
      course: {
        label: 'Course',
        className: 'border-transparent bg-[#E4F56C] text-neutral-950',
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
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Classes</h1>
        
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
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Classes</h1>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
            Classes{" "}
            <span className="inline-flex h-7 w-9 translate-y-[-1px] items-center justify-center rounded-full bg-[#E4F56C] align-middle text-neutral-950">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-white/50">
            {hasDateFilter ? "Stats below are for the selected date range. " : ""}
            Booked counts match the Booking Report. Use the people icon on a class to see who booked.
          </p>
        </div>
        <Link
          href="/classes/new"
          className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          <span className="text-base leading-none">+</span>
          Add Class
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <p className="text-sm font-medium text-neutral-500 dark:text-white/60">Total Classes</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">{stats.total}</p>
        </div>
        <div className="rounded-[28px] border border-[#d5e45c] bg-[#E4F56C] p-5 text-neutral-950 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <p className="text-sm font-medium">Active</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{stats.active}</p>
        </div>
        <div className="rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800" title="Total bookings across all classes in current view">
          <p className="text-sm font-medium text-neutral-500 dark:text-white/60">Booked</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {stats.totalEnrolled}
            <span className="text-lg font-medium text-neutral-400">/{stats.totalCapacity}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-400">confirmed + attended + no-show</p>
        </div>
        <div className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-5 text-white shadow-[0_10px_30px_rgba(16,24,40,0.14)]" title="Enrolled ÷ total capacity across all classes">
          <p className="text-sm font-medium text-white/60">Fill Rate</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">
            {stats.totalCapacity > 0 ? Math.round((stats.totalEnrolled / stats.totalCapacity) * 100) : 0}%
          </p>
          <p className="mt-1 text-xs text-white/50">overall</p>
        </div>
      </div>

      {/* Date filters: by month, by day, or custom range */}
      <div className="rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-white/70">Show classes for</span>
            {([
              { key: "month" as const, label: "Month" },
              { key: "day" as const, label: "Day" },
              { key: "range" as const, label: "Custom range" },
              { key: "all" as const, label: "All time" },
            ]).map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => {
                  setDateMode(mode.key);
                  if (mode.key === "month" && !monthFilter) {
                    setMonthFilter(currentSgt.month);
                    setYearFilter(currentSgt.year);
                  }
                }}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  dateMode === mode.key
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {dateMode === "month" && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-44">
                <StudioMenu
                  value={monthFilter === "" ? "all" : String(monthFilter)}
                  onChange={(value) => setMonthFilter(value === "all" ? "" : parseInt(value, 10))}
                  placeholder="All months"
                  options={[{ value: "all", label: "All months" }, ...MONTH_OPTIONS.map((m) => ({ value: String(m.value), label: m.label }))]}
                />
              </div>
              <div className="w-32">
                <StudioMenu
                  value={String(yearFilter)}
                  onChange={(value) => setYearFilter(parseInt(value, 10))}
                  placeholder="Year"
                  options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
                />
              </div>
              {monthFilter && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {MONTH_OPTIONS.find((m) => m.value === monthFilter)?.label} {yearFilter}
                </span>
              )}
            </div>
          )}

          {dateMode === "day" && (
            <div className="flex flex-wrap items-center gap-3">
              <StudioDate ariaLabel="Class day" value={dayFilter} onChange={setDayFilter} />
              <button
                type="button"
                onClick={() => {
                  const today = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Singapore",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date());
                  setDayFilter(today);
                }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Today
              </button>
            </div>
          )}

          {dateMode === "range" && (
            <div className="flex flex-wrap items-center gap-3">
              <DateRangePicker
                value={{ from: dateFrom, to: dateTo }}
                onChange={(from, to) => {
                  setDateFrom(from);
                  setDateTo(to);
                }}
                placeholder="Select date range"
                presets={["today", "week", "month", "clear"]}
              />
            </div>
          )}

          {hasDateFilter && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {effectiveDateRange.from === effectiveDateRange.to
                ? `Showing classes on ${effectiveDateRange.from}`
                : `Showing classes from ${effectiveDateRange.from} to ${effectiveDateRange.to}`}
            </p>
          )}
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
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
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                filter === tab.key
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15"
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                filter === tab.key
                  ? "bg-[#E4F56C] text-neutral-950"
                  : "bg-white text-neutral-500 dark:bg-white/10 dark:text-white/60"
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
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-300 focus:outline-none focus:ring-0 dark:border-white/10 dark:bg-white/5 dark:text-white sm:w-56"
            />
          </div>

          <div className="flex overflow-hidden rounded-full border border-neutral-200 dark:border-white/10">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-neutral-950 text-white" : "text-neutral-500"}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-neutral-950 text-white" : "text-neutral-500"}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

        </div>
      </div>

      {/* Classes Grid */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((cls) => (
            <div
              key={cls.id}
              className={`group relative overflow-hidden rounded-[28px] border shadow-[0_10px_30px_rgba(16,24,40,0.04)] transition-all ${
                (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') 
                  ? 'cursor-pointer border-[#E4F56C] bg-[#E4F56C]/25' 
                  : 'border-neutral-200/80 bg-white dark:border-white/10 dark:bg-gray-800'
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
                      {cls.isOutdoor && (
                        <span className="inline-flex rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                          Outdoors
                        </span>
                      )}
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
                  <InstructorAvatar
                    avatarOrInitials={cls.instructorAvatar}
                    initials={getInitials(cls.instructor)}
                    className="h-10 w-10"
                    gradientClass={(cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course')
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                      : 'bg-linear-to-br from-blue-500 to-purple-600'}
                  />
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
                        title="View Attendance"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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
        <div className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[minmax(220px,1.7fr)_150px_130px_168px_64px_108px_132px] items-center gap-3 border-b border-neutral-100 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400 dark:border-white/10">
                <span>Class</span>
                <span>Instructor</span>
                <span>Schedule</span>
                <span>Booked</span>
                <span>Tokens</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              {filteredClasses.map((cls) => {
                const fill = cls.capacity > 0 ? Math.round((cls.enrolled / cls.capacity) * 100) : 0;
                const slots = Math.min(Math.max(cls.capacity, 1), 7);
                const filledSlots = cls.capacity > 7 ? Math.round((fill / 100) * slots) : Math.min(cls.enrolled, slots);
                const isFull = cls.capacity > 0 && cls.enrolled >= cls.capacity;
                const scheduleDate = cls.recurrenceType !== "single" && cls.status !== "completed"
                  ? cls.dayOfWeek
                  : formatClassDate(cls.scheduledAt);
                const iconBtn = "inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 transition-colors hover:bg-neutral-950 hover:text-white dark:bg-white/10 dark:text-white dark:hover:bg-[#E4F56C] dark:hover:text-neutral-950";
                return (
                  <div
                    key={cls.id}
                    className={`grid grid-cols-[minmax(220px,1.7fr)_150px_130px_168px_64px_108px_132px] items-center gap-3 border-b border-neutral-100 px-5 py-4 last:border-0 dark:border-white/10 ${
                      isFull ? "bg-[#E4F56C]/35" : "hover:bg-neutral-50 dark:hover:bg-white/5"
                    } ${
                      (cls.recurrenceType === "recurring" || cls.recurrenceType === "course") ? "cursor-pointer" : ""
                    }`}
                    onClick={(e) => {
                      if (cls.status === "completed" && !(e.target as HTMLElement).closest("button, a")) {
                        openDetailsPanel(cls);
                      } else if ((cls.recurrenceType === "recurring" || cls.recurrenceType === "course") &&
                          !(e.target as HTMLElement).closest("button, a")) {
                        openRecurringPanel(cls);
                      }
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">{cls.name}</p>
                        {getClassTypeBadge(cls.recurrenceType)}
                        {cls.isOutdoor && (
                          <span className="inline-flex rounded-full bg-[#E4F56C] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-950">
                            Outdoors
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-neutral-400">{cls.duration} minutes</p>
                      {(cls.recurrenceType === "recurring" || cls.recurrenceType === "course") && (
                        <p className="mt-0.5 text-xs font-medium text-neutral-950 dark:text-white">
                          {getRecurringInstances(cls).length} sessions
                        </p>
                      )}
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <InstructorAvatar
                        avatarOrInitials={cls.instructorAvatar}
                        initials={getInitials(cls.instructor)}
                        className="h-8 w-8 shrink-0"
                      />
                      <span className="truncate text-sm font-medium text-neutral-800 dark:text-white">{cls.instructor}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{cls.time}</p>
                      <p className="text-xs text-neutral-400">{scheduleDate}</p>
                    </div>
                    <div title={cls.enrolled > 0 ? "Click the people icon in Actions to see names" : "No bookings"}>
                      <div className="flex gap-1" aria-hidden>
                        {Array.from({ length: slots }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-6 w-[9px] rounded-full ${
                              i < filledSlots
                                ? isFull
                                  ? "bg-neutral-950"
                                  : "bg-neutral-950 dark:bg-white"
                                : "border border-dashed border-neutral-300 dark:border-white/25"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-neutral-800 dark:text-white">
                        {cls.enrolled}/{cls.capacity}
                        <span className="ml-1.5 font-medium text-neutral-400">{fill}%</span>
                      </p>
                    </div>
                    <div>
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-neutral-950 px-2 text-sm font-semibold text-[#E4F56C]">
                        {cls.tokenCost}
                      </span>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusStyles(cls.status)}`}>
                        {cls.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                        {/* For recurring parent cards, show "View Bookings" instead of QR */}
                        {cls.status !== 'completed' && (cls.recurrenceType === 'recurring' || cls.recurrenceType === 'course') ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBookingsPanel(cls);
                            }}
                            className={iconBtn}
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
                            className={iconBtn}
                            title="View Attendance"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                        ) : (
                          /* For single active classes, show attendance button */
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAttendanceModal(cls);
                            }}
                            className={iconBtn}
                            title="View Attendance"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                        )}
                        {/* Edit Button - Hide for completed classes */}
                        {cls.status !== 'completed' && (
                          <Link 
                            href={`/classes/new?id=${cls.id}`}
                            className={iconBtn}
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-white/60"
                          title="Cancel Class"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalClasses > 0 && (
        <div className="flex flex-col gap-3 rounded-[28px] border border-neutral-200/80 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pageStart} to {pageEnd} of {totalClasses} classes
            {searchQuery && filteredClasses.length !== displayClasses.length && (
              <span> ({filteredClasses.length} match search on this page)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || isLoading}
              className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-gray-800 dark:text-white"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-gray-800 dark:text-white"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasMore || isLoading}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-gray-800 dark:text-white"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages || isLoading}
              className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-gray-800 dark:text-white"
            >
              Last
            </button>
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
        <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-stretch sm:justify-end">
          <button
            type="button"
            aria-label="Close sessions"
            className="fixed inset-0 bg-neutral-950/55 backdrop-blur-[2px]"
            onClick={closeRecurringPanel}
          />
          <div className="relative flex h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-neutral-200/80 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800 sm:h-full sm:max-w-[480px] sm:rounded-none sm:rounded-l-[28px]">
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Sessions</p>
                <h2 className="mt-1 truncate text-2xl font-semibold uppercase tracking-tight text-neutral-950 dark:text-white">
                  {recurringPanel.parentClass.name}
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
                  {recurringPanel.recurringClasses.length} {recurringPanel.recurringClasses.length === 1 ? "session" : "sessions"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRecurringPanel}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <div className="space-y-3">
                {recurringPanel.recurringClasses.map((instance) => (
                  <div
                    key={instance.id}
                    className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusStyles(instance.status)}`}>
                            {instance.status}
                          </span>
                          {getClassTypeBadge(instance.recurrenceType)}
                        </div>
                        <p className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">{instance.time}</p>
                        <p className="mt-0.5 text-sm text-neutral-500 dark:text-white/50">
                          {new Date(instance.scheduledAt).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            timeZone: "Asia/Singapore",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <span className="rounded-full bg-white px-3 py-1 font-medium text-neutral-950 dark:bg-neutral-950 dark:text-white">
                            {instance.enrolled}/{instance.capacity} booked
                          </span>
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-neutral-950 px-2 text-xs font-semibold text-[#E4F56C]">
                            {instance.tokenCost}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/classes/new?id=${instance.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm transition-colors hover:bg-[#E4F56C] hover:text-neutral-950 dark:bg-white/10 dark:text-white"
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-white/10 dark:text-white/60"
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
        <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-stretch sm:justify-end">
          <button
            type="button"
            aria-label="Close details"
            className="fixed inset-0 bg-neutral-950/55 backdrop-blur-[2px]"
            onClick={closeDetailsPanel}
          />
          <div className="relative flex h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-neutral-200/80 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800 sm:h-full sm:max-w-[480px] sm:rounded-none sm:rounded-l-[28px]">
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Class details</p>
                <h2 className="mt-1 text-2xl font-semibold uppercase tracking-tight text-neutral-950 dark:text-white">
                  {detailsPanel.classData.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDetailsPanel}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  {getClassTypeBadge(detailsPanel.classData.recurrenceType)}
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusStyles(detailsPanel.classData.status)}`}>
                    {detailsPanel.classData.status}
                  </span>
                </div>

                {detailsPanel.classData.description && (
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-white/70">{detailsPanel.classData.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">When</p>
                    <p className="mt-2 text-lg font-semibold leading-tight">
                      {detailsPanel.classData.recurrenceType === "single"
                        ? formatClassDate(detailsPanel.classData.scheduledAt)
                        : detailsPanel.classData.dayOfWeek}
                    </p>
                    <p className="mt-1 text-sm text-[#E4F56C]">{detailsPanel.classData.time}</p>
                  </div>
                  <div className="rounded-[22px] bg-[#E4F56C] p-4 text-neutral-950">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-950/50">Booked</p>
                    <p className="mt-2 text-3xl font-semibold leading-none">
                      {detailsPanel.classData.enrolled}
                      <span className="text-lg text-neutral-950/50">/{detailsPanel.classData.capacity}</span>
                    </p>
                    <p className="mt-2 text-sm">{detailsPanel.classData.duration} min</p>
                  </div>
                  <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Tokens</p>
                    <p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">{detailsPanel.classData.tokenCost}</p>
                  </div>
                  <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Instructor</p>
                    <div className="mt-2 flex items-center gap-2">
                      <InstructorAvatar
                        avatarOrInitials={detailsPanel.classData.instructorAvatar}
                        initials={getInitials(detailsPanel.classData.instructor)}
                        className="h-8 w-8"
                      />
                      <p className="truncate text-sm font-medium text-neutral-950 dark:text-white">{detailsPanel.classData.instructor}</p>
                    </div>
                  </div>
                </div>

                {(detailsPanel.classData.roomName || detailsPanel.classData.location) && (
                  <div className="rounded-[22px] border border-neutral-200/80 px-4 py-3 dark:border-white/10">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Location</p>
                    <p className="mt-1 text-sm font-medium text-neutral-950 dark:text-white">
                      {detailsPanel.classData.roomName || detailsPanel.classData.location}
                    </p>
                  </div>
                )}

                {(detailsPanel.classData.level || detailsPanel.classData.classType) && (
                  <div className="flex flex-wrap gap-2">
                    {detailsPanel.classData.level && (
                      <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium capitalize text-neutral-700 dark:bg-white/10 dark:text-white">
                        {detailsPanel.classData.level.replace("_", " ")}
                      </span>
                    )}
                    {detailsPanel.classData.classType && (
                      <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium capitalize text-neutral-700 dark:bg-white/10 dark:text-white">
                        {detailsPanel.classData.classType}
                      </span>
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
        <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-stretch sm:justify-end">
          <button
            type="button"
            aria-label="Close bookings"
            className="fixed inset-0 bg-neutral-950/55 backdrop-blur-[2px]"
            onClick={closeBookingsPanel}
          />
          <div className="relative flex h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-neutral-200/80 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800 sm:h-full sm:max-w-[480px] sm:rounded-none sm:rounded-l-[28px]">
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Bookings</p>
                <h2 className="mt-1 text-2xl font-semibold uppercase tracking-tight text-neutral-950 dark:text-white">
                  {bookingsPanel.parentClass.name}
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
                  {bookingsPanel.bookings.length} {bookingsPanel.bookings.length === 1 ? "booking" : "bookings"} across all sessions
                </p>
              </div>
              <button
                type="button"
                onClick={closeBookingsPanel}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {bookingNotice && (
              <div className={`mx-5 mb-3 rounded-full px-4 py-2 text-center text-xs font-medium ${bookingNotice.tone === "ok" ? "bg-[#E4F56C] text-neutral-950" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"}`}>
                {bookingNotice.text}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {bookingsPanel.bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-950 text-[#E4F56C]">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="font-medium text-neutral-950 dark:text-white">No bookings yet</p>
                  <p className="mt-1 text-sm text-neutral-500">Nobody has booked this series.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from(new Set(bookingsPanel.bookings.map(b => b.classId))).map(classId => {
                    const classBookings = bookingsPanel.bookings.filter(b => b.classId === classId);
                    const firstBooking = classBookings[0];
                    const classDate = new Date(firstBooking.scheduledAt);

                    return (
                      <div key={classId} className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="mb-3">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
                            {firstBooking.className}
                          </h3>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-white/50">
                            {classDate.toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "Asia/Singapore",
                            })}{" "}
                            · {classDate.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Singapore",
                            })}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {classBookings.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 dark:bg-gray-800"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-[#E4F56C]">
                                {booking.userName
                                  .split(" ")
                                  .map(n => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-neutral-950 dark:text-white">
                                  {booking.userName}
                                </p>
                                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${booking.status === "attended" ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/70"}`}>
                                  {booking.status === "attended" ? "Attended" : "Confirmed"}
                                </span>
                              </div>
                              {booking.status === "confirmed" && booking.userId && (
                                <button
                                  type="button"
                                  onClick={() => setRefundConfirm(booking)}
                                  disabled={cancellingBookingId === booking.id}
                                  className="shrink-0 rounded-full bg-neutral-950 px-3 py-2 text-[11px] font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {cancellingBookingId === booking.id ? "Cancelling…" : "Refund"}
                                </button>
                              )}
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
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-neutral-950/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[28px] border border-neutral-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-[#E4F56C]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Confirm</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Cancel this class</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-white/60">
              <span className="font-semibold uppercase text-neutral-950 dark:text-white">{deleteConfirm.className}</span> will be cancelled and tokens refunded to everyone booked.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={cancelClassMutation.isPending}
                className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white"
              >
                Keep class
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={cancelClassMutation.isPending}
                className="flex-1 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelClassMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling
                  </span>
                ) : (
                  "Cancel class"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {refundConfirm && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-neutral-950/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[28px] border border-neutral-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E4F56C] text-neutral-950">
              <span className="text-sm font-semibold">
                {refundConfirm.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </span>
            </div>
            <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Refund</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Cancel this booking</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-white/60">
              <span className="font-semibold text-neutral-950 dark:text-white">{refundConfirm.userName}</span> will be removed, their tokens refunded, and a cancellation email sent.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setRefundConfirm(null)}
                disabled={cancellingBookingId === refundConfirm.id}
                className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white"
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={() => handleAdminCancelAndRefund(refundConfirm)}
                disabled={cancellingBookingId === refundConfirm.id}
                className="flex-1 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancellingBookingId === refundConfirm.id ? "Cancelling" : "Refund tokens"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
