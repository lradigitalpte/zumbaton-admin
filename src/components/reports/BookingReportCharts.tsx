"use client";

import { useState } from "react";
import type { BookingTotals, ClassSession, YearMonthSummary } from "@/hooks/useReports";

const card = "rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-6";

function axisMax(n: number) {
  if (n <= 0) return 4;
  const padded = n * 1.18;
  const pow = Math.pow(10, Math.floor(Math.log10(padded)));
  const normal = padded / pow;
  const nice = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10;
  return nice * pow;
}

function shortMonth(name: string) {
  return name.slice(0, 3);
}

function classLabel(session: ClassSession) {
  if (session.id === "guest-placeholder-bookings") return "Guest / custom";
  return session.title;
}

function Detail({ eyebrow, value, caption }: { eyebrow: string; value: string; caption: string }) {
  return (
    <div className="mt-5 rounded-2xl bg-neutral-950 px-4 py-3 text-white">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E4F56C]">{eyebrow}</p>
      <p className="mt-1 text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-sm text-white/75">{caption}</p>
    </div>
  );
}

function GroupedColumns({
  items,
  yMax,
  selectedIndex,
  hoverIndex,
  onHover,
  onPick,
  barClass = "w-8",
  inkFirst = false,
}: {
  items: { key: string; label: string; lime: number; ink: number }[];
  yMax: number;
  selectedIndex?: number;
  hoverIndex: number | null;
  onHover: (index: number | null) => void;
  onPick?: (index: number) => void;
  barClass?: string;
  inkFirst?: boolean;
}) {
  const chartH = 240;
  const room = chartH - 22;
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[640px]">
        <div className="flex h-[240px] w-8 shrink-0 flex-col justify-between pr-2 text-right text-[11px] text-neutral-400">
          <span>{Math.round(yMax)}</span>
          <span>{Math.round(yMax / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex flex-1 justify-between gap-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[240px]">
            <div className="absolute inset-x-0 top-0 border-t border-neutral-200 dark:border-white/10" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200 dark:border-white/10" />
            <div className="absolute inset-x-0 bottom-0 border-t border-neutral-200 dark:border-white/10" />
          </div>
          {items.map((item, index) => {
            const limeH = item.lime > 0 ? Math.max(14, (item.lime / yMax) * room) : 0;
            const inkH = item.ink > 0 ? Math.max(14, (item.ink / yMax) * room) : 0;
            const selected = selectedIndex === index;
            const hot = hoverIndex === index;
            const limeBar = item.lime > 0 && (
              <span className="relative flex items-end justify-center">
                <span className={`absolute bottom-full mb-1 text-[11px] font-semibold ${hot || selected ? "text-neutral-950 dark:text-white" : "text-neutral-500"}`}>{item.lime}</span>
                <span className={`rounded-[18px] bg-[#E4F56C] ${barClass} ${selected ? "ring-2 ring-neutral-950 ring-offset-2 dark:ring-white dark:ring-offset-gray-800" : ""}`} style={{ height: limeH }} />
              </span>
            );
            const inkBar = item.ink > 0 && (
              <span className="relative flex items-end justify-center">
                <span className={`absolute bottom-full mb-1 text-[11px] font-semibold ${hot || selected ? "text-neutral-950 dark:text-white" : "text-neutral-500"}`}>{item.ink}</span>
                <span className={`rounded-[18px] bg-neutral-950 dark:bg-white ${barClass} ${selected ? "ring-2 ring-[#E4F56C] ring-offset-2 dark:ring-offset-gray-800" : ""}`} style={{ height: inkH }} />
              </span>
            );
            return (
              <button
                key={item.key}
                type="button"
                onMouseEnter={() => onHover(index)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(index)}
                onBlur={() => onHover(null)}
                onClick={() => onPick?.(index)}
                className="relative flex min-w-0 flex-1 flex-col items-center"
              >
                <span className="flex h-[240px] w-full items-end justify-center gap-1.5">
                  {item.lime <= 0 && item.ink <= 0 ? (
                    <span className={`h-[42%] rounded-[18px] border-2 border-dashed border-neutral-300 dark:border-white/20 ${barClass}`} />
                  ) : (
                    inkFirst ? <>{inkBar}{limeBar}</> : <>{limeBar}{inkBar}</>
                  )}
                </span>
                <span className={`mt-3 text-center text-[11px] font-medium leading-4 ${selected || hot ? "text-neutral-950 dark:text-white" : "text-neutral-500"}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MixDonut({ member, trial }: { member: number; trial: number }) {
  const total = member + trial;
  const slices = [
    { key: "trial", label: "Trials", value: trial, color: "#E4F56C" },
    { key: "member", label: "Members", value: member, color: "#171717" },
  ].filter((slice) => slice.value > 0);
  const [hover, setHover] = useState<string | null>(null);
  const active = slices.find((slice) => slice.key === hover) || null;
  const shown = active?.value ?? total;
  const shownPct = total > 0 ? Math.round((shown / total) * 100) : 0;
  const radius = 70;
  const gap = slices.length > 1 ? 0.012 : 0;
  let cursor = 0;
  const arcs = slices.map((slice) => {
    const share = total > 0 ? slice.value / total : 0;
    const start = cursor + gap;
    const end = cursor + share - gap;
    cursor += share;
    const a0 = start * Math.PI * 2 - Math.PI / 2;
    const a1 = end * Math.PI * 2 - Math.PI / 2;
    const large = end - start > 0.5 ? 1 : 0;
    const x0 = 100 + radius * Math.cos(a0);
    const y0 = 100 + radius * Math.sin(a0);
    const x1 = 100 + radius * Math.cos(a1);
    const y1 = 100 + radius * Math.sin(a1);
    const path = share >= 0.999
      ? ""
      : `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
    return { ...slice, path, share };
  });

  return (
    <div>
      <div className="relative mx-auto h-56 w-56">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          {arcs.map((slice) => (
            slice.share >= 0.999 ? (
              <circle
                key={slice.key}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={slice.key === "member" ? "currentColor" : slice.color}
                strokeWidth={hover === slice.key ? 28 : 22}
                className={`cursor-pointer ${slice.key === "member" ? "text-neutral-950 dark:text-white" : ""}`}
                onMouseEnter={() => setHover(slice.key)}
                onMouseLeave={() => setHover(null)}
              />
            ) : (
              <path
                key={slice.key}
                d={slice.path}
                fill="none"
                stroke={slice.key === "member" ? "currentColor" : slice.color}
                strokeWidth={hover === slice.key ? 28 : 22}
                className={`cursor-pointer ${slice.key === "member" ? "text-neutral-950 dark:text-white" : ""}`}
                onMouseEnter={() => setHover(slice.key)}
                onMouseLeave={() => setHover(null)}
              />
            )
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">{shown}</p>
          <p className="mt-1 text-xs text-neutral-500">{active ? active.label : "bookings"}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          { key: "trial", label: "Trials", value: trial, swatch: "bg-[#E4F56C]" },
          { key: "member", label: "Members", value: member, swatch: "bg-neutral-950 dark:bg-white" },
        ].map((slice) => (
          <button
            key={slice.key}
            type="button"
            onMouseEnter={() => setHover(slice.key)}
            onMouseLeave={() => setHover(null)}
            className={`rounded-2xl px-3 py-2 text-left ${hover === slice.key ? "bg-neutral-100 dark:bg-white/10" : ""}`}
          >
            <span className="flex items-center gap-2 text-xs text-neutral-500">
              <span className={`h-2.5 w-2.5 rounded-full ${slice.swatch}`} />
              {slice.label}
            </span>
            <span className="mt-1 block text-lg font-semibold text-neutral-950 dark:text-white">{slice.value}</span>
          </button>
        ))}
      </div>
      <Detail
        eyebrow={active ? active.label : "All bookings"}
        value={`${shown} bookings`}
        caption={`${shownPct}% of this period. Move across a slice to read it here.`}
      />
    </div>
  );
}

export default function BookingReportCharts({
  yearSummary,
  displayTotals,
  periodLabel,
  reportScope,
  selectedMonth,
  classSessions,
  onMonthClick,
}: {
  yearSummary: YearMonthSummary[];
  displayTotals: BookingTotals;
  periodLabel: string;
  reportScope: "month" | "year";
  selectedMonth: number;
  classSessions: ClassSession[];
  onMonthClick?: (month: number) => void;
}) {
  const [bookingHover, setBookingHover] = useState<number | null>(null);
  const [classHover, setClassHover] = useState<number | null>(null);
  const bookingMax = axisMax(Math.max(1, ...yearSummary.map((row) => Math.max(row.trialBookings, row.memberBookings))));
  const classMax = axisMax(Math.max(1, ...yearSummary.map((row) => Math.max(row.totalClasses, row.classesWithBookings))));
  const bookingItems = yearSummary.map((row) => ({
    key: String(row.month),
    label: shortMonth(row.monthName),
    lime: row.trialBookings,
    ink: row.memberBookings,
    month: row.month,
    monthName: row.monthName,
  }));
  const classItems = yearSummary.map((row) => ({
    key: `class-${row.month}`,
    label: shortMonth(row.monthName),
    lime: row.classesWithBookings,
    ink: row.totalClasses,
    month: row.month,
    monthName: row.monthName,
    totalClasses: row.totalClasses,
    classesWithBookings: row.classesWithBookings,
  }));
  const selectedBooking = bookingItems.findIndex((item) => reportScope === "month" && item.month === selectedMonth);
  const bookingActive = bookingItems[bookingHover ?? (selectedBooking >= 0 ? selectedBooking : 0)];
  const classActive = classItems[classHover ?? (selectedBooking >= 0 ? selectedBooking : 0)];
  const bookedSessions = classSessions
    .filter((session) => session.hasBookings)
    .sort((a, b) => b.totalBookings - a.totalBookings)
    .slice(0, 8);
  const topMax = Math.max(1, ...bookedSessions.map((session) => session.totalBookings));
  const classFill = classActive && classActive.totalClasses > 0
    ? Math.round((classActive.classesWithBookings / classActive.totalClasses) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Bookings by month</h2>
              <p className="mt-1 text-sm text-neutral-500">Lime is trials, black is members. Click a month to open it.</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#E4F56C]" /> Trials</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-white" /> Members</span>
            </div>
          </div>
          <div className="mt-6">
            <GroupedColumns
              items={bookingItems}
              yMax={bookingMax}
              barClass="w-5 sm:w-6"
              selectedIndex={selectedBooking}
              hoverIndex={bookingHover}
              onHover={setBookingHover}
              onPick={(index) => {
                const month = bookingItems[index]?.month;
                if (month) onMonthClick?.(month);
              }}
            />
          </div>
          {bookingActive && (
            <Detail
              eyebrow={bookingActive.monthName}
              value={`${bookingActive.lime + bookingActive.ink} bookings`}
              caption={`${bookingActive.ink} members · ${bookingActive.lime} trials`}
            />
          )}
        </section>

        <section className={card}>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Booking mix</h2>
          <p className="mt-1 text-sm text-neutral-500">{periodLabel}</p>
          {displayTotals.totalBookings > 0 ? (
            <div className="mt-4">
              <MixDonut member={displayTotals.memberBookings} trial={displayTotals.trialBookings} />
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-neutral-500">No bookings in this period.</p>
          )}
        </section>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Scheduled against booked</h2>
            <p className="mt-1 text-sm text-neutral-500">Black is classes on the calendar. Lime is classes that got at least one booking.</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-white" /> Scheduled</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#E4F56C]" /> With a booking</span>
          </div>
        </div>
        <div className="mt-6">
          <GroupedColumns
            items={classItems}
            yMax={classMax}
            barClass="w-5 sm:w-6"
            inkFirst
            selectedIndex={selectedBooking}
            hoverIndex={classHover}
            onHover={setClassHover}
            onPick={(index) => {
              const month = classItems[index]?.month;
              if (month) onMonthClick?.(month);
            }}
          />
        </div>
        {classActive && (
          <Detail
            eyebrow={classActive.monthName}
            value={`${classActive.classesWithBookings} of ${classActive.totalClasses} classes booked`}
            caption={classActive.totalClasses > 0 ? `${classFill}% of scheduled classes had a booking.` : "Nothing was scheduled."}
          />
        )}
      </section>

      {reportScope === "month" && bookedSessions.length > 0 && (
        <section className={card}>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Busiest classes in {periodLabel}</h2>
          <p className="mt-1 text-sm text-neutral-500">Black is members, lime is trials. The number is the booking count.</p>
          <div className="mt-5 space-y-4">
            {bookedSessions.map((session) => {
              const memberWidth = (session.memberBookings / topMax) * 100;
              const trialWidth = (session.trialBookings / topMax) * 100;
              return (
                <div key={session.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{classLabel(session)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{session.dateLabel} · {session.timeLabel} · {session.instructor}</p>
                    </div>
                    <p className="text-lg font-semibold leading-none text-neutral-950 dark:text-white">{session.totalBookings}</p>
                  </div>
                  <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                    <span className="bg-neutral-950 dark:bg-white" style={{ width: `${memberWidth}%` }} />
                    <span className="bg-[#E4F56C]" style={{ width: `${trialWidth}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">{session.memberBookings} members · {session.trialBookings} trials</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
