"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  classId: string;
  className: string;
  sessionDate?: string;
  sessionTime?: string;
  refreshInterval?: number; // in seconds, default 600 (10 minutes)
  size?: number;
}

interface QRData {
  classId: string;
  sessionDate: string;
  sessionTime: string;
  token: string;
  expiresAt: number;
}

export default function QRCodeDisplay({
  classId,
  className,
  sessionDate,
  sessionTime,
  refreshInterval = 600, // 10 minutes (600 seconds)
  size = 280,
}: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [countdown, setCountdown] = useState(refreshInterval);
  const [currentToken, setCurrentToken] = useState("");

  // Generate a cryptographically secure token
  const generateToken = useCallback(() => {
    // Use crypto.randomUUID for better security
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
    
    // Fallback for older browsers - use crypto.getRandomValues
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    // Last resort fallback (less secure)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) { // Longer token for better security
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }, []);

  // Generate QR code
  const generateQR = useCallback(async () => {
    const now = new Date();
    const token = generateToken();
    setCurrentToken(token);

    const qrDataObject: QRData = {
      classId,
      sessionDate: sessionDate || now.toISOString().split("T")[0],
      sessionTime: sessionTime || now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      token,
      expiresAt: Date.now() + refreshInterval * 1000,
    };

    // Create URL for phone camera scanning (opens web app directly)
    // Get web app URL from environment or use default
    const webAppUrl = process.env.NEXT_PUBLIC_WEB_URL || 'https://zumbaton.sg';
    // Use URL-safe base64 encoding (replace + with -, / with _, remove = padding)
    const base64Data = btoa(JSON.stringify(qrDataObject));
    const encodedData = base64Data.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const checkInUrl = `${webAppUrl}/check-in/${encodedData}`;

    try {
      // QR code contains URL - when scanned from phone camera, opens web app directly
      const dataUrl = await QRCode.toDataURL(checkInUrl, {
        width: size,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
      setCountdown(refreshInterval);
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  }, [classId, sessionDate, sessionTime, refreshInterval, size, generateToken]);

  // Initial generation
  useEffect(() => {
    generateQR();
  }, [generateQR, refreshInterval]);

  // Countdown and refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          generateQR();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [generateQR, refreshInterval]);

  // Format countdown display
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `0:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center overflow-visible pb-4 w-full">
      {/* QR Code Container */}
      <div className="relative rounded-3xl bg-white p-6 shadow-lg overflow-visible mb-4 w-fit">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Attendance QR Code"
            width={size}
            height={size}
            className="rounded-2xl block"
            style={{ display: 'block', width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-2xl bg-gray-100"
            style={{ width: size, height: size }}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-brand-500" />
          </div>
        )}

        {/* Refresh indicator */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 transform z-10">
          <div className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-white shadow-lg">
            <svg
              className={`h-4 w-4 ${countdown <= 5 ? "animate-pulse text-amber-400" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="text-sm font-medium">{formatCountdown(countdown)}</span>
          </div>
        </div>
      </div>

      {/* Class info */}
      <div className="mt-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{className}</h2>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Scan to check in • Code refreshes every {refreshInterval >= 60 ? `${Math.floor(refreshInterval / 60)} minute${Math.floor(refreshInterval / 60) > 1 ? 's' : ''}` : `${refreshInterval}s`}
        </p>
      </div>

      {/* Debug info (hidden in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4 text-xs text-gray-400">
          Token: {currentToken}
        </div>
      )}
    </div>
  );
}
