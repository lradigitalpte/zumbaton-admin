"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import SearchModal from "@/components/header/SearchModal";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/common/BrandLogo";
import Link from "next/link";
import React, { useState, useEffect, useMemo } from "react";

const AppHeader: React.FC = () => {
  const [isSearchOpen, setSearchOpen] = useState(false);

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { user } = useAuth();
  const pathname = usePathname();

  // Check if we're in tutor portal
  const isTutorPortal = pathname?.startsWith('/tutor') || false;
  
  // Show attendance button only for admin portal (not tutor)
  const showAttendanceButton = useMemo(() => {
    return !isTutorPortal && (user?.role === 'super_admin' || user?.role === 'admin');
  }, [isTutorPortal, user?.role]);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const iconButton =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/80 bg-white text-neutral-700 shadow-[0_8px_20px_rgba(16,24,40,0.04)] transition-colors hover:bg-neutral-100 dark:border-white/10 dark:bg-gray-800 dark:text-white dark:hover:bg-white/10";

  return (
    <header className="sticky top-0 z-99999 flex h-16 w-full items-center border-b border-neutral-200/80 bg-gray-50/90 px-2 backdrop-blur-md dark:border-white/10 dark:bg-gray-900/90 sm:px-4 lg:px-6">
      <div className="flex w-full min-w-0 items-center gap-2">
        <button className={iconButton} onClick={handleToggle} aria-label="Toggle Sidebar">
          {isMobileOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h10M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        <Link href={isTutorPortal ? "/tutor" : "/dashboard"} className="min-w-0 shrink lg:hidden">
          <BrandLogo
            width={160}
            height={40}
            className="h-8 w-auto max-w-[72px] object-contain object-left sm:max-w-[140px]"
            alt="One Step Fitness Logo"
          />
        </Link>

        <button
          data-onboarding="search-button"
          onClick={() => setSearchOpen(true)}
          className="hidden h-10 min-w-0 flex-1 items-center gap-3 rounded-full border border-neutral-200/80 bg-white px-4 text-sm text-neutral-500 shadow-[0_8px_20px_rgba(16,24,40,0.04)] transition-colors hover:border-neutral-300 lg:flex xl:max-w-[430px] dark:border-white/10 dark:bg-gray-800 dark:text-white/60"
        >
          <svg className="fill-neutral-400" width="18" height="18" viewBox="0 0 20 20" aria-hidden>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
            />
          </svg>
          <span className="flex-1 truncate text-left">Search or type command...</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-white/10 dark:text-white/70">
            ⌘K
          </span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={`${iconButton} lg:hidden`}
            aria-label="Search"
          >
            <svg className="fill-current" width="18" height="18" viewBox="0 0 20 20" aria-hidden>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
              />
            </svg>
          </button>

          <div className="hidden sm:block">
            <ThemeToggleButton />
          </div>

          {showAttendanceButton && (
            <Link
              href="/attendance"
              data-onboarding="attendance-button"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-2.5 text-sm font-medium text-neutral-800 shadow-[0_8px_20px_rgba(16,24,40,0.04)] transition-colors hover:bg-[#E4F56C] sm:px-3 dark:border-white/10 dark:bg-gray-800 dark:text-white dark:hover:bg-[#E4F56C] dark:hover:text-neutral-950"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden md:inline">Attendance</span>
            </Link>
          )}

          <NotificationDropdown data-onboarding="notifications-button" />
          <UserDropdown />
        </div>
      </div>

      <SearchModal isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};

export default AppHeader;
