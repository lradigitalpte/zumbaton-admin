import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { ThemeProvider } from "@/context/ThemeContext";
import Image from "next/image";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-1 bg-neutral-50 dark:bg-[#0e0e0e]">
      <ThemeProvider>
        <div className="relative flex h-screen w-full flex-col justify-center dark:bg-[#0e0e0e] lg:flex-row">
          {children}
          <div className="hidden h-full items-center bg-[#171717] lg:grid lg:w-1/2">
            <div className="relative z-1 flex items-center justify-center px-10">
              <div className="flex max-w-sm flex-col items-center">
                <Image
                  src="/images/logo/One step fitness logo.png"
                  alt="One Step Fitness"
                  width={320}
                  height={107}
                  className="h-28 w-auto"
                  priority
                />
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#E4F56C]">Studio admin</p>
                <p className="mt-3 text-center text-sm leading-6 text-white/60">
                  Classes, members, bookings, and the front desk. One place for the studio.
                </p>
              </div>
            </div>
          </div>
          <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}
