"use client";

import { useEffect } from "react";

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export default function SlidePanel({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: SlidePanelProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 bg-neutral-950/55 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className={`relative flex h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-neutral-200/80 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-gray-800 sm:h-full sm:rounded-none sm:rounded-l-[28px] ${sizeClasses[size]}`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
