"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import { 
  useInstructors, 
  useRooms, 
  useClassCategories, 
  useCreateClass,
  CreateClassData,
} from "@/hooks/useClasses";
import { useClassCategories as useCategoriesHook } from "@/hooks/useClassCategories";
import CategoryCreatePanel from "@/components/categories/CategoryCreatePanel";

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

// Skeleton Components
const FormFieldSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
    <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
  </div>
);

const FormSectionSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
    <div className="grid gap-6 sm:grid-cols-2">
      <FormFieldSkeleton />
      <FormFieldSkeleton />
      <FormFieldSkeleton />
      <FormFieldSkeleton />
    </div>
  </div>
);

export default function NewClassPage() {
  const router = useRouter();
  
  // Fetch data from API
  const { data: instructors = [], isLoading: loadingInstructors } = useInstructors();
  const { data: rooms = [], isLoading: loadingRooms } = useRooms();
  const { data: categories = [], isLoading: loadingCategories, refetch: refetchCategories } = useCategoriesHook();
  
  // Also get categories from useClassCategories for backward compatibility
  const { data: categoriesLegacy = [] } = useClassCategories();
  const allCategories = categories.length > 0 ? categories : categoriesLegacy;
  
  // Create class mutation
  const createClass = useCreateClass();
  
  const [classType, setClassType] = useState("single");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    instructor: "",
    room: "",
    level: "all_levels",
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
    // Course specific
    courseTotalPrice: "",
    allowDropIn: false,
  });

  // Format instructors for Select component
  const instructorOptions = useMemo(() => 
    instructors.map((i) => ({ value: i.id, label: i.name })),
    [instructors]
  );

  // Format rooms for Select component
  const roomOptions = useMemo(() => 
    rooms.map((r) => ({ value: r.id, label: `${r.name}${r.location ? ` (${r.location})` : ''}` })),
    [rooms]
  );

  // Format categories for Select component
  const categoryOptions = useMemo(() => 
    allCategories.map((c) => ({ value: c.id, label: c.name })),
    [allCategories]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build scheduled datetime
    let scheduledAt: string;
    if (classType === "single") {
      scheduledAt = new Date(`${formData.date}T${formData.startTime}`).toISOString();
    } else if (classType === "recurring") {
      scheduledAt = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
    } else {
      scheduledAt = new Date(`${formData.courseStartDate}T${formData.startTime}`).toISOString();
    }

    // Build recurrence pattern for recurring/course
    let recurrencePattern: CreateClassData['recurrencePattern'] = undefined;
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

    const classData: CreateClassData = {
      title: formData.name,
      description: formData.description || undefined,
      classType: classTypeValue,
      level: formData.level,
      instructorId: formData.instructor || undefined,
      scheduledAt,
      durationMinutes: parseInt(formData.duration),
      capacity: parseInt(formData.capacity),
      tokenCost: parseInt(formData.tokenCost),
      roomId: formData.room || undefined,
      categoryId: formData.category || undefined,
      recurrenceType: classType as 'single' | 'recurring' | 'course',
      recurrencePattern: recurrencePattern,
    };

    try {
      await createClass.mutateAsync(classData);
      router.push("/classes");
    } catch (error) {
      console.error("Failed to create class:", error);
    }
  };

  const handleChange = (field: string) => (value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
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
  const selectedInstructor = instructors.find(i => i.id === formData.instructor);
  const selectedRoom = rooms.find(r => r.id === formData.room);
  const isLoading = loadingInstructors || loadingRooms || loadingCategories;

  // Loading State with Skeleton
  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Add New Class" />
        <div className="space-y-6">
          {/* Class Type Skeleton */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
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
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
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
    <div>
      <PageBreadCrumb pageTitle="Add New Class" />

      <div className="space-y-6">
        {/* Class Type Selection */}
        <ComponentCard title="Class Type">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {classTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setClassType(type.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  classType === type.value
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    classType === type.value
                      ? "bg-amber-500 text-white"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700"
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
                    <p className={`font-medium ${
                      classType === type.value
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-gray-900 dark:text-white"
                    }`}>
                      {type.label.split(" - ")[0]}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {type.label.split(" - ")[1]}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ComponentCard>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Details */}
          <ComponentCard title="Class Details">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
                <span className="ml-3 text-gray-500">Loading options...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Class Name</Label>
                  <Input
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
                        className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 font-medium flex items-center gap-1"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Category
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/categories")}
                        className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 font-medium flex items-center gap-1"
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
                    options={categoryOptions}
                    placeholder={loadingCategories ? "Loading..." : categories.length === 0 ? "No categories - Click 'Add Category' to create one" : "Select category"}
                    onChange={handleChange("category")}
                    defaultValue={formData.category}
                  />
                </div>

                <div>
                  <Label htmlFor="instructor">Instructor</Label>
                  <Select
                    options={instructorOptions}
                    placeholder={loadingInstructors ? "Loading..." : "Select instructor"}
                    onChange={handleChange("instructor")}
                    defaultValue={formData.instructor}
                  />
                </div>

                <div>
                  <Label htmlFor="room">Room/Studio</Label>
                  <Select
                    options={roomOptions}
                    placeholder={loadingRooms ? "Loading..." : "Select room"}
                    onChange={handleChange("room")}
                    defaultValue={formData.room}
                  />
                </div>

                <div>
                  <Label htmlFor="level">Level</Label>
                  <Select
                    options={levels}
                    placeholder="Select level"
                    onChange={handleChange("level")}
                    defaultValue={formData.level}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    className="dark:bg-dark-900 h-24 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    placeholder="Brief description of the class..."
                    value={formData.description}
                    onChange={(e) => handleChange("description")(e.target.value)}
                  />
                </div>
              </div>
            )}
          </ComponentCard>

          {/* Schedule - Varies by class type */}
          <ComponentCard title="Schedule">
            {classType === "single" && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange("date")(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleChange("startTime")(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
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
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedDays.includes(day.key)
                            ? "bg-amber-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleChange("startTime")(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
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
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleChange("startDate")(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleChange("endDate")(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite</p>
                  </div>
                </div>

                {selectedDays.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
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
                    <Input
                      id="courseStartDate"
                      type="date"
                      value={formData.courseStartDate}
                      onChange={(e) => handleChange("courseStartDate")(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Course End Date</Label>
                    <Input
                      type="date"
                      value={calculateEndDate()}
                      disabled
                      className="bg-gray-50 dark:bg-gray-800"
                    />
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
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedDays.includes(day.key)
                            ? "bg-amber-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <Label htmlFor="startTime">Class Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleChange("startTime")(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
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
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Course Summary:</strong> {formData.courseWeeks} weeks × {selectedDays.length} day(s)/week
                      </p>
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                        {calculateTotalSessions()} total sessions
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ComponentCard>

          {/* Capacity & Pricing */}
          <ComponentCard title="Capacity & Pricing">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <Label htmlFor="capacity">Class Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.capacity}
                  onChange={(e) => handleChange("capacity")(e.target.value)}
                />
              </div>

              {classType !== "course" && (
                <div>
                  <Label htmlFor="tokenCost">Token Cost (per class)</Label>
                  <Input
                    id="tokenCost"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.tokenCost}
                    onChange={(e) => handleChange("tokenCost")(e.target.value)}
                  />
                </div>
              )}

              {classType === "course" && (
                <>
                  <div>
                    <Label htmlFor="courseTotalPrice">Course Price (Total)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="courseTotalPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        className="pl-7"
                        placeholder="e.g., 120.00"
                        value={formData.courseTotalPrice}
                        onChange={(e) => handleChange("courseTotalPrice")(e.target.value)}
                      />
                    </div>
                    {calculateTotalSessions() > 0 && formData.courseTotalPrice && (
                      <p className="text-xs text-gray-500 mt-1">
                        ${(parseFloat(formData.courseTotalPrice) / calculateTotalSessions()).toFixed(2)} per session
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, allowDropIn: !prev.allowDropIn }))}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        formData.allowDropIn ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        formData.allowDropIn ? "translate-x-5" : ""
                      }`} />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Allow Drop-in</p>
                      <p className="text-xs text-gray-500">Let non-enrolled students join with tokens</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {classType === "course" && formData.allowDropIn && (
              <div className="mt-4">
                <Label htmlFor="tokenCost">Drop-in Token Cost</Label>
                <Input
                  id="tokenCost"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.tokenCost}
                  onChange={(e) => handleChange("tokenCost")(e.target.value)}
                />
              </div>
            )}
          </ComponentCard>

          {/* Summary Preview */}
          {formData.name && (
            <ComponentCard title="Preview">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-xl ${
                  classType === "course" 
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : classType === "recurring"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                }`}>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{formData.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      classType === "course"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : classType === "recurring"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    }`}>
                      {classType === "single" ? "Single" : classType === "recurring" ? "Recurring" : "Course"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {selectedCategory?.name}
                    {selectedInstructor && ` • ${selectedInstructor.name}`}
                    {selectedRoom && ` • ${selectedRoom.name}`}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    {formData.startTime && (
                      <span className="text-gray-600 dark:text-gray-300">🕐 {formData.startTime}</span>
                    )}
                    {formData.duration && (
                      <span className="text-gray-600 dark:text-gray-300">⏱️ {formData.duration} min</span>
                    )}
                    {formData.capacity && (
                      <span className="text-gray-600 dark:text-gray-300">👥 {formData.capacity} spots</span>
                    )}
                    {classType !== "course" && formData.tokenCost && (
                      <span className="text-gray-600 dark:text-gray-300">🎟️ {formData.tokenCost} token(s)</span>
                    )}
                    {classType === "course" && formData.courseTotalPrice && (
                      <span className="text-gray-600 dark:text-gray-300">💰 ${formData.courseTotalPrice}</span>
                    )}
                  </div>
                </div>
              </div>
            </ComponentCard>
          )}

          {/* Error message */}
          {createClass.isError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>Error:</strong> {createClass.error?.message || 'Failed to create class'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/classes")}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createClass.isPending || !formData.name || !formData.startTime}
            >
              {createClass.isPending ? "Creating..." : `Create ${classType === "course" ? "Course" : "Class"}`}
            </Button>
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
