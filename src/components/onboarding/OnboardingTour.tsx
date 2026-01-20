"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

interface OnboardingStep {
  id: string;
  target: string; // CSS selector or data attribute
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    type: 'navigate' | 'click' | 'highlight';
    value?: string; // URL for navigate, selector for click
  };
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    target: 'body',
    title: 'Welcome to Zumbaton Admin! 👋',
    content: 'Let\'s take a quick tour to show you around. This will only take a few minutes.',
    position: 'center',
  },
  {
    id: 'dashboard',
    target: '[data-onboarding="dashboard-menu"]',
    title: 'Dashboard 📊',
    content: 'Your dashboard shows key metrics, today\'s classes, quick actions, and recent activity. This is your command center!',
    position: 'right',
    action: {
      type: 'navigate',
      value: '/dashboard',
    },
  },
  {
    id: 'classes',
    target: '[data-onboarding="classes-menu"]',
    title: 'Classes Management 📅',
    content: 'Create and manage all your fitness classes here. You can create single classes, recurring series, or course packages.',
    position: 'right',
    action: {
      type: 'navigate',
      value: '/classes',
    },
  },
  {
    id: 'users',
    target: '[data-onboarding="users-menu"]',
    title: 'Users Management 👥',
    content: 'Manage all your members, staff, and instructors. View user profiles, manage roles, and track flagged users.',
    position: 'right',
    action: {
      type: 'navigate',
      value: '/users',
    },
  },
  {
    id: 'attendance',
    target: '[data-onboarding="attendance-menu"]',
    title: 'Attendance Tracking ✅',
    content: 'Track class attendance, check-in students, and manage no-shows. Use QR codes for quick check-ins!',
    position: 'right',
    action: {
      type: 'navigate',
      value: '/attendance',
    },
  },
  {
    id: 'tokens',
    target: '[data-onboarding="tokens-menu"]',
    title: 'Token Management 🪙',
    content: 'Manage token packages, view transactions, and make adjustments. Tokens are used for class bookings.',
    position: 'right',
    action: {
      type: 'navigate',
      value: '/packages',
    },
  },
  {
    id: 'reports',
    target: '[data-onboarding="reports-menu"]',
    title: 'Reports & Analytics 📈',
    content: 'View detailed reports on revenue, attendance, and system audits. Track your business performance.',
    position: 'right',
    action: {
      type: 'navigate',
      value: '/reports',
    },
  },
  {
    id: 'settings',
    target: '[data-onboarding="settings-menu"]',
    title: 'Settings ⚙️',
    content: 'Configure business settings, manage your profile, set up notifications, and monitor cron jobs.',
    position: 'right',
    action: {
      type: 'navigate',
      value: '/settings',
    },
  },
  {
    id: 'search',
    target: '[data-onboarding="search-button"]',
    title: 'Quick Search 🔍',
    content: 'Press Cmd+K (Mac) or Ctrl+K (Windows) to quickly search for classes, users, or navigate anywhere.',
    position: 'bottom',
  },
  {
    id: 'notifications',
    target: '[data-onboarding="notifications-button"]',
    title: 'Notifications 🔔',
    content: 'Stay updated with notifications about bookings, cancellations, and system alerts.',
    position: 'bottom',
  },
  {
    id: 'complete',
    target: 'body',
    title: 'You\'re All Set! 🎉',
    content: 'You now know the basics of Zumbaton Admin. Feel free to explore and don\'t hesitate to check the help section if you need assistance.',
    position: 'center',
  },
];

