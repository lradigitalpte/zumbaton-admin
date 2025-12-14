"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Student {
  id: string;
  name: string;
  avatar?: string;
  checkedInAt?: string;
  status: "pending" | "checked-in" | "absent";
}

interface ClassInfo {
  id: string;
  name: string;
  type: string;
  time: string;
  duration: number;
  room: string;
  date: string;
  enrolled: number;
  capacity: number;
}

interface QRAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: ClassInfo;
  realAttendees?: Array<{ id: string; name: string; checkedInAt: string; avatar?: string }>;
  realEnrolled?: number;
  autoFullscreen?: boolean; // Auto-open in fullscreen mode
}

const QR_REFRESH_SECONDS = 300; // 5 minutes

// Format seconds as MM:SS
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
};

export default function QRAttendanceModal({ 
  isOpen, 
  onClose, 
  classInfo, 
  realAttendees = [],
  realEnrolled,
  autoFullscreen = false 
}: QRAttendanceModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(autoFullscreen);
  const [qrToken, setQrToken] = useState("");
  const [timeLeft, setTimeLeft] = useState(QR_REFRESH_SECONDS);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<"qr" | "list">("qr");
  const classIdRef = useRef(classInfo.id);
  const prevClassInfoEnrolledRef = useRef(classInfo.enrolled);

  // Use real attendees if provided, otherwise generate demo students
  // Use refs to track previous values and avoid infinite loops
  const prevAttendeesRef = useRef<string>("");
  const prevEnrolledRef = useRef<number>(-1);
  
  useEffect(() => {
    // Create a stable key from attendees to detect actual changes
    const attendeesKey = realAttendees?.map(a => `${a.id}-${a.checkedInAt}`).join(",") || "";
    const enrolled = realEnrolled ?? classInfo.enrolled;
    
    // Only update if data actually changed
    if (
      attendeesKey === prevAttendeesRef.current && 
      enrolled === prevEnrolledRef.current &&
      classInfo.enrolled === prevClassInfoEnrolledRef.current
    ) {
      return;
    }
    
    prevAttendeesRef.current = attendeesKey;
    prevEnrolledRef.current = enrolled;
    prevClassInfoEnrolledRef.current = classInfo.enrolled;
    
    if (realAttendees && realAttendees.length > 0) {
      // Convert real attendees to student format
      const realStudents: Student[] = realAttendees.map(attendee => ({
        id: attendee.id,
        name: attendee.name,
        avatar: attendee.avatar,
        checkedInAt: attendee.checkedInAt,
        status: "checked-in" as const,
      }));
      setStudents(realStudents);
    } else {
      // Generate demo students - only if no real data
      const demoStudents: Student[] = [
        { id: "1", name: "Maria Santos", status: "pending" },
        { id: "2", name: "Juan Rodriguez", status: "pending" },
        { id: "3", name: "Ana Garcia", status: "pending" },
        { id: "4", name: "Carlos Mendoza", status: "pending" },
        { id: "5", name: "Sofia Martinez", status: "pending" },
        { id: "6", name: "Diego Lopez", status: "pending" },
        { id: "7", name: "Isabella Cruz", status: "pending" },
        { id: "8", name: "Miguel Torres", status: "pending" },
        { id: "9", name: "Valentina Reyes", status: "pending" },
        { id: "10", name: "Andres Vargas", status: "pending" },
      ];
      setStudents(demoStudents.slice(0, Math.min(enrolled, 10)));
    }
  }, [classInfo.enrolled, realAttendees, realEnrolled]);

  // Track when token was generated to calculate stable expiresAt
  const tokenGeneratedAtRef = useRef<number>(Date.now());

  // Generate initial QR token when modal opens
  useEffect(() => {
    if (isOpen) {
      classIdRef.current = classInfo.id;
      const token = `${classInfo.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      tokenGeneratedAtRef.current = Date.now();
      setQrToken(token);
      setTimeLeft(QR_REFRESH_SECONDS);
    }
  }, [isOpen, classInfo.id]);

  // Countdown timer - separate from QR generation
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Generate new token inline to avoid dependency issues
          const newToken = `${classIdRef.current}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          tokenGeneratedAtRef.current = Date.now();
          setQrToken(newToken);
          return QR_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Simulate students checking in (demo only - skip if real attendees provided)
  useEffect(() => {
    if (!isOpen || (realAttendees && realAttendees.length > 0)) return;

    const simulateCheckIn = () => {
      setStudents((prev) => {
        const pendingStudents = prev.filter((s) => s.status === "pending");
        if (pendingStudents.length === 0) return prev;

        // Randomly check in a student
        if (Math.random() > 0.7) {
          const randomIndex = Math.floor(Math.random() * pendingStudents.length);
          const studentToCheckIn = pendingStudents[randomIndex];
          return prev.map((s) =>
            s.id === studentToCheckIn.id
              ? {
                  ...s,
                  status: "checked-in" as const,
                  checkedInAt: new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                }
              : s
          );
        }
        return prev;
      });
    };

    const interval = setInterval(simulateCheckIn, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Manual check-in
  const handleManualCheckIn = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              status: "checked-in" as const,
              checkedInAt: new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : s
      )
    );
  };

  // Mark absent
  const handleMarkAbsent = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, status: "absent" as const } : s
      )
    );
  };

  // Check in all
  const handleCheckInAll = () => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setStudents((prev) =>
      prev.map((s) =>
        s.status === "pending" ? { ...s, status: "checked-in" as const, checkedInAt: time } : s
      )
    );
  };

  const checkedInCount = students.filter((s) => s.status === "checked-in").length;
  const pendingCount = students.filter((s) => s.status === "pending").length;

  // Memoize QR data so it only changes when token changes, not on every render
  const qrData = useMemo(() => {
    if (!qrToken) return "";

    // Use the time when token was generated, not current time, so QR code stays stable
    const qrDataObject = {
      classId: classInfo.id,
      className: classInfo.name,
      sessionDate: classInfo.date, // Use sessionDate to match backend API format
      sessionTime: classInfo.time,
      token: qrToken,
      expiresAt: tokenGeneratedAtRef.current + (QR_REFRESH_SECONDS * 1000), // Token expires when QR refreshes
    };

    // Create URL for phone camera scanning (opens web app directly)
    // Get web app URL from environment or use default
    const webAppUrl = process.env.NEXT_PUBLIC_WEB_URL || 'https://zumbaton-web.vercel.app';
    const encodedData = btoa(JSON.stringify(qrDataObject));
    const checkInUrl = `${webAppUrl}/check-in/${encodedData}`;
    
    // QR code contains URL for phone camera scanning, but also works with in-app scanner
    return checkInUrl;
  }, [qrToken, classInfo.id, classInfo.name, classInfo.date, classInfo.time]);

  if (!isOpen) return null;

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[99999] bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <span className="text-white font-bold">{classInfo.type[0]}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{classInfo.name}</h2>
              <p className="text-sm text-gray-400">{classInfo.time} • {classInfo.room}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-400">{checkedInCount}/{realEnrolled || classInfo.enrolled || students.length}</p>
              <p className="text-xs text-gray-400">checked in</p>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="bg-white p-8 rounded-3xl shadow-2xl inline-block mb-6">
              <QRCodeSVG value={qrData} size={320} level="H" />
            </div>
            <p className="text-xl text-gray-300 mb-2">Scan to check in</p>
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Refreshes in {formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>

        {/* Live Attendance Strip */}
        <div className="bg-gray-800 p-4">
          <div className="flex items-center gap-4 overflow-x-auto">
            <span className="text-sm text-gray-400 whitespace-nowrap">Recent check-ins:</span>
            {students
              .filter((s) => s.status === "checked-in")
              .slice(-5)
              .map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full whitespace-nowrap"
                >
                  <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-medium text-white">
                    {student.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className="text-sm text-emerald-400">{student.name}</span>
                  <span className="text-xs text-gray-500">{student.checkedInAt}</span>
                </div>
              ))}
            {checkedInCount === 0 && (
              <span className="text-sm text-gray-500">Waiting for students...</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              classInfo.type === "Zumba" ? "bg-amber-100 dark:bg-amber-900/30" :
              classInfo.type === "HIIT" ? "bg-red-100 dark:bg-red-900/30" :
              "bg-purple-100 dark:bg-purple-900/30"
            }`}>
              <span className={`text-lg font-bold ${
                classInfo.type === "Zumba" ? "text-amber-600 dark:text-amber-400" :
                classInfo.type === "HIIT" ? "text-red-600 dark:text-red-400" :
                "text-purple-600 dark:text-purple-400"
              }`}>
                {classInfo.type[0]}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{classInfo.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{classInfo.time} • {classInfo.room}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Fullscreen"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{checkedInCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Checked In</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{students.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("qr")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "qr"
                ? "text-amber-600 border-b-2 border-amber-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            QR Code
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "list"
                ? "text-amber-600 border-b-2 border-amber-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Student List ({students.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[400px]">
          {activeTab === "qr" ? (
            <div className="flex flex-col items-center">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-600 mb-4">
                <QRCodeSVG value={qrData} size={200} level="H" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Students scan this code to check in
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Refreshes in {formatTime(timeLeft)}
              </div>
              <button
                onClick={() => setIsFullscreen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Open Fullscreen for TV/Projector
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Bulk Actions */}
              {pendingCount > 0 && (
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {pendingCount} students pending
                  </span>
                  <button
                    onClick={handleCheckInAll}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
                  >
                    Check In All
                  </button>
                </div>
              )}

              {/* Student List */}
              {students.map((student) => (
                <div
                  key={student.id}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                    student.status === "checked-in"
                      ? "bg-emerald-50 dark:bg-emerald-900/20"
                      : student.status === "absent"
                      ? "bg-red-50 dark:bg-red-900/20"
                      : "bg-gray-50 dark:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${
                        student.status === "checked-in"
                          ? "bg-emerald-500 text-white"
                          : student.status === "absent"
                          ? "bg-red-500 text-white"
                          : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {student.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                      {student.checkedInAt && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          Checked in at {student.checkedInAt}
                        </p>
                      )}
                      {student.status === "absent" && (
                        <p className="text-xs text-red-600 dark:text-red-400">Marked absent</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {student.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleManualCheckIn(student.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                        >
                          Check In
                        </button>
                        <button
                          onClick={() => handleMarkAbsent(student.id)}
                          className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500 transition-colors"
                        >
                          Absent
                        </button>
                      </>
                    )}
                    {student.status === "checked-in" && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    {student.status === "absent" && (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Attendance: {checkedInCount}/{realEnrolled || classInfo.enrolled || students.length} ({(() => {
              const total = realEnrolled || classInfo.enrolled || students.length;
              return total > 0 ? Math.round((checkedInCount / total) * 100) : 0;
            })()}%)
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
