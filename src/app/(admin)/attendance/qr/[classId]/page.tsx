"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCodeDisplay from "@/components/attendance/QRCodeDisplay";

interface Attendee {
  id: string;
  name: string;
  avatar: string;
  checkedInAt: string;
}

// Demo class data - in production this would come from API
const demoClassData: Record<string, { name: string; instructor: string; time: string; enrolled: number; capacity: number }> = {
  "1": { name: "Morning Energy", instructor: "Maria Garcia", time: "07:00 AM", enrolled: 18, capacity: 25 },
  "2": { name: "Latin Rhythm", instructor: "Carlos Rodriguez", time: "06:00 PM", enrolled: 30, capacity: 30 },
  "3": { name: "Aqua Zumba", instructor: "Sofia Martinez", time: "10:00 AM", enrolled: 12, capacity: 15 },
  "4": { name: "Zumba Toning", instructor: "Ana Lopez", time: "05:00 PM", enrolled: 15, capacity: 20 },
  "5": { name: "Kids Zumba", instructor: "Maria Garcia", time: "04:00 PM", enrolled: 15, capacity: 20 },
  "6": { name: "Zumba Gold", instructor: "Roberto Sanchez", time: "09:00 AM", enrolled: 8, capacity: 15 },
};

// Demo attendees
const demoAttendees: Attendee[] = [
  { id: "1", name: "Sarah Johnson", avatar: "SJ", checkedInAt: "" },
  { id: "2", name: "Mike Chen", avatar: "MC", checkedInAt: "" },
  { id: "3", name: "Emily Rodriguez", avatar: "ER", checkedInAt: "" },
  { id: "4", name: "David Kim", avatar: "DK", checkedInAt: "" },
  { id: "5", name: "Lisa Wang", avatar: "LW", checkedInAt: "" },
  { id: "6", name: "James Brown", avatar: "JB", checkedInAt: "" },
  { id: "7", name: "Ana Martinez", avatar: "AM", checkedInAt: "" },
  { id: "8", name: "Tom Wilson", avatar: "TW", checkedInAt: "" },
  { id: "9", name: "Rachel Green", avatar: "RG", checkedInAt: "" },
  { id: "10", name: "Chris Evans", avatar: "CE", checkedInAt: "" },
];

export default function AttendanceQRPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params?.classId as string;
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [classData, setClassData] = useState(demoClassData[classId] || demoClassData["1"]);

  // Get current date/time
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Simulate people checking in for demo
  useEffect(() => {
    const addRandomAttendee = () => {
      setAttendees((prev) => {
        const notCheckedIn = demoAttendees.filter(
          (d) => !prev.some((p) => p.id === d.id)
        );
        if (notCheckedIn.length === 0) return prev;

        const randomAttendee = notCheckedIn[Math.floor(Math.random() * notCheckedIn.length)];
        const now = new Date();
        return [
          {
            ...randomAttendee,
            checkedInAt: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
          ...prev,
        ];
      });
    };

    // Add first attendee after 3 seconds, then randomly
    const firstTimer = setTimeout(addRandomAttendee, 3000);
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        addRandomAttendee();
      }
    }, 4000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, []);

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

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/80 px-8 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white shadow-lg shadow-brand-500/25">
            Z
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{classData.name}</h1>
            <p className="text-slate-400">
              {classData.instructor} • {classData.time}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Date/Time */}
          <div className="text-right">
            <p className="text-sm text-slate-400">{dateStr}</p>
            <p className="text-lg font-semibold text-white">{timeStr}</p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-emerald-500/10 px-6 py-3 border border-emerald-500/20">
              <p className="text-sm text-emerald-400">Checked In</p>
              <p className="text-3xl font-bold text-emerald-400">{attendees.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-700/50 px-6 py-3">
              <p className="text-sm text-slate-400">Expected</p>
              <p className="text-3xl font-bold text-white">{classData.enrolled}</p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => router.back()}
            className="rounded-xl bg-slate-700/50 p-3 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* QR Code Section */}
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <QRCodeDisplay
            classId={classId}
            className={classData.name}
            size={420}
            refreshInterval={30}
          />

          {/* Instructions */}
          <div className="mt-8 max-w-md text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-slate-300">Open Zumbathon app</span>
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-slate-300">Scan QR code</span>
            </div>
            <p className="text-sm text-slate-500">
              Code refreshes every 30 seconds for security
            </p>
          </div>
        </div>

        {/* Attendees Panel */}
        <div className="w-[400px] border-l border-slate-700/50 bg-slate-800/30 flex flex-col">
          <div className="border-b border-slate-700/50 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Live Check-ins</h2>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-400">
                {attendees.length} arrived
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min((attendees.length / classData.enrolled) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {Math.round((attendees.length / classData.enrolled) * 100)}% attendance
            </p>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {attendees.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-700/50">
                  <svg className="h-10 w-10 text-slate-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-slate-300">Waiting for students...</p>
                <p className="mt-1 text-sm text-slate-500">Check-ins will appear here in real-time</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attendees.map((attendee, index) => (
                  <div
                    key={attendee.id}
                    className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${
                      index === 0
                        ? "bg-gradient-to-r from-emerald-500/20 to-transparent ring-1 ring-emerald-500/30 animate-pulse"
                        : "bg-slate-700/30 hover:bg-slate-700/50"
                    }`}
                  >
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white shadow-lg">
                        {attendee.avatar}
                      </div>
                      {index === 0 && (
                        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{attendee.name}</p>
                      <p className="text-sm text-slate-400">{attendee.checkedInAt}</p>
                    </div>
                    {index === 0 && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        Just now
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-900/80 px-8 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Press <kbd className="mx-1 rounded-lg bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">ESC</kbd> or click ✕ to close
          </p>
          <p className="text-sm text-slate-500">
            Powered by <span className="font-semibold text-brand-400">Zumbathon</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
