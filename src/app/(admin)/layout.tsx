"use client";

import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Simple route protection - redirect to signin if not authenticated
  useEffect(() => {
    // Only redirect if auth check is complete and no user
    if (!isLoading && !user) {
      router.replace('/signin');
    }
  }, [user, isLoading, router]);

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      {/* Sidebar and Backdrop */}
      <AppSidebar />
      <Backdrop />
      {/* Main Content Area */}
      <div
        className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        {/* Header */}
        <AppHeader />
        {/* Page Content */}
        <div className="mx-auto min-w-0 max-w-(--breakpoint-2xl) p-3 sm:p-4 md:p-6">{children}</div>
      </div>
      <OnboardingTour />
    </div>
  );
}
