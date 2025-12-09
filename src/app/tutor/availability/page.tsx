"use client";

import { useState, useEffect } from "react";
import { useTutorAvailability, updateTutorAvailability, requestTimeOff, cancelTimeOff, type WeeklyAvailability, type TimeOffRequest } from "@/hooks/useTutor";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type TimeSlot = {
  start: string;
  end: string;
};

type DayAvailability = {
  enabled: boolean;
  slots: TimeSlot[];
};

const daysOfWeek = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

const timeOptions = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"
];

export default function TutorAvailabilityPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useTutorAvailability();
  
  const [availability, setAvailability] = useState<WeeklyAvailability>({
    monday: { enabled: false, slots: [] },
    tuesday: { enabled: false, slots: [] },
    wednesday: { enabled: false, slots: [] },
    thursday: { enabled: false, slots: [] },
    friday: { enabled: false, slots: [] },
    saturday: { enabled: false, slots: [] },
    sunday: { enabled: false, slots: [] },
  });

  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [newTimeOff, setNewTimeOff] = useState({ startDate: "", endDate: "", reason: "" });
  const [hasChanges, setHasChanges] = useState(false);

  // Sync data from API
  useEffect(() => {
    if (data) {
      setAvailability(data.availability);
      setTimeOffRequests(data.timeOffRequests);
    }
  }, [data]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: updateTutorAvailability,
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['tutor', 'availability'] });
    },
  });

  const timeOffMutation = useMutation({
    mutationFn: requestTimeOff,
    onSuccess: (newRequest) => {
      setTimeOffRequests(prev => [...prev, newRequest]);
      setNewTimeOff({ startDate: "", endDate: "", reason: "" });
      setShowTimeOffModal(false);
      queryClient.invalidateQueries({ queryKey: ['tutor', 'availability'] });
    },
  });

  const cancelTimeOffMutation = useMutation({
    mutationFn: cancelTimeOff,
    onSuccess: (_, requestId) => {
      setTimeOffRequests(prev => prev.filter(r => r.id !== requestId));
      queryClient.invalidateQueries({ queryKey: ['tutor', 'availability'] });
    },
  });

  const toggleDay = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        slots: !prev[day].enabled ? [{ start: "09:00", end: "17:00" }] : prev[day].slots
      }
    }));
    setHasChanges(true);
  };

  const addSlot = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [...prev[day].slots, { start: "09:00", end: "17:00" }]
      }
    }));
    setHasChanges(true);
  };

  const removeSlot = (day: string, index: number) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.filter((_, i) => i !== index)
      }
    }));
    setHasChanges(true);
  };

  const updateSlot = (day: string, index: number, field: "start" | "end", value: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((slot, i) => 
          i === index ? { ...slot, [field]: value } : slot
        )
      }
    }));
    setHasChanges(true);
  };

  const handleSaveAvailability = () => {
    saveMutation.mutate(availability);
  };

  const handleSubmitTimeOff = () => {
    if (!newTimeOff.startDate || !newTimeOff.endDate || !newTimeOff.reason) return;
    timeOffMutation.mutate(newTimeOff);
  };

  const handleCancelTimeOff = (id: string) => {
    cancelTimeOffMutation.mutate(id);
  };

  const getTotalHours = () => {
    let total = 0;
    Object.values(availability).forEach(day => {
      if (day.enabled) {
        day.slots.forEach(slot => {
          const start = parseInt(slot.start.split(":")[0]) + parseInt(slot.start.split(":")[1]) / 60;
          const end = parseInt(slot.end.split(":")[0]) + parseInt(slot.end.split(":")[1]) / 60;
          total += end - start;
        });
      }
    });
    return total;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading availability...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Failed to load availability</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || { hoursPerWeek: 0, daysAvailable: 0, pendingRequests: 0, approvedTimeOff: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Availability</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Set your weekly schedule and request time off</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTimeOffModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Request Time Off
          </button>
          {hasChanges && (
            <button
              onClick={handleSaveAvailability}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalHours().toFixed(1)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Hours/Week</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {Object.values(availability).filter(d => d.enabled).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Days Available</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {timeOffRequests.filter(r => r.status === "pending").length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending Requests</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {timeOffRequests.filter(r => r.status === "approved").length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Approved Time Off</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly Availability */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Availability</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Set the times you&apos;re available to teach classes</p>
          </div>
          <div className="p-6 space-y-4">
            {daysOfWeek.map((day) => (
              <div key={day.key} className={`rounded-xl border p-4 transition-colors ${
                availability[day.key].enabled 
                  ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20" 
                  : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleDay(day.key)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        availability[day.key].enabled ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        availability[day.key].enabled ? "translate-x-5" : ""
                      }`} />
                    </button>
                    <span className={`font-medium ${
                      availability[day.key].enabled 
                        ? "text-gray-900 dark:text-white" 
                        : "text-gray-500 dark:text-gray-400"
                    }`}>
                      {day.label}
                    </span>
                  </div>
                  {availability[day.key].enabled && (
                    <button
                      onClick={() => addSlot(day.key)}
                      className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium"
                    >
                      + Add Time Slot
                    </button>
                  )}
                </div>

                {availability[day.key].enabled && (
                  <div className="space-y-2 ml-14">
                    {availability[day.key].slots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={slot.start}
                          onChange={(e) => updateSlot(day.key, idx, "start", e.target.value)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          {timeOptions.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                        <span className="text-gray-500">to</span>
                        <select
                          value={slot.end}
                          onChange={(e) => updateSlot(day.key, idx, "end", e.target.value)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          {timeOptions.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                        {availability[day.key].slots.length > 1 && (
                          <button
                            onClick={() => removeSlot(day.key, idx)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!availability[day.key].enabled && (
                  <p className="ml-14 text-sm text-gray-400 dark:text-gray-500">Not available</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Time Off Requests */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Time Off Requests</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your upcoming time off</p>
          </div>
          <div className="p-6">
            {timeOffRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No time off scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {timeOffRequests.map((request) => (
                  <div key={request.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{request.reason}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {request.startDate === request.endDate 
                            ? request.startDate 
                            : `${request.startDate} - ${request.endDate}`
                          }
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        request.status === "approved" 
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : request.status === "pending"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {request.status}
                      </span>
                    </div>
                    {request.status === "pending" && (
                      <button
                        onClick={() => handleCancelTimeOff(request.id)}
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visual Schedule Preview */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schedule Preview</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Visual overview of your weekly availability</p>
        </div>
        <div className="p-6 overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Time labels */}
            <div className="flex">
              <div className="w-20"></div>
              {["6AM", "8AM", "10AM", "12PM", "2PM", "4PM", "6PM", "8PM", "10PM"].map(time => (
                <div key={time} className="flex-1 text-xs text-gray-400 text-center">{time}</div>
              ))}
            </div>
            {/* Day rows */}
            {daysOfWeek.map((day) => (
              <div key={day.key} className="flex items-center mt-2">
                <div className="w-20 text-sm font-medium text-gray-600 dark:text-gray-400">{day.short}</div>
                <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded relative">
                  {availability[day.key].enabled && availability[day.key].slots.map((slot, idx) => {
                    const startHour = parseInt(slot.start.split(":")[0]) + parseInt(slot.start.split(":")[1]) / 60;
                    const endHour = parseInt(slot.end.split(":")[0]) + parseInt(slot.end.split(":")[1]) / 60;
                    const left = ((startHour - 6) / 16) * 100;
                    const width = ((endHour - startHour) / 16) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute top-1 bottom-1 bg-amber-500 rounded"
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${slot.start} - ${slot.end}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time Off Modal */}
      {showTimeOffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Request Time Off</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={newTimeOff.startDate}
                  onChange={(e) => setNewTimeOff(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={newTimeOff.endDate}
                  onChange={(e) => setNewTimeOff(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <input
                  type="text"
                  value={newTimeOff.reason}
                  onChange={(e) => setNewTimeOff(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g., Vacation, Medical appointment"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTimeOffModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTimeOff}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