export default function OnboardingTour() {
  const { user, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [arrowPosition, setArrowPosition] = useState<'top' | 'bottom' | 'left' | 'right' | 'none'>('none');
  const router = useRouter();
  const pathname = usePathname();
  const targetRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only check/show onboarding if user is authenticated and we haven't checked yet
    if (typeof window === 'undefined') return;
    if (isLoading) return; // Wait for auth to load
    if (!user?.id) return; // Only show for authenticated users
    if (hasChecked) return; // Only check once
    
    setHasChecked(true);
    
    // Check onboarding status from database
    const checkOnboardingStatus = async () => {
      try {
        const response = await api.get<{ success: boolean; data?: { completed: boolean } }>('/api/onboarding');
        
        if (response.error) {
          console.error('[Onboarding] Error checking status:', response.error);
          return;
        }
        
        // API client wraps response in { success: true, data: actualResponse }
        const apiResponse = response.data as { success: boolean; data?: { completed: boolean } };
        const completed = apiResponse?.success && apiResponse?.data?.completed;
        
        if (!completed) {
          // Start onboarding after a short delay
          const timer = setTimeout(() => {
            setIsActive(true);
            // Wait a bit more for DOM to be ready
            setTimeout(() => {
              updateStepPosition(0);
            }, 500);
          }, 1000);
          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error('[Onboarding] Error checking status:', error);
        // On error, don't show onboarding (fail silently)
      }
    };
    
    checkOnboardingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isLoading, hasChecked]);

  const updateStepPosition = useCallback((stepIndex: number) => {
    const step = ONBOARDING_STEPS[stepIndex];
    if (!step) return;

    if (step.target === 'body' || step.position === 'center') {
      // Center overlay for welcome/complete steps
      setOverlayStyle({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 9998,
      });
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        maxWidth: '420px',
        width: '90%',
      });
      setHighlightStyle({});
      setArrowPosition('none');
      return;
    }

    // Find target element
    const targetElement = document.querySelector(step.target) as HTMLElement;
    if (!targetElement) {
      // If target not found, try next step after delay
      if (stepIndex < ONBOARDING_STEPS.length - 1) {
        setTimeout(() => setCurrentStep(stepIndex + 1), 500);
      }
      return;
    }

    targetRef.current = targetElement;
    const rect = targetElement.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Add pulsing highlight effect to target element
    const highlightRect = {
      top: rect.top + scrollY,
      left: rect.left + scrollX,
      width: rect.width,
      height: rect.height,
    };

    setHighlightStyle({
      position: 'absolute',
      top: `${highlightRect.top}px`,
      left: `${highlightRect.left}px`,
      width: `${highlightRect.width}px`,
      height: `${highlightRect.height}px`,
      borderRadius: '8px',
      border: '3px solid #3b82f6',
      boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)',
      zIndex: 9997,
      pointerEvents: 'none',
      animation: 'pulse-highlight 2s ease-in-out infinite',
    });

    // Calculate overlay with spotlight effect
    setOverlayStyle({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(2px)',
      zIndex: 9996,
      clipPath: `polygon(
        0% 0%,
        0% 100%,
        ${rect.left - 8}px 100%,
        ${rect.left - 8}px ${rect.top - 8}px,
        ${rect.right + 8}px ${rect.top - 8}px,
        ${rect.right + 8}px ${rect.bottom + 8}px,
        ${rect.left - 8}px ${rect.bottom + 8}px,
        ${rect.left - 8}px 100%,
        100% 100%,
        100% 0%
      )`,
    });

    // Smart positioning - avoid edges and white backgrounds
    let tooltipTop = rect.top + scrollY;
    let tooltipLeft = rect.left + scrollX;
    let arrowPos: 'top' | 'bottom' | 'left' | 'right' = 'right';
    const tooltipWidth = 380;
    const tooltipHeight = 250;
    const spacing = 16;

    // Determine best position based on available space
    const spaceRight = viewportWidth - rect.right;
    const spaceLeft = rect.left;
    const spaceTop = rect.top;
    const spaceBottom = viewportHeight - rect.bottom;

    if (step.position === 'right' && spaceRight >= tooltipWidth + spacing) {
      tooltipLeft = rect.right + scrollX + spacing;
      tooltipTop = rect.top + scrollY + rect.height / 2;
      arrowPos = 'left';
    } else if (step.position === 'left' && spaceLeft >= tooltipWidth + spacing) {
      tooltipLeft = rect.left + scrollX - tooltipWidth - spacing;
      tooltipTop = rect.top + scrollY + rect.height / 2;
      arrowPos = 'right';
    } else if (step.position === 'bottom' && spaceBottom >= tooltipHeight + spacing) {
      tooltipTop = rect.bottom + scrollY + spacing;
      tooltipLeft = rect.left + scrollX + rect.width / 2;
      arrowPos = 'top';
    } else if (step.position === 'top' && spaceTop >= tooltipHeight + spacing) {
      tooltipTop = rect.top + scrollY - tooltipHeight - spacing;
      tooltipLeft = rect.left + scrollX + rect.width / 2;
      arrowPos = 'bottom';
    } else {
      // Fallback: find best position
      if (spaceRight >= tooltipWidth) {
        tooltipLeft = rect.right + scrollX + spacing;
        tooltipTop = rect.top + scrollY + rect.height / 2;
        arrowPos = 'left';
      } else if (spaceLeft >= tooltipWidth) {
        tooltipLeft = rect.left + scrollX - tooltipWidth - spacing;
        tooltipTop = rect.top + scrollY + rect.height / 2;
        arrowPos = 'right';
      } else if (spaceBottom >= tooltipHeight) {
        tooltipTop = rect.bottom + scrollY + spacing;
        tooltipLeft = rect.left + scrollX + rect.width / 2;
        arrowPos = 'top';
      } else {
        tooltipTop = rect.top + scrollY - tooltipHeight - spacing;
        tooltipLeft = rect.left + scrollX + rect.width / 2;
        arrowPos = 'bottom';
      }
    }

    // Ensure tooltip stays within viewport
    tooltipTop = Math.max(20, Math.min(tooltipTop, viewportHeight - tooltipHeight - 20));
    tooltipLeft = Math.max(20, Math.min(tooltipLeft, viewportWidth - tooltipWidth - 20));

    setTooltipStyle({
      position: 'fixed',
      top: `${tooltipTop}px`,
      left: `${tooltipLeft}px`,
      zIndex: 9999,
      maxWidth: `${tooltipWidth}px`,
      transform: arrowPos === 'left' || arrowPos === 'right' 
        ? 'translateY(-50%)' 
        : 'translateX(-50%)',
    });

    // Calculate arrow position
    let arrowTop: string | number = 0;
    let arrowLeft: string | number = 0;
    
    if (arrowPos === 'left') {
      arrowTop = '50%';
      arrowLeft = '-12px';
    } else if (arrowPos === 'right') {
      arrowTop = '50%';
      arrowLeft = '100%';
    } else if (arrowPos === 'top') {
      arrowTop = '-12px';
      arrowLeft = '50%';
    } else if (arrowPos === 'bottom') {
      arrowTop = '100%';
      arrowLeft = '50%';
    }

    setArrowStyle({
      position: 'absolute',
      top: arrowTop,
      left: arrowLeft,
      transform: arrowPos === 'left' || arrowPos === 'right' 
        ? 'translateY(-50%)' 
        : 'translateX(-50%)',
    });

    setArrowPosition(arrowPos);

    // Scroll into view if needed
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, []);

  useEffect(() => {
    if (isActive && currentStep < ONBOARDING_STEPS.length && typeof window !== 'undefined') {
      // Longer delay to ensure DOM is ready after navigation, especially for page loads
      const timer = setTimeout(() => {
        updateStepPosition(currentStep);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isActive, pathname, updateStepPosition]);

  const handleNext = () => {
    const step = ONBOARDING_STEPS[currentStep];
    const nextStepIndex = currentStep + 1;
    
    // Check if NEXT step has navigation action - navigate BEFORE showing that step
    if (nextStepIndex < ONBOARDING_STEPS.length) {
      const nextStep = ONBOARDING_STEPS[nextStepIndex];
      if (nextStep.action && nextStep.action.type === 'navigate' && nextStep.action.value) {
        // Navigate to the next step's target page first
        router.push(nextStep.action.value);
        // Then move to next step after navigation completes
        setTimeout(() => {
          setCurrentStep(nextStepIndex);
        }, 600);
        return;
      }
    }
    
    // Handle current step action if specified (for non-navigation actions)
    if (step.action) {
      if (step.action.type === 'click' && step.action.value) {
        const element = document.querySelector(step.action.value) as HTMLElement;
        element?.click();
      }
    }

    // Move to next step normally (no navigation needed)
    if (nextStepIndex < ONBOARDING_STEPS.length) {
      setCurrentStep(nextStepIndex);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    setIsActive(false);
    if (!user?.id) return;
    
    // Mark onboarding as completed in database
    try {
      await api.put('/api/onboarding', { completed: true });
    } catch (error) {
      console.error('[Onboarding] Error marking as completed:', error);
      // Continue even if API call fails
    }
  };

  if (!isActive || currentStep >= ONBOARDING_STEPS.length) {
    return null;
  }

  const step = ONBOARDING_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <>
      <style jsx>{`
        @keyframes pulse-highlight {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.4), 0 0 30px rgba(59, 130, 246, 0.6), 0 0 60px rgba(59, 130, 246, 0.4);
            transform: scale(1.02);
          }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .onboarding-tooltip {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>

      {/* Overlay */}
      <div
        style={overlayStyle}
        className="fixed inset-0 z-[9996] transition-all duration-300"
        onClick={isFirstStep ? undefined : handleNext}
      />

      {/* Highlight Effect */}
      {highlightStyle.top && (
        <div
          style={highlightStyle}
          className="pointer-events-none"
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className="onboarding-tooltip z-[9999]"
        role="dialog"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-content"
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-2 border-gray-900 dark:border-gray-700 p-6 relative">
          {/* Arrow */}
          {arrowPosition !== 'none' && (
            <div
              style={arrowStyle}
              className={`absolute w-0 h-0 ${
                arrowPosition === 'left' 
                  ? 'border-t-[12px] border-b-[12px] border-r-[12px] border-t-transparent border-b-transparent border-r-gray-900 dark:border-r-gray-700'
                  : arrowPosition === 'right'
                  ? 'border-t-[12px] border-b-[12px] border-l-[12px] border-t-transparent border-b-transparent border-l-gray-900 dark:border-l-gray-700'
                  : arrowPosition === 'top'
                  ? 'border-l-[12px] border-r-[12px] border-b-[12px] border-l-transparent border-r-transparent border-b-gray-900 dark:border-b-gray-700'
                  : 'border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700'
              }`}
            />
          )}

          {/* Progress indicator */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-medium mb-3">
              <span className="text-gray-600 dark:text-gray-400">
                Step {currentStep + 1} of {ONBOARDING_STEPS.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-medium"
                aria-label="Skip tour"
              >
                Skip tour
              </button>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <h3 
            id="onboarding-title"
            className="text-2xl font-bold text-gray-900 dark:text-white mb-3"
          >
            {step.title}
          </h3>
          <p 
            id="onboarding-content"
            className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed"
          >
            {step.content}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            {!isFirstStep && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 border border-gray-300 dark:border-gray-600"
                aria-label="Previous step"
              >
                ← Back
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleNext}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              aria-label={isLastStep ? 'Complete tour' : 'Next step'}
            >
              {isLastStep ? 'Get Started! 🚀' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook to restart onboarding
export function useOnboarding() {
  const { user } = useAuth();
  const [isCompleted, setIsCompleted] = useState<boolean>(true);
  
  useEffect(() => {
    if (!user?.id) {
      setIsCompleted(true);
      return;
    }
    
    // Check onboarding status from database
    const checkStatus = async () => {
      try {
        const response = await api.get<{ success: boolean; data?: { completed: boolean } }>('/api/onboarding');
        if (!response.error && response.data) {
          const apiResponse = response.data as { success: boolean; data?: { completed: boolean } };
          setIsCompleted(apiResponse?.success && apiResponse?.data?.completed || false);
        } else {
          setIsCompleted(true); // Default to completed on error
        }
      } catch (error) {
        console.error('[useOnboarding] Error checking status:', error);
        setIsCompleted(true); // Default to completed on error
      }
    };
    
    checkStatus();
  }, [user?.id]);
  
  const handleRestart = async () => {
    if (!user?.id) return;
    
    try {
      // Reset onboarding status in database
      await api.put('/api/onboarding', { completed: false });
      window.location.reload();
    } catch (error) {
      console.error('[useOnboarding] Error restarting:', error);
    }
  };

  return {
    restart: handleRestart,
    isCompleted,
  };
}
