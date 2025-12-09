"use client";

import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/layout/AppHeader";
import TutorSidebar from "@/layout/TutorSidebar";
import Backdrop from "@/layout/Backdrop";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

// Roles that can access the tutor portal
const TUTOR_ROLES = ['instructor', 'super_admin', 'admin'];

export default function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Protect tutor routes - redirect to signin if not authenticated or not instructor
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/signin');
    } else if (!isLoading && user && !TUTOR_ROLES.includes(user.role)) {
      // User is logged in but not an instructor - redirect to appropriate portal
      router.replace('/dashboard');
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
      <TutorSidebar />
      <Backdrop />
      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        {/* Header */}
        <AppHeader />
        {/* Page Content */}
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
      </div>
    </div>
  );
}
