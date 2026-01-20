"use client";

import React, { useState } from 'react';
import { useOnboarding } from './OnboardingTour';

export default function OnboardingHelpButton() {
  const { restart: restartOnboarding } = useOnboarding();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={restartOnboarding}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-[9995] flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200"
      title="Restart the onboarding tour"
      aria-label="Restart onboarding tour"
    >
      <svg 
        className="h-5 w-5" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M13 10V3L4 14h7v7l9-11h-7z" 
        />
      </svg>
      {isHovered && (
        <span className="whitespace-nowrap animate-in fade-in slide-in-from-right-2">
          Restart Tour
        </span>
      )}
    </button>
  );
}
