import type { Metadata } from "next";
import { DashboardMetrics, TodaysClasses, RecentActivity, QuickActions } from "@/components/dashboard";
import React from "react";

export const metadata: Metadata = {
  title: "Zumbathon Admin Dashboard",
  description: "Zumbathon fitness class management dashboard",
};

export default function Dashboard() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Metrics Row */}
      <div className="col-span-12">
        <DashboardMetrics />
      </div>

      {/* Today's Classes */}
      <div className="col-span-12 xl:col-span-8">
        <TodaysClasses />
      </div>

      {/* Quick Actions */}
      <div className="col-span-12 xl:col-span-4">
        <QuickActions />
      </div>

      {/* Recent Activity */}
      <div className="col-span-12">
        <RecentActivity />
      </div>
    </div>
  );
}
