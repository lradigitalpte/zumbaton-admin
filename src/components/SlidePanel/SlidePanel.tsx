"use client";

import { useEffect, useRef } from "react";

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  position?: "right" | "left";
  showOverlay?: boolean;
  footer?: React.ReactNode;
}

const SlidePanel = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  position = "right",
  showOverlay = true,
  footer,
}: SlidePanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && isOpen) {
        onClose();
      }
    };

    if (showOverlay) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose, showOverlay]);

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  const positionClasses = {
    right: {
      panel: "right-0",
      translate: isOpen ? "translate-x-0" : "translate-x-full",
    },
    left: {
      panel: "left-0",
      translate: isOpen ? "translate-x-0" : "-translate-x-full",
    },
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay – darker in dark mode for better contrast */}
      {showOverlay && (
        <div
          className={`absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-[1px] transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute top-0 h-full w-full ${sizeClasses[size]} ${positionClasses[position].panel} ${positionClasses[position].translate} transform transition-transform duration-300 ease-in-out`}
      >
        <div className="h-full flex flex-col bg-white dark:bg-gray-900 shadow-xl dark:shadow-black/30 border-l border-transparent dark:border-gray-700/80">
          {/* Header */}
          <div className="flex items-start justify-between p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-gray-50/50 dark:bg-gray-900">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center gap-3 p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlidePanel;
