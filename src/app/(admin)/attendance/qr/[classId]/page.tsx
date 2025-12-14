"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRAttendanceModal from "@/components/attendance/QRAttendanceModal";
import { getSupabaseClient } from "@/lib/supabase";

interface Attendee {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  checkedInAt: string;
}

interface ClassData {
  id: string;
  name: string;
  instructor: string;
  time: string;
  scheduledAt: string;
  enrolled: number;
  capacity: number;
  type?: string;
  room?: string;
  date?: string;
  duration?: number;
}

export default function AttendanceQRPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params?.classId as string;
  const [realAttendees, setRealAttendees] = useState<Attendee[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real class data and attendees
  useEffect(() => {
    let isMounted = true;

    const fetchClassData = async () => {
      if (!classId) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/attendance/class/${classId}/attendees`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to fetch class data");
        }

        if (isMounted) {
          console.log('[AttendanceQR] Class data received:', {
            enrolled: result.data.class.enrolled,
            expected: result.data.expected,
            checkedIn: result.data.checkedIn,
            attendees: result.data.attendees.length
          });
          setClassData(result.data.class);
          setRealAttendees(result.data.attendees || []);
          setError(null);
        }
      } catch (err) {
        console.error("[AttendanceQR] Error fetching class data:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load class data");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchClassData();

    // Set up real-time subscription for new check-ins
    const supabase = getSupabaseClient();
    
    // Subscribe to attendances table - listen for new check-ins
    const attendancesChannel = supabase
      .channel(`attendance:${classId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendances",
        },
        async (payload) => {
          console.log("[AttendanceQR] New check-in:", payload);
          // Verify this attendance is for a booking in this class
          const { data: booking } = await supabase
            .from('bookings')
            .select('class_id')
            .eq('id', payload.new.booking_id)
            .single();
          
          if (booking?.class_id === classId) {
            fetchClassData();
          }
        }
      )
      .subscribe();

    // Subscribe to bookings table for status changes (less aggressive - only on status change to attended)
    const bookingsChannel = supabase
      .channel(`bookings:${classId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          // Only refetch if status changed to 'attended'
          if (payload.new.status === 'attended' && payload.old.status !== 'attended') {
            console.log("[AttendanceQR] Booking marked as attended:", payload);
            fetchClassData();
          }
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds to catch any missed updates (less aggressive)
    const refreshInterval = setInterval(() => {
      if (isMounted) {
        fetchClassData();
      }
    }, 30000);

    return () => {
      isMounted = false;
      supabase.removeChannel(attendancesChannel);
      supabase.removeChannel(bookingsChannel);
      clearInterval(refreshInterval);
    };
  }, [classId]);

  // Handle escape key to exit
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.back();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [router]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-300">Loading class data...</p>
        </div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Class not found"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Format class info for QRAttendanceModal
  const classInfo = {
    id: classData.id,
    name: classData.name,
    type: classData.type || "Zumba",
    time: classData.time,
    duration: classData.duration || 60,
    room: classData.room || "Main Studio",
    date: classData.date || new Date(classData.scheduledAt).toLocaleDateString(),
    enrolled: classData.enrolled,
    capacity: classData.capacity,
  };

  // Format real attendees for the modal
  const formattedAttendees = realAttendees.map(attendee => ({
    id: attendee.id,
    name: attendee.name,
    checkedInAt: attendee.checkedInAt,
    avatar: attendee.avatar,
  }));

  return (
    <QRAttendanceModal
      isOpen={true}
      onClose={() => router.back()}
      classInfo={classInfo}
      realAttendees={formattedAttendees}
      realEnrolled={classData.enrolled}
      autoFullscreen={true}
    />
  );
}
