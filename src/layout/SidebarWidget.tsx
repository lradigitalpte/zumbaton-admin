"use client";
import React from "react";
import { useAuth } from "@/context/AuthContext";

export default function SidebarWidget() {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="w-full">
      <button
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#E4F56C] hover:text-neutral-950"
      >
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
        Logout
      </button>
    </div>
  );
}
