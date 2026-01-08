"use client";
import React, { useEffect, useRef, useState,useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons/index";
import SidebarWidget from "./SidebarWidget";
import { useAuth } from "../context/AuthContext";
import { isRoleAtLeast } from "../services/rbac.service";
import type { UserRole } from "@/api/schemas";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const getNavItems = (user: { role: string } | null): NavItem[] => [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/dashboard",
  },
  {
    icon: <CalenderIcon />,
    name: "Classes",
    subItems: [
      { name: "All Classes", path: "/classes", pro: false },
      { name: "Add New Class", path: "/classes/new", pro: false },
      { name: "Rooms & Studios", path: "/rooms", pro: false },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "Users",
    subItems: [
      { name: "All Users", path: "/users", pro: false },
      { name: "Staff", path: "/users/staff", pro: false },
      { name: "Flagged Users", path: "/users/flagged", pro: false },
    ],
  },
  {
    name: "Attendance",
    icon: <ListIcon />,
    subItems: [
      { name: "Check-In", path: "/attendance", pro: false },
      { name: "No-Shows", path: "/attendance/no-shows", pro: false },
    ],
  },
  {
    name: "Tokens",
    icon: <TableIcon />,
    subItems: [
      { name: "Packages", path: "/packages", pro: false },
      { name: "Transactions", path: "/tokens", pro: false },
      { name: "Adjustments", path: "/tokens/adjustments", pro: false },
    ],
  },
  {
    name: "Reports",
    icon: <PieChartIcon />,
    subItems: [
      { name: "Overview", path: "/reports", pro: false },
      { name: "Revenue", path: "/reports/revenue", pro: false },
      { name: "Attendance", path: "/reports/attendance", pro: false },
      ...(user && isRoleAtLeast(user.role as UserRole, 'admin') ? [{ name: "Audits", path: "/reports/audits", pro: false }] : []),
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: "Settings",
    subItems: [
      { name: "General", path: "/settings", pro: false },
      { name: "Profile", path: "/settings/profile", pro: false },
      { name: "Notifications", path: "/settings/notifications", pro: false },
      { name: "Cron Jobs", path: "/settings/cron-jobs", pro: false },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const { signOut, user } = useAuth();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const manualToggleRef = useRef<{ type: "main" | "others"; index: number } | null>(null);
  const isManualToggleRef = useRef(false);

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  // Check if a menu item has an active submenu item
  const hasActiveSubItem = useCallback((nav: NavItem) => {
    if (!nav.subItems) return false;
    return nav.subItems.some((subItem) => isActive(subItem.path));
  }, [isActive]);

  // Auto-open submenu if current path matches a submenu item (only if not manually toggled)
  useEffect(() => {
    // Don't auto-open if user just manually toggled
    if (isManualToggleRef.current) {
      isManualToggleRef.current = false;
      return;
    }

    let submenuMatched = false;
    let targetSubmenu: { type: "main" | "others"; index: number } | null = null;
    
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems && hasActiveSubItem(nav)) {
          targetSubmenu = {
            type: menuType as "main" | "others",
            index,
          };
          submenuMatched = true;
        }
      });
    });

    // Only update if different from current state
    if (targetSubmenu) {
      setOpenSubmenu((prev) => {
        if (!prev || prev.type !== targetSubmenu!.type || prev.index !== targetSubmenu!.index) {
          return targetSubmenu;
        }
        return prev;
      });
    } else {
      // Don't close if we have an active submenu item somewhere
      const shouldKeepOpen = ["main", "others"].some((menuType) => {
        const items = menuType === "main" ? navItems : othersItems;
        return items.some((nav) => hasActiveSubItem(nav));
      });
      if (!shouldKeepOpen) {
        setOpenSubmenu((prev) => prev ? null : prev);
      }
    }
  }, [pathname, hasActiveSubItem]);

  // Set the height of the submenu items when the submenu is opened
  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if (subMenuRefs.current[key]) {
          setSubMenuHeight((prevHeights) => ({
            ...prevHeights,
            [key]: subMenuRefs.current[key]?.scrollHeight || 0,
          }));
        }
      }, 10);
    }
  }, [openSubmenu]);

  // Toggle submenu open/close
  const handleSubmenuToggle = useCallback((index: number, menuType: "main" | "others") => {
    isManualToggleRef.current = true;
    setOpenSubmenu((prevOpenSubmenu) => {
      // If clicking the same menu that's already open, close it
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        manualToggleRef.current = null;
        return null;
      }
      // Otherwise, open the clicked menu
      const newState = { type: menuType, index };
      manualToggleRef.current = newState;
      return newState;
    });
  }, []);

  // Close dropdown when clicking outside sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openSubmenu) return;

      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside the sidebar
      if (sidebarRef.current && sidebarRef.current.contains(target)) {
        // Don't close if clicking on a menu button (let toggle handle it)
        const clickedButton = target.closest('button.menu-item');
        if (clickedButton) {
          return;
        }
        // Don't close if clicking on a submenu link (let navigation happen)
        const clickedLink = target.closest('a.menu-dropdown-item');
        if (clickedLink) {
          return;
        }
      }
      
      // Close dropdown if clicking outside the sidebar
      if (sidebarRef.current && !sidebarRef.current.contains(target)) {
        setOpenSubmenu(null);
        manualToggleRef.current = null;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openSubmenu]);

  const navItems = getNavItems(user);

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-2">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmenuToggle(index, menuType);
              }}
              className={`menu-item group  ${
                (openSubmenu?.type === menuType && openSubmenu?.index === index) || hasActiveSubItem(nav)
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  (openSubmenu?.type === menuType && openSubmenu?.index === index) || hasActiveSubItem(nav)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-300 ${
                    (openSubmenu?.type === menuType && openSubmenu?.index === index) || hasActiveSubItem(nav)
                      ? "rotate-180 text-lime-400"
                      : "text-gray-400"
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-1 space-y-0.5 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      onClick={() => {
                        // Don't close immediately - let the active state show
                        // Only close if clicking on a different submenu item
                        if (!isActive(subItem.path)) {
                          setTimeout(() => {
                            setOpenSubmenu(null);
                          }, 300);
                        }
                      }}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      ref={sidebarRef}
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-gray-900 border-r border-gray-800 text-white h-screen transition-all duration-300 ease-in-out z-50 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="py-8 flex justify-start lg:justify-start hidden lg:block">
        <Link href="/dashboard" className="flex items-center gap-2">
          {(isExpanded || isHovered || isMobileOpen) ? (
            <Image
              src="/images/logo/zumbaton logo (transparent).png"
              alt="Zumbaton Logo"
              width={240}
              height={80}
              className="h-16 w-auto block"
              priority
            />
          ) : (
            <Image
              src="/images/logo/logo fav.png"
              alt="Zumbaton"
              width={64}
              height={64}
              className="h-16 w-16 rounded-xl block"
              priority
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
            <div className="flex flex-col gap-2">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
        </div>
        <div className="pt-4 pb-5 border-t border-gray-800">
          {isExpanded || isHovered || isMobileOpen ? (
            <SidebarWidget />
          ) : (
            <button
              onClick={signOut}
              className="menu-item group menu-item-inactive cursor-pointer lg:justify-center hover:bg-red-500/20 group-hover:text-red-400"
              title="Logout"
            >
              <span className="menu-item-icon-inactive group-hover:text-red-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
