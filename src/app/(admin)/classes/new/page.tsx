"use client";

import { useState, useMemo, useEffect, useRef, Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import StudioDate from "@/components/ui/StudioDate";
import Select from "@/components/form/Select";
import { 
  useInstructors, 
  useRooms, 
  useClassCategories, 
  useCreateClass,
  useClass,
  useUpdateClass,
  CreateClassData,
} from "@/hooks/useClasses";
import { useClassCategories as useCategoriesHook } from "@/hooks/useClassCategories";
import CategoryCreatePanel from "@/components/categories/CategoryCreatePanel";
import { useToast } from "@/components/ui/Toast";

const classTypes = [
  { value: "single", label: "Single Class - One-time class" },
  { value: "recurring", label: "Recurring Class - Repeats weekly" },
  { value: "course", label: "Course/Series - Fixed multi-week program" },
];

const daysOfWeek = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

const levels = [
  { value: "all_levels", label: "All Levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const fieldClass =
  "!h-12 !rounded-2xl !border-neutral-200 !bg-neutral-50 !shadow-none !text-neutral-950 placeholder:!text-neutral-400 focus:!border-neutral-950 focus:!ring-neutral-950/10 dark:!border-white/10 dark:!bg-white/5 dark:!text-white";

function StudioSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">{title}</h2>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function PageHeading({ title }: { title: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Classes</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
          {title}{" "}
          <span className="inline-flex h-7 w-9 translate-y-[-1px] items-center justify-center rounded-full bg-[#E4F56C] align-middle text-neutral-950">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
            </svg>
          </span>
        </h1>
      </div>
      <Link
        href="/classes"
        className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
      >
        Back to classes
      </Link>
    </div>
  );
}

// Skeleton Components
const FormFieldSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
    <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
  </div>
);

const FormSectionSkeleton = () => (
  <div className="animate-pulse rounded-[28px] border border-neutral-200/80 bg-white p-6 dark:border-white/10 dark:bg-gray-800">
    <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
    <div className="grid gap-6 sm:grid-cols-2">
      <FormFieldSkeleton />
      <FormFieldSkeleton />
      <FormFieldSkeleton />
      <FormFieldSkeleton />
    </div>
  </div>
);

function NewClassPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const classId = searchParams.get("id");
  const isEditMode = !!classId;
  
  // Fetch data from API
  const { data: instructors = [], isLoading: loadingInstructors } = useInstructors();
  const { data: rooms = [], isLoading: loadingRooms } = useRooms();
  const { data: categories = [], isLoading: loadingCategories, refetch: refetchCategories } = useCategoriesHook();
  
  // Also get categories from useClassCategories for backward compatibility
  const { data: categoriesLegacy = [] } = useClassCategories();
  const allCategories = categories.length > 0 ? categories : categoriesLegacy;
  
  // Fetch class data if editing
  const { data: existingClass, isLoading: loadingClass, error: classError } = useClass(classId || "");
  
  // Create/Update class mutations
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  
  const [classType, setClassType] = useState("single");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [formPopulated, setFormPopulated] = useState(false);
  const previousRoomRef = useRef<string>("");
  const isInitialPopulationRef = useRef<boolean>(false);
  // Multiple time slots for single-class create (same day, same tutor, different times)
  const [timeSlots, setTimeSlots] = useState<Array<{ startTime: string; duration: string }>>([
    { startTime: "08:00", duration: "60" },
  ]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    instructor: [] as string[], // Changed to array for multiple instructors
    room: "",
    level: "all_levels",
    ageGroup: "all", // Adult/Kid/Both
    // Single class fields
    date: "",
    // Recurring class fields
    startDate: "",
    endDate: "",
    // Course fields
    courseWeeks: "8",
    courseStartDate: "",
    // Common fields
    startTime: "",
    duration: "60",
    capacity: "20",
    tokenCost: "1",
    // Drop-in/walk-in settings
    allowDropIn: false,
    dropInTokenCost: "",
    // Location type
    isOutdoor: false,
  });

  // Populate form when class data is loaded (edit mode)
  useEffect(() => {
    if (isEditMode) {
      console.log('[Form Population Check]');
      console.log('  - existingClass:', !!existingClass);
      console.log('  - loadingClass:', loadingClass);
      console.log('  - loadingInstructors:', loadingInstructors);
      console.log('  - loadingRooms:', loadingRooms);
      console.log('  - loadingCategories:', loadingCategories);
      console.log('  - formPopulated:', formPopulated);
      console.log('  - instructors.length:', instructors.length);
      console.log('  - rooms.length:', rooms.length);
      console.log('  - allCategories.length:', allCategories.length);
    }
    
    if (
      existingClass && 
      isEditMode && 
      !loadingClass && 
      !formPopulated
    ) {
      console.log('[Form Population] ✓ All conditions met, populating form...');
      console.log('[Form Population] Class data:', existingClass);
      // Convert UTC time back to Singapore time (UTC+8) for display
      const scheduledDate = new Date(existingClass.scheduledAt);
      // Get UTC date components
      const utcYear = scheduledDate.getUTCFullYear();
      const utcMonth = scheduledDate.getUTCMonth();
      const utcDate = scheduledDate.getUTCDate();
      const utcHours = scheduledDate.getUTCHours();
      const utcMinutes = scheduledDate.getUTCMinutes();
      
      // Convert UTC to Singapore time (add 8 hours)
      const sgHours = utcHours + 8;
      let sgDate = new Date(Date.UTC(utcYear, utcMonth, utcDate, sgHours, utcMinutes));
      
      // Handle day rollover if Singapore hours exceed 24
      if (sgHours >= 24) {
        sgDate = new Date(Date.UTC(utcYear, utcMonth, utcDate + 1, sgHours - 24, utcMinutes));
      }
      
      // Format date string (in Singapore time)
      const year = sgDate.getUTCFullYear();
      const month = String(sgDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(sgDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Format time string (in Singapore time)
      const hours = String(sgDate.getUTCHours()).padStart(2, '0');
      const minutes = String(sgDate.getUTCMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      
      // Determine class type from recurrence
      // Check if this is an individual instance (has date suffix in title like "Class Name - 1/10/2026")
      const isIndividualInstance = /-\s*\d{1,2}\/\d{1,2}\/\d{4}$/.test(existingClass.title || "");
      
      let detectedClassType = "single";
      // If it's an individual instance, always treat it as "single" for editing
      // This allows editing just that one instance without affecting the series
      if (!isIndividualInstance && existingClass.recurrenceType) {
        detectedClassType = existingClass.recurrenceType;
      }
      
      // Extract days from recurrence pattern if it exists (only for parent classes)
      let days: string[] = [];
      if (!isIndividualInstance && existingClass.recurrencePattern && typeof existingClass.recurrencePattern === 'object') {
        const pattern = existingClass.recurrencePattern as any;
        if (pattern.days && Array.isArray(pattern.days)) {
          days = pattern.days;
        }
      }
      
      // Get IDs - handle both null and undefined, convert to empty string if null/undefined
      const categoryId = existingClass.categoryId ? String(existingClass.categoryId) : "";
      const instructorId = existingClass.instructorId ? String(existingClass.instructorId) : "";
      const roomId = existingClass.roomId ? String(existingClass.roomId) : "";
      const level = existingClass.level ? String(existingClass.level) : "all_levels";
      
      // Handle instructor - convert to array format
      // If instructor_name contains commas, try to parse multiple instructors
      // Otherwise, use the single instructorId
      const instructorArray = instructorId ? [instructorId] : [];
      
      setClassType(detectedClassType);
      setSelectedDays(days);
      
      setFormData(prev => ({
        ...prev,
        name: existingClass.title || "",
        description: existingClass.description || "",
        category: categoryId,
        instructor: instructorArray, // Keep as array
        room: roomId,
        level: level,
        ageGroup: (existingClass as any).ageGroup || "all", // Default to 'all' if not set
        allowDropIn: (existingClass as any).allowDropIn || false,
        dropInTokenCost: (existingClass as any).dropInTokenCost ? String((existingClass as any).dropInTokenCost) : "",
        isOutdoor: (existingClass as any).isOutdoor || false,
        date: (detectedClassType === "single" || isIndividualInstance) ? dateStr : prev.date,
        startDate: detectedClassType === "recurring" && !isIndividualInstance ? dateStr : prev.startDate,
        endDate: detectedClassType === "recurring" && !isIndividualInstance && existingClass.recurrencePattern 
          ? (existingClass.recurrencePattern as any).endDate?.split('T')[0] || "" 
          : prev.endDate,
        courseWeeks: detectedClassType === "course" && !isIndividualInstance && existingClass.recurrencePattern
          ? String(Math.ceil(((existingClass.recurrencePattern as any).occurrences || 8) / (days.length || 1)))
          : prev.courseWeeks,
        courseStartDate: detectedClassType === "course" && !isIndividualInstance ? dateStr : prev.courseStartDate,
        startTime: timeStr,
        duration: String(existingClass.durationMinutes || 60),
        capacity: String(existingClass.capacity || 20),
        tokenCost: String(existingClass.tokenCost || 1),
      }));
      
      setFormPopulated(true);
      isInitialPopulationRef.current = true;
      // Set the previous room ref to the loaded room so we don't auto-populate on initial load
      previousRoomRef.current = roomId;
      
      // Reset the initial population flag after a short delay
      setTimeout(() => {
        isInitialPopulationRef.current = false;
      }, 1000);
    }
  }, [
    existingClass, 
    isEditMode, 
    loadingClass, 
    formPopulated
  ]);

  // Handle class loading errors
  useEffect(() => {
    if (classError && isEditMode && !loadingClass) {
      console.error('[Edit Class] Error loading class:', classError);
      toast.showToast('Failed to load class details. The class may not exist.', 'error');
      // Optionally redirect back to classes list after a delay
      setTimeout(() => {
        router.push('/admin/classes');
      }, 2000);
    }
  }, [classError, isEditMode, loadingClass, router, toast]);

  // Format instructors for Select component
  const instructorOptions = useMemo(() => {
    console.log('[instructorOptions] instructors:', instructors, 'type:', typeof instructors, 'isArray:', Array.isArray(instructors));
    if (!Array.isArray(instructors)) return [];
    return instructors.map((i) => ({ value: i.id, label: i.name }));
  }, [instructors]);

  // Format rooms for Select component
  const roomOptions = useMemo(() => {
    console.log('[roomOptions] rooms:', rooms, 'type:', typeof rooms, 'isArray:', Array.isArray(rooms));
    if (!Array.isArray(rooms)) return [];
    return rooms.map((r) => ({ value: r.id, label: `${r.name}${r.location ? ` (${r.location})` : ''}` }));
  }, [rooms]);

  // Format categories for Select component
  const categoryOptions = useMemo(() => 
    allCategories.map((c) => ({ value: c.id, label: c.name })),
    [allCategories]
  );

  // Auto-populate capacity when room is selected
  useEffect(() => {
    // Skip auto-population during initial form population (edit mode)
    if (isInitialPopulationRef.current) return;
    
    // Only auto-populate if room actually changed (not on initial load or other updates)
    if (formData.room && formData.room !== previousRoomRef.current && rooms.length > 0) {
      const selectedRoom = rooms.find(r => r.id === formData.room);
      if (selectedRoom && selectedRoom.capacity) {
        setFormData(prev => ({
          ...prev,
          capacity: String(selectedRoom.capacity),
        }));
      }
      previousRoomRef.current = formData.room;
    } else if (!formData.room) {
      // Reset ref when room is cleared
      previousRoomRef.current = "";
    }
  }, [formData.room, rooms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if editing an individual instance (has date suffix in title)
    const isIndividualInstance = existingClass && /-\s*\d{1,2}\/\d{1,2}\/\d{4}$/.test(existingClass.title || "");

    // Validate date and time before any conversion (avoid uncaught throw)
    const dateStr = classType === "single" || isIndividualInstance ? formData.date : classType === "recurring" ? formData.startDate : formData.courseStartDate;
    // Single class with multiple time slots uses timeSlots[].startTime, not formData.startTime
    const hasTime = classType === "single" && !isIndividualInstance && timeSlots.length > 0
      ? timeSlots.some((s) => s.startTime?.trim())
      : Boolean(formData.startTime?.trim());
    if (!dateStr?.trim() || !hasTime) {
      toast.showToast("Please enter both date and time.", "error");
      return;
    }

    // Build scheduled datetime
    // IMPORTANT: The time input is ALWAYS in Singapore time (SGT, UTC+8)
    // We need to convert it to UTC for storage, regardless of admin's location
    const convertSGTimeToUTC = (dateStr: string, timeStr: string): string => {
      if (!dateStr?.trim() || !timeStr?.trim()) {
        throw new Error("Please enter both date and time.");
      }
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        throw new Error("Please enter a valid time (e.g. 09:00).");
      }
      const dateParts = dateStr.split('-').map(Number);
      if (dateParts.length !== 3 || dateParts.some((n) => Number.isNaN(n))) {
        throw new Error("Please enter a valid date.");
      }
      const baseDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0));
      if (Number.isNaN(baseDate.getTime())) {
        throw new Error("Please enter a valid date.");
      }
      // The time entered is Singapore time (SGT = UTC+8)
      // So we subtract 8 hours to get UTC
      const utcHours = hours - 8;
      if (utcHours < 0) {
        baseDate.setUTCDate(baseDate.getUTCDate() - 1);
        baseDate.setUTCHours(utcHours + 24, minutes, 0, 0);
      } else {
        baseDate.setUTCHours(utcHours, minutes, 0, 0);
      }
      const iso = baseDate.toISOString();
      if (iso === undefined || iso === "Invalid Date") {
        throw new Error("Invalid date or time. Please check and try again.");
      }
      return iso;
    };

    try {
    let scheduledAt: string;
    // Single class with multiple time slots (CREATE mode only):
    // we create one class per slot in the loop below, so the base scheduledAt can be blank.
    // In EDIT mode we must send a real datetime for the single class record.
    if (!isEditMode && classType === "single" && timeSlots.length > 0 && !isIndividualInstance) {
      scheduledAt = ""; // not used; we compute per-slot in the loop below
    } else if (classType === "single" || isIndividualInstance) {
      scheduledAt = convertSGTimeToUTC(formData.date, formData.startTime);
    } else if (classType === "recurring") {
      scheduledAt = convertSGTimeToUTC(formData.startDate, formData.startTime);
    } else {
      scheduledAt = convertSGTimeToUTC(formData.courseStartDate, formData.startTime);
    }

    // Build recurrence pattern for recurring/course
    // For individual instances, don't include recurrence pattern (it stays as part of the series)
    let recurrencePattern: CreateClassData['recurrencePattern'] = undefined;
    if (!isIndividualInstance) {
    if (classType === "recurring") {
      recurrencePattern = {
        days: selectedDays,
        endDate: formData.endDate || undefined,
        endType: formData.endDate ? 'date' : 'never',
      };
    } else if (classType === "course") {
      recurrencePattern = {
        days: selectedDays,
        endDate: calculateEndDate(),
        endType: 'date',
        occurrences: calculateTotalSessions(),
      };
      }
    }

    // Get category slug - use it directly, map to closest enum value if needed
    const selectedCategory = allCategories.find(c => c.id === formData.category);
    const categorySlug = selectedCategory?.slug || '';
    
    // Map category slug to valid ClassType enum value
    // Try to match slug directly first, then fallback to intelligent mapping
    const validClassTypes: Array<'zumba' | 'yoga' | 'pilates' | 'hiit' | 'spinning' | 'boxing' | 'dance' | 'strength' | 'cardio'> = 
      ['zumba', 'yoga', 'pilates', 'hiit', 'spinning', 'boxing', 'dance', 'strength', 'cardio'];
    
    // Check if slug is already a valid enum value
    let classTypeValue: 'zumba' | 'yoga' | 'pilates' | 'hiit' | 'spinning' | 'boxing' | 'dance' | 'strength' | 'cardio' = 'dance';
    
    if (categorySlug && validClassTypes.includes(categorySlug as any)) {
      classTypeValue = categorySlug as any;
    } else if (categorySlug) {
      // Try to infer from slug using intelligent matching
      const slugLower = categorySlug.toLowerCase();
      if (slugLower.includes('zumba')) classTypeValue = 'zumba';
      else if (slugLower.includes('yoga')) classTypeValue = 'yoga';
      else if (slugLower.includes('pilates')) classTypeValue = 'pilates';
      else if (slugLower.includes('hiit') || slugLower.includes('strong')) classTypeValue = 'hiit';
      else if (slugLower.includes('spin')) classTypeValue = 'spinning';
      else if (slugLower.includes('box')) classTypeValue = 'boxing';
      else if (slugLower.includes('dance')) classTypeValue = 'dance';
      else if (slugLower.includes('strength') || slugLower.includes('toning')) classTypeValue = 'strength';
      else if (slugLower.includes('cardio')) classTypeValue = 'cardio';
      // Default to 'dance' if no match found
    }

    // For individual instances, keep the original recurrenceType and recurrencePattern
    // so it remains part of the series (isIndividualInstance already defined above)
    
    // Handle multiple instructors - use first one as primary, store all in instructorIds
    // Ensure instructor is always an array
    const instructorArray = Array.isArray(formData.instructor) 
      ? formData.instructor 
      : (formData.instructor ? [formData.instructor] : []);
    
    const primaryInstructorId = instructorArray.length > 0 && instructorArray[0] ? instructorArray[0] : undefined;
    const allInstructorIds = instructorArray.length > 0 ? instructorArray : undefined;

    const baseClassData: Omit<CreateClassData, 'scheduledAt' | 'durationMinutes'> = {
      title: formData.name,
      description: formData.description || undefined,
      classType: classTypeValue,
      level: formData.level,
      ageGroup: (formData.ageGroup ?? 'all') as 'adult' | 'kid' | 'all',
      ...(primaryInstructorId && primaryInstructorId.trim() !== '' ? { instructorId: primaryInstructorId } : {}),
      ...(allInstructorIds && allInstructorIds.length > 0 && allInstructorIds.every(id => id && id.trim() !== '') 
        ? { instructorIds: allInstructorIds } 
        : {}),
      capacity: parseInt(formData.capacity),
      tokenCost: parseInt(formData.tokenCost),
      roomId: formData.room || undefined,
      categoryId: formData.category || undefined,
      recurrenceType: isIndividualInstance 
        ? (existingClass?.recurrenceType as 'single' | 'recurring' | 'course' | undefined)
        : (classType as 'single' | 'recurring' | 'course'),
      recurrencePattern: isIndividualInstance 
        ? (existingClass?.recurrencePattern && typeof existingClass.recurrencePattern === 'object' && 'days' in existingClass.recurrencePattern ? existingClass.recurrencePattern : undefined)
        : recurrencePattern,
      allowDropIn: formData.allowDropIn || false,
      dropInTokenCost: formData.allowDropIn && formData.dropInTokenCost
        ? parseInt(formData.dropInTokenCost)
        : undefined,
      isOutdoor: formData.isOutdoor || false,
    };

      if (isEditMode && classId) {
        const classData: CreateClassData = {
          ...baseClassData,
          scheduledAt,
          durationMinutes: parseInt(formData.duration),
        };
        await updateClass.mutateAsync({ id: classId, data: classData });
        router.push("/classes");
        return;
      }

      // Create mode: single class with multiple time slots = create one class per slot
      if (classType === "single" && timeSlots.length > 0) {
        const validSlots = timeSlots.filter(s => s.startTime && s.duration && parseInt(s.duration) >= 1);
        if (validSlots.length === 0) {
          console.error("No valid time slots");
          return;
        }
        for (let i = 0; i < validSlots.length; i++) {
          const slot = validSlots[i];
          const slotScheduledAt = convertSGTimeToUTC(formData.date, slot.startTime);
          const classData: CreateClassData = {
            ...baseClassData,
            scheduledAt: slotScheduledAt,
            durationMinutes: parseInt(slot.duration) || 60,
          };
          await createClass.mutateAsync(classData);
        }
        router.push("/classes");
        return;
      }

      // Create mode: one class (recurring, course, or single with legacy single slot)
      const classData: CreateClassData = {
        ...baseClassData,
        scheduledAt,
        durationMinutes: parseInt(formData.duration),
      };
      await createClass.mutateAsync(classData);
      router.push("/classes");
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} class:`, error);
      toast.showToast(error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} class. Please try again.`, "error");
    }
  };

  const handleChange = (field: string) => (value: string | string[]) => {
    // For instructor field, always convert to array to support multiple instructors
    if (field === 'instructor') {
      const instructorValue = Array.isArray(value) ? value : (value ? [value] : []);
      setFormData((prev) => ({ ...prev, [field]: instructorValue }));
    } else {
    setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Multiple time slots (single-class create only)
  const addTimeSlot = () => {
    setTimeSlots(prev => [...prev, { startTime: "09:00", duration: "60" }]);
  };
  const removeTimeSlot = (index: number) => {
    setTimeSlots(prev => prev.filter((_, i) => i !== index));
  };
  const updateTimeSlot = (index: number, field: "startTime" | "duration", value: string) => {
    setTimeSlots(prev => prev.map((slot, i) => i === index ? { ...slot, [field]: value } : slot));
  };

  const calculateEndDate = () => {
    if (formData.courseStartDate && formData.courseWeeks) {
      const start = new Date(formData.courseStartDate);
      const weeks = parseInt(formData.courseWeeks);
      const end = new Date(start);
      end.setDate(end.getDate() + (weeks * 7) - 1);
      return end.toISOString().split('T')[0];
    }
    return "";
  };

  const calculateTotalSessions = () => {
    if (classType === "course" && formData.courseWeeks && selectedDays.length > 0) {
      return parseInt(formData.courseWeeks) * selectedDays.length;
    }
    return 0;
  };

  // Get selected items for preview
  const selectedCategory = categories.find(c => c.id === formData.category);
  const selectedInstructors = Array.isArray(instructors) ? instructors.filter(i => formData.instructor.includes(i.id)) : [];
  const selectedRoom = rooms.find(r => r.id === formData.room);
  const isLoading = loadingInstructors || loadingRooms || loadingCategories || (isEditMode && loadingClass);

  // Loading State with Skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeading title={isEditMode ? "Edit Class" : "Add New Class"} />
        <div className="space-y-6">
          {/* Class Type Skeleton */}
          <div className="animate-pulse rounded-[28px] border border-neutral-200/80 bg-white p-6 dark:border-white/10 dark:bg-gray-800">
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                    <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Basic Info Skeleton */}
          <FormSectionSkeleton />

          {/* Schedule Skeleton */}
          <FormSectionSkeleton />

          {/* Capacity Skeleton */}
          <div className="animate-pulse rounded-[28px] border border-neutral-200/80 bg-white p-6 dark:border-white/10 dark:bg-gray-800">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
            <div className="grid gap-6 sm:grid-cols-3">
              <FormFieldSkeleton />
              <FormFieldSkeleton />
              <FormFieldSkeleton />
            </div>
          </div>

          {/* Submit Button Skeleton */}
          <div className="flex justify-end gap-3 animate-pulse">
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading title={isEditMode ? "Edit Class" : "Add New Class"} />

      <div className="space-y-6">
        {/* Class Type Selection */}
        <StudioSection title="Class Type">
          {isEditMode && existingClass && /-\s*\d{1,2}\/\d{1,2}\/\d{4}$/.test(existingClass.title || "") && (
            <div className="mb-4 rounded-2xl bg-neutral-950 px-4 py-3 text-sm text-white/80">
              <p>Class type is locked for individual instances. This session is part of a {existingClass.recurrenceType || 'recurring'} series.</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {classTypes.map((type) => {
              const isIndividualInstance = isEditMode && existingClass && /-\s*\d{1,2}\/\d{1,2}\/\d{4}$/.test(existingClass.title || "");
              const isDisabled = isIndividualInstance && type.value !== "single";
              
              return (
              <button
                key={type.value}
                type="button"
                onClick={() => !isDisabled && setClassType(type.value)}
                disabled={isDisabled}
                className={`rounded-[22px] border p-4 text-left transition-all ${
                  isDisabled
                    ? "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-50 dark:border-white/10 dark:bg-white/5"
                    : classType === type.value
                    ? "border-[#d5e45c] bg-[#E4F56C] text-neutral-950"
                    : "border-neutral-200/80 bg-white hover:border-neutral-300 dark:border-white/10 dark:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    classType === type.value
                      ? "bg-neutral-950 text-[#E4F56C]"
                      : "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/60"
                  }`}>
                    {type.value === "single" && (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    {type.value === "recurring" && (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    {type.value === "course" && (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`font-semibold ${
                      classType === type.value
                        ? "text-neutral-950"
                        : "text-neutral-950 dark:text-white"
                    }`}>
                      {type.label.split(" - ")[0]}
                    </p>
                    <p className={`text-sm ${classType === type.value ? "text-neutral-950/60" : "text-neutral-500 dark:text-white/50"}`}>
                      {type.label.split(" - ")[1]}
                    </p>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        </StudioSection>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Details */}
          <StudioSection title="Class Details">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-950" />
                <span className="ml-3 text-gray-500">Loading options...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Class Name</Label>
                  <Input
 className={fieldClass}
                    id="name"
                    type="text"
                    placeholder="e.g., Morning Energy Zumba"
                    value={formData.name}
                    onChange={(e) => handleChange("name")(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="category">Category</Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCategoryPanel(true)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#E4F56C] px-3 py-1 text-xs font-semibold text-neutral-950"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Category
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/categories")}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Manage Categories
                      </button>
                    </div>
                  </div>
                  <Select
 className={fieldClass}
                    options={categoryOptions}
                    placeholder={loadingCategories ? "Loading..." : categories.length === 0 ? "No categories - Click 'Add Category' to create one" : "Select category"}
                    onChange={handleChange("category")}
                    value={formData.category}
                  />
                </div>

                <div>
                  <Label htmlFor="instructor">Instructor</Label>
                  <Select
 className={fieldClass}
                    options={instructorOptions}
                    placeholder={loadingInstructors ? "Loading..." : "Select instructor"}
                    onChange={handleChange("instructor")}
                    value={Array.isArray(formData.instructor) ? formData.instructor[0] || "" : formData.instructor || ""}
                  />
                </div>

                <div>
                  <Label htmlFor="room">Room/Studio</Label>
                  <Select
 className={fieldClass}
                    options={roomOptions}
                    placeholder={loadingRooms ? "Loading..." : "Select room"}
                    onChange={handleChange("room")}
                    value={formData.room}
                  />
                </div>

                <div>
                  <Label htmlFor="level">Level</Label>
                  <Select
 className={fieldClass}
                    options={levels}
                    placeholder="Select level"
                    onChange={handleChange("level")}
                    value={formData.level}
                  />
                </div>

                <div>
                  <Label htmlFor="ageGroup">Target Audience</Label>
                  <Select
 className={fieldClass}
                    options={[
                      { value: "all", label: "All (Adults & Kids)" },
                      { value: "adult", label: "Adults Only (13+)" },
                      { value: "kid", label: "Kids Only (<13)" },
                    ]}
                    placeholder="Select target audience"
                    onChange={handleChange("ageGroup")}
                    value={formData.ageGroup}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Determines who can book this class based on their age
                  </p>
                </div>

                {/* Indoor / Outdoor toggle */}
                <div className="md:col-span-2">
                  <Label>Location Type</Label>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="flex rounded-full bg-neutral-100 p-1 dark:bg-white/10">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isOutdoor: false }))}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          !formData.isOutdoor
                            ? "bg-neutral-950 text-white"
                            : "text-neutral-600 hover:text-neutral-950 dark:text-white/60"
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Indoor / Studio
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isOutdoor: true }))}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          formData.isOutdoor
                            ? "bg-[#E4F56C] text-neutral-950"
                            : "text-neutral-600 hover:text-neutral-950 dark:text-white/60"
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                        Outdoors
                      </button>
                    </div>
                    {formData.isOutdoor && (
                      <span className="rounded-full bg-[#E4F56C] px-3 py-1 text-xs font-medium text-neutral-950">
                        &ldquo;(outdoors)&rdquo; will be shown after the class name on the website
                      </span>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    className="h-28 w-full rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-hidden focus:ring-3 focus:ring-neutral-950/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    placeholder="Brief description of the class..."
                    value={formData.description}
                    onChange={(e) => handleChange("description")(e.target.value)}
                  />
                </div>
              </div>
            )}
          </StudioSection>

          {/* Schedule - Varies by class type */}
          <StudioSection title="Schedule">
            {/* Show info banner for individual instances */}
            {isEditMode && existingClass && /-\s*\d{1,2}\/\d{1,2}\/\d{4}$/.test(existingClass.title || "") && (
              <div className="mb-6 rounded-[22px] bg-neutral-950 p-4 text-white">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#E4F56C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Editing Individual Instance
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      You're editing a single session from a recurring series. Changes to date, time, instructor, capacity, or token cost will only affect this specific session, not the entire series.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {classType === "single" && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <StudioDate id="date" block ariaLabel="Date" value={formData.date} onChange={handleChange("date")} />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Same date for all time slots below
                  </p>
                </div>

                {isEditMode ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="startTime">
                        Start Time <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(SGT)</span>
                      </Label>
                      <Input
 className={fieldClass}
                        id="startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => handleChange("startTime")(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input
 className={fieldClass}
                        id="duration"
                        type="number"
                        min="1"
                        value={formData.duration}
                        onChange={(e) => handleChange("duration")(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <Label>Time slots</Label>
                        <button
                          type="button"
                          onClick={addTimeSlot}
                          className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                        >
                          + Add time slot
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Add multiple slots for the same day and instructor. One class will be created per slot.
                      </p>
                      <div className="space-y-3">
                        {timeSlots.map((slot, index) => (
                          <div
                            key={index}
                            className="flex flex-wrap items-end gap-3 rounded-[22px] border border-neutral-200/80 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5"
                          >
                            <div className="flex-1 min-w-[120px]">
                              <Label className="text-xs">Start time (SGT)</Label>
                              <Input
 className={fieldClass}
                                type="time"
                                value={slot.startTime}
                                onChange={(e) => updateTimeSlot(index, "startTime", e.target.value)}
                              />
                            </div>
                            <div className="w-28">
                              <Label className="text-xs">Duration (min)</Label>
                              <Input
 className={fieldClass}
                                type="number"
                                min="1"
                                max="240"
                                value={slot.duration}
                                onChange={(e) => updateTimeSlot(index, "duration", e.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeTimeSlot(index)}
                              disabled={timeSlots.length === 1}
                              title={timeSlots.length === 1 ? "Keep at least one slot" : "Remove slot"}
                              className="shrink-0 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-white"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {classType === "recurring" && (
              <div className="space-y-6">
                <div>
                  <Label>Repeat on Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          selectedDays.includes(day.key)
                            ? "bg-neutral-950 text-[#E4F56C]"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                  <div>
                    <Label htmlFor="startTime">
                      Start Time <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(SGT)</span>
                    </Label>
                    <Input
 className={fieldClass}
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleChange("startTime")(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Enter time in Singapore Standard Time (UTC+8)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
 className={fieldClass}
                      id="duration"
                      type="number"
                      min="15"
                      max="120"
                      step="15"
                      value={formData.duration}
                      onChange={(e) => handleChange("duration")(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <StudioDate id="startDate" block ariaLabel="Start date" value={formData.startDate} onChange={handleChange("startDate")} />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <StudioDate id="endDate" block clearable ariaLabel="End date" placeholder="No end date" value={formData.endDate} onChange={handleChange("endDate")} />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite</p>
                  </div>
                </div>

                {selectedDays.length > 0 && (
                  <div className="rounded-[22px] bg-[#E4F56C] p-4">
                    <p className="text-sm text-neutral-950">
                      <strong>Schedule:</strong> This class will repeat every{" "}
                      {selectedDays.map((d, i) => (
                        <span key={d}>
                          {daysOfWeek.find(day => day.key === d)?.label}
                          {i < selectedDays.length - 2 ? ", " : i === selectedDays.length - 2 ? " and " : ""}
                        </span>
                      ))}{" "}
                      at {formData.startTime || "TBD"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {classType === "course" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div>
                    <Label htmlFor="courseWeeks">Course Duration (Weeks)</Label>
                    <Select
 className={fieldClass}
                      options={[
                        { value: "4", label: "4 Weeks" },
                        { value: "6", label: "6 Weeks" },
                        { value: "8", label: "8 Weeks" },
                        { value: "10", label: "10 Weeks" },
                        { value: "12", label: "12 Weeks" },
                      ]}
                      defaultValue="8"
                      onChange={handleChange("courseWeeks")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="courseStartDate">Course Start Date</Label>
                    <StudioDate id="courseStartDate" block ariaLabel="Course start date" value={formData.courseStartDate} onChange={handleChange("courseStartDate")} />
                  </div>
                  <div>
                    <Label>Course End Date</Label>
                    <StudioDate block disabled ariaLabel="Course end date" placeholder="Auto-calculated" value={calculateEndDate()} onChange={() => {}} />
                    <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
                  </div>
                </div>

                <div>
                  <Label>Class Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          selectedDays.includes(day.key)
                            ? "bg-neutral-950 text-[#E4F56C]"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-white/70"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <Label htmlFor="startTime">
                      Class Time <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(SGT)</span>
                    </Label>
                    <Input
 className={fieldClass}
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleChange("startTime")(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
 className={fieldClass}
                      id="duration"
                      type="number"
                      min="15"
                      max="120"
                      step="15"
                      value={formData.duration}
                      onChange={(e) => handleChange("duration")(e.target.value)}
                    />
                  </div>
                </div>

                {calculateTotalSessions() > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-[22px] bg-neutral-950 p-4 text-white">
                    <p className="text-sm text-white/80">
                      <strong className="text-white">Course summary:</strong> {formData.courseWeeks} weeks × {selectedDays.length} day(s)/week
                    </p>
                    <span className="text-lg font-semibold text-[#E4F56C]">
                      {calculateTotalSessions()} sessions
                    </span>
                  </div>
                )}
              </div>
            )}
          </StudioSection>

          {/* Capacity & Pricing */}
          <StudioSection title="Capacity & Pricing">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <Label htmlFor="capacity">Class Capacity</Label>
                <Input
 className={fieldClass}
                  id="capacity"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.capacity}
                  onChange={(e) => handleChange("capacity")(e.target.value)}
                />
                {selectedRoom && selectedRoom.capacity && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Default: {selectedRoom.capacity} (from {selectedRoom.name})
                    {parseInt(formData.capacity) !== selectedRoom.capacity && (
                      <span className="ml-1 rounded-full bg-[#E4F56C] px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-950">Custom</span>
                    )}
                  </p>
                )}
              </div>

              {classType !== "course" && (
                <div>
                  <Label htmlFor="tokenCost">Token Cost (per class)</Label>
                  <Input
 className={fieldClass}
                    id="tokenCost"
                    type="number"
                    min="1"
                    value={formData.tokenCost}
                    onChange={(e) => handleChange("tokenCost")(e.target.value)}
                  />
                </div>
              )}

              {classType === "course" && (
                  <div>
                  <Label htmlFor="tokenCost">Token Cost (per session)</Label>
                      <Input
 className={fieldClass}
                    id="tokenCost"
                        type="number"
                    min="1"
                    value={formData.tokenCost}
                    onChange={(e) => handleChange("tokenCost")(e.target.value)}
                      />
                  {calculateTotalSessions() > 0 && formData.tokenCost && (
                      <p className="text-xs text-gray-500 mt-1">
                      {parseInt(formData.tokenCost) * calculateTotalSessions()} tokens total for {calculateTotalSessions()} sessions
                      </p>
                    )}
                  </div>
              )}
            </div>

            {/* Walk-in/Drop-in option for all class types */}
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, allowDropIn: !prev.allowDropIn }))}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    formData.allowDropIn ? "bg-[#E4F56C]" : "bg-neutral-200 dark:bg-white/15"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-neutral-950 transition-transform ${
                    formData.allowDropIn ? "translate-x-5" : ""
                  }`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Allow Walk-in</p>
                  <p className="text-xs text-gray-500">
                    {classType === "course" 
                      ? "Let non-enrolled students join individual sessions with tokens"
                      : "Allow users to check in via QR code without pre-booking"}
                  </p>
                </div>
              </div>
              {formData.allowDropIn && (
                <div className="mt-4">
                  <Label htmlFor="dropInTokenCost">
                    Walk-in Token Cost {classType === "course" ? "(per session)" : ""}
                  </Label>
                  <Input
 className={fieldClass}
                    id="dropInTokenCost"
                    type="number"
                    min="1"
                    value={formData.dropInTokenCost}
                    onChange={(e) => handleChange("dropInTokenCost")(e.target.value)}
                    placeholder={`Same as regular token cost (${formData.tokenCost})`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {classType === "course" 
                      ? "Tokens required for students not enrolled in the full course. Leave empty to use regular token cost."
                      : "Tokens required for walk-in attendance. Leave empty to use regular token cost."}
                  </p>
                </div>
              )}
            </div>
          </StudioSection>

          {/* Summary Preview */}
          {formData.name && (
            <StudioSection title="Preview">
              <div className="flex items-start gap-4 rounded-[22px] bg-neutral-950 p-4 text-white">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E4F56C] text-xs font-semibold uppercase text-neutral-950">
                  {classType === "single" ? "1" : classType === "recurring" ? "W" : "C"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold uppercase tracking-tight">
                      {formData.name}{formData.isOutdoor ? " (outdoors)" : ""}
                    </h4>
                    <span className="rounded-full bg-[#E4F56C] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-950">
                      {classType === "single" ? "Single" : classType === "recurring" ? "Recurring" : "Course"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/55">
                    {selectedCategory?.name}
                    {selectedInstructors.length > 0 && ` · ${selectedInstructors.map(i => i.name).join(", ")}`}
                    {selectedRoom && ` · ${selectedRoom.name}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    {formData.startTime && (
                      <span className="rounded-full bg-white/10 px-3 py-1">{formData.startTime}</span>
                    )}
                    {formData.duration && (
                      <span className="rounded-full bg-white/10 px-3 py-1">{formData.duration} min</span>
                    )}
                    {formData.capacity && (
                      <span className="rounded-full bg-white/10 px-3 py-1">{formData.capacity} spots</span>
                    )}
                    {formData.tokenCost && (
                      <span className="rounded-full bg-[#E4F56C] px-3 py-1 text-neutral-950">
                        {formData.tokenCost} token{classType === "course" && calculateTotalSessions() > 0 ? ` × ${calculateTotalSessions()} = ${parseInt(formData.tokenCost) * calculateTotalSessions()}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </StudioSection>
          )}

          {/* Error message */}
          {(createClass.isError || updateClass.isError) && (
            <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>Error:</strong> {(createClass.error || updateClass.error)?.message || `Failed to ${isEditMode ? 'update' : 'create'} class`}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/classes")}
              className="rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/10 dark:bg-transparent dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                (createClass.isPending || updateClass.isPending) ||
                !formData.name ||
                (classType === "single" && !isEditMode
                  ? !formData.date || timeSlots.length === 0 || !timeSlots.some(s => s.startTime && s.duration)
                  : !formData.startTime)
              }
              className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {(createClass.isPending || updateClass.isPending)
                ? (isEditMode ? "Updating..." : timeSlots.length > 1 ? "Creating classes..." : "Creating...")
                : (isEditMode
                  ? `Update ${classType === "course" ? "Course" : "Class"}`
                  : classType === "single" && timeSlots.length > 1
                    ? `Create ${timeSlots.length} classes`
                    : `Create ${classType === "course" ? "Course" : "Class"}`
                )
              }
            </button>
          </div>
        </form>

        {/* Category Create Panel */}
        <CategoryCreatePanel
          isOpen={showCategoryPanel}
          onClose={() => setShowCategoryPanel(false)}
          onCategoryCreated={async (categoryId) => {
            // Refetch categories
            await refetchCategories();
            // Auto-select the newly created category
            setFormData((prev) => ({ ...prev, category: categoryId }));
          }}
        />
      </div>
    </div>
  );
}

export default function NewClassPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <PageHeading title="Add New Class" />
        <div className="space-y-6">
          <FormSectionSkeleton />
          <FormSectionSkeleton />
          <FormSectionSkeleton />
        </div>
      </div>
    }>
      <NewClassPageContent />
    </Suspense>
  );
}
