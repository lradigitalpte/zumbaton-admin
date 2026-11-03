"use client";

import React from "react";
import { useTodaysClasses, TodaysClass } from "@/hooks/useDashboard";
import { StudioCard } from "./studio-ui";

function splitTime(time: string) {
  const match = time.match(/^(.*)\s+(AM|PM)$/i);
  if (!match) return { clock: time, period: "" };
  return { clock: match[1], period: match[2].toUpperCase() };
}

function niceMax(n: number) {
  if (n <= 4) return 4;
  if (n <= 8) return 8;
  if (n <= 10) return 10;
  return Math.ceil(n / 5) * 5;
}

function statusTone(status: TodaysClass["status"]) {
  if (status === "completed") return "bg-neutral-950 text-white";
  if (status === "in-progress") return "bg-[#E4F56C] text-neutral-950";
  return "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/70";
}

function statusLabel(status: TodaysClass["status"]) {
  if (status === "completed") return "Completed";
  if (status === "in-progress") return "In progress";
  return "Upcoming";
}

function ClassColumn({ item, yMax }: { item: TodaysClass; yMax: number }) {
  const chartH = 200;
  const empty = item.booked === 0 && item.checkedIn === 0;
  const total = Math.max(item.booked, item.checkedIn);
  const barH = empty ? 0 : Math.max(18, (total / yMax) * chartH);
  const openSpots = Math.max(item.booked - item.checkedIn, 0);
  const rate = item.booked > 0 ? Math.round((item.checkedIn / item.booked) * 100) : item.checkedIn > 0 ? 100 : null;
  const blackShare = total > 0 ? item.checkedIn / total : 0;
  const { clock } = splitTime(item.time);
  const labelInside = rate !== null && blackShare >= 0.34 && barH >= 48;

  return (
    <div className="flex w-[4.75rem] shrink-0 flex-col items-center">
      <div className="relative flex h-[200px] w-full items-end justify-center">
        {empty ? (
          <div className="h-[78%] w-11 rounded-[18px] border-2 border-dashed border-neutral-300 dark:border-white/20" />
        ) : (
          <div className="flex w-11 flex-col overflow-hidden rounded-[18px]" style={{ height: barH }}>
            <div className="bg-neutral-950 dark:bg-white" style={{ flex: `${item.checkedIn} 1 0` }} />
            <div className="bg-[#E4F56C]" style={{ flex: `${openSpots} 1 0` }} />
          </div>
        )}
        {rate !== null && (
          <span
            className={`absolute left-1/2 z-10 -translate-x-1/2 text-[11px] font-semibold ${
              labelInside ? "text-white dark:text-neutral-950" : "text-neutral-950 dark:text-white"
            }`}
            style={labelInside ? { bottom: barH * (1 - blackShare / 2) - 8 } : { bottom: barH + 6 }}
          >
            {rate}%
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-medium text-neutral-800 dark:text-white/80">{clock}</p>
      <p className="max-w-[4.75rem] truncate text-[10px] text-neutral-400" title={item.title}>
        {item.title}
      </p>
    </div>
  );
}

export const TodaysClasses = () => {
  const { data: classes, isLoading, error } = useTodaysClasses();
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Singapore",
  });

  return (
    <StudioCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-white/90">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19V5M4 19h16" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16v-5M12 16V8M16 16v-3" />
            </svg>
            Today
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-500 dark:text-white/50">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-white" />
              Checked in
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E4F56C]" />
              Still booked
            </span>
          </div>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 dark:bg-white/10 dark:text-white/80">
          {dateLabel}
        </span>
      </div>

      <div className="mt-6">
        {error ? (
          <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t load today&apos;s classes.
          </p>
        ) : isLoading ? (
          <div className="flex h-[240px] items-end gap-6 px-8">
            {[72, 120, 96, 150].map((h) => (
              <div key={h} className="w-11 animate-pulse rounded-[18px] bg-neutral-100 dark:bg-white/10" style={{ height: h }} />
            ))}
          </div>
        ) : !classes || classes.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">No classes scheduled for today.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-full">
              <div className="flex h-[200px] w-8 shrink-0 flex-col justify-between text-[11px] text-neutral-400">
                <span>{niceMax(Math.max(1, ...classes.map((c) => Math.max(c.booked, c.checkedIn))))}</span>
                <span>{Math.round(niceMax(Math.max(1, ...classes.map((c) => Math.max(c.booked, c.checkedIn)))) / 2)}</span>
                <span>0</span>
              </div>
              <div className="relative flex flex-1 justify-around gap-4 px-2">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[200px]">
                  <div className="absolute inset-x-0 top-0 border-t border-neutral-200 dark:border-white/10" />
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200 dark:border-white/10" />
                  <div className="absolute inset-x-0 bottom-0 border-t border-neutral-200 dark:border-white/10" />
                </div>
                {classes.map((item) => (
                  <ClassColumn
                    key={item.id}
                    item={item}
                    yMax={niceMax(Math.max(1, ...classes.map((c) => Math.max(c.booked, c.checkedIn))))}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isLoading && !error && classes && classes.length > 0 && (
        <ul className="mt-6 divide-y divide-neutral-100 dark:divide-white/10">
          {classes.map((item) => {
            const { clock, period } = splitTime(item.time);
            const countLabel =
              item.status === "completed"
                ? `${item.checkedIn}/${item.booked} attended`
                : `${item.booked}/${item.capacity} booked`;
            return (
              <li key={item.id} className="flex items-center gap-4 py-3.5">
                <div className="w-16 shrink-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{period}</p>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{clock}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
                    {item.title}
                  </p>
                  <p className="truncate text-sm text-neutral-500">{item.instructor}</p>
                </div>
                <p className="hidden text-sm text-neutral-600 sm:block dark:text-white/60">{countLabel}</p>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </StudioCard>
  );
};

export default TodaysClasses;
