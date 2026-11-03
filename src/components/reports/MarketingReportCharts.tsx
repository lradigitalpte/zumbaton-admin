"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import type { CombinedAgeGroup, MonthlyAudienceTrend } from "@/hooks/useReports";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
const PIE_COLORS = ["#E4F56C", "#171717", "#a3a3a3", "#525252", "#d5e45c"];

const card = "rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-6";

function axisMax(n: number) {
  if (n <= 0) return 4;
  const padded = n * 1.18;
  const pow = Math.pow(10, Math.floor(Math.log10(padded)));
  const normal = padded / pow;
  const nice = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10;
  return nice * pow;
}

function GroupedColumns({
  items,
  yMax,
  selectedIndex,
  onPick,
  renderTip,
  label,
  barClass = "w-8",
}: {
  items: { key: string; label: string; lime: number; ink: number }[];
  yMax: number;
  selectedIndex?: number;
  onPick?: (index: number) => void;
  renderTip: (item: { key: string; label: string; lime: number; ink: number }, index: number) => string[];
  label: (item: { key: string; label: string; lime: number; ink: number }) => string;
  barClass?: string;
}) {
  const chartH = 280;
  return (
    <div className="overflow-x-auto pt-28 sm:overflow-visible sm:pt-0">
      <div className="flex min-w-[640px]">
        <div className="flex h-[280px] w-8 shrink-0 flex-col justify-between pr-2 text-right text-[11px] text-neutral-400">
          <span>{Math.round(yMax)}</span>
          <span>{Math.round(yMax / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex flex-1 justify-between gap-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[280px]">
            <div className="absolute inset-x-0 top-0 border-t border-neutral-200 dark:border-white/10" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200 dark:border-white/10" />
            <div className="absolute inset-x-0 bottom-0 border-t border-neutral-200 dark:border-white/10" />
          </div>
          {items.map((item, index) => {
            const limeH = item.lime > 0 ? Math.max(14, (item.lime / yMax) * chartH) : 0;
            const inkH = item.ink > 0 ? Math.max(14, (item.ink / yMax) * chartH) : 0;
            const selected = selectedIndex === index;
            const tip = renderTip(item, index);
            const tipSide = index === 0 ? "left-0" : index === items.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onPick?.(index)}
                className="group relative flex min-w-0 flex-1 flex-col items-center hover:z-30"
              >
                <span className={`pointer-events-none absolute bottom-full z-40 mb-3 w-56 rounded-2xl bg-neutral-950 px-4 py-3 text-left text-white opacity-0 shadow-[0_18px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/15 transition-opacity group-hover:opacity-100 ${tipSide}`}>
                  {tip.map((line, lineIndex) => (
                    <span key={line} className={`block ${lineIndex === 0 ? "text-[11px] font-medium uppercase tracking-[0.14em] text-[#E4F56C]" : lineIndex === 1 ? "mt-1 text-lg font-semibold leading-none" : "mt-1 text-xs leading-4 text-white/80"}`}>{line}</span>
                  ))}
                </span>
                <span className="flex h-[280px] w-full items-end justify-center gap-1.5">
                  {item.lime <= 0 && item.ink <= 0 ? (
                    <span className={`h-[42%] rounded-[18px] border-2 border-dashed border-neutral-300 dark:border-white/20 ${barClass}`} />
                  ) : (
                    <>
                      {item.lime > 0 && <span className={`rounded-[18px] bg-[#E4F56C] ${barClass} ${selected ? "ring-2 ring-neutral-950 ring-offset-2 dark:ring-offset-gray-800" : ""}`} style={{ height: limeH }} />}
                      {item.ink > 0 && <span className={`rounded-[18px] bg-neutral-950 dark:bg-white ${barClass} ${selected ? "ring-2 ring-[#E4F56C] ring-offset-2 dark:ring-offset-gray-800" : ""}`} style={{ height: inkH }} />}
                    </>
                  )}
                </span>
                <span className={`mt-3 max-w-[5.5rem] text-center text-[11px] font-medium leading-4 ${selected ? "text-neutral-950 dark:text-white" : "text-neutral-500"}`}>{label(item)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgePie({
  title,
  subtitle,
  groups,
  field,
}: {
  title: string;
  subtitle: string;
  groups: CombinedAgeGroup[];
  field: "trial" | "members";
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const slices = groups.filter((group) => group[field] > 0);
  const total = slices.reduce((sum, group) => sum + group[field], 0);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover != null ? slices[hover] : null;
  const activeValue = active ? active[field] : total;
  const activePct = total > 0 ? Math.round((activeValue / total) * 100) : 0;
  const chartText = isDark ? "rgba(255,255,255,0.7)" : "#525252";
  return (
    <section className={`${card} overflow-visible`}>
      <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
      {slices.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-500">No ages in this period.</p>
      ) : (
        <>
          <Chart
            type="donut"
            height={280}
            series={slices.map((group) => group[field])}
            options={{
              labels: slices.map((group) => group.shortLabel || group.label),
              colors: PIE_COLORS,
              chart: {
                background: "transparent",
                fontFamily: "Outfit, sans-serif",
                events: {
                  dataPointMouseEnter: (_event, _chart, config) => setHover(config.dataPointIndex),
                  dataPointMouseLeave: () => setHover(null),
                },
              },
              stroke: { colors: [isDark ? "#232323" : "#ffffff"], width: 3 },
              legend: {
                position: "bottom",
                fontSize: "13px",
                labels: { colors: chartText },
                formatter: (name, opts) => {
                  const value = opts.w.globals.series[opts.seriesIndex] as number;
                  const share = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${name} · ${value} · ${share}%`;
                },
              },
              dataLabels: { enabled: false },
              tooltip: { enabled: false },
              plotOptions: {
                pie: {
                  donut: { size: "64%" },
                  expandOnClick: false,
                },
              },
            }}
          />
          <div className="rounded-2xl bg-neutral-950 px-4 py-3 text-white">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E4F56C]">{active ? (active.shortLabel || active.label) : "All ages"}</p>
            <p className="mt-1 text-2xl font-semibold leading-none">{activeValue} people</p>
            <p className="mt-1 text-sm text-white/75">{activePct}% of this mix. Move across a slice to read it here.</p>
          </div>
        </>
      )}
    </section>
  );
}

export default function MarketingReportCharts({
  combinedAgeGroups,
  monthlyTrend,
  selectedMonth,
  onMonthClick,
}: {
  combinedAgeGroups: CombinedAgeGroup[];
  monthlyTrend: MonthlyAudienceTrend[];
  selectedMonth: number | "all";
  onMonthClick?: (month: number) => void;
}) {
  const ageMax = axisMax(Math.max(1, ...combinedAgeGroups.map((row) => Math.max(row.trial, row.members))));
  const trendMax = axisMax(Math.max(1, ...monthlyTrend.map((row) => Math.max(row.trialBookings, row.newMembers))));
  const ageItems = combinedAgeGroups.map((row) => ({
    key: row.key,
    label: row.shortLabel || row.label,
    lime: row.trial,
    ink: row.members,
    trialPct: row.trialPct,
    membersPct: row.membersPct,
  }));
  const trendItems = monthlyTrend.map((row) => ({
    key: `${row.month}-${row.year}`,
    label: row.month,
    lime: row.trialBookings,
    ink: row.newMembers,
    monthNumber: row.monthNumber,
    year: row.year,
  }));

  return (
    <div className="space-y-5">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Age comparison</h2>
            <p className="mt-2 text-sm text-neutral-500">People with a date of birth, in the same age bands.</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#E4F56C]" /> Trials</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-white" /> Members</span>
          </div>
        </div>
        <div className="mt-6">
          <GroupedColumns
            items={ageItems}
            yMax={ageMax}
            barClass="w-12"
            renderTip={(item) => {
              const row = ageItems.find((entry) => entry.key === item.key);
              return [
                item.label,
                `${item.lime + item.ink} people`,
                `${item.lime} trials · ${row?.trialPct ?? 0}%`,
                `${item.ink} members · ${row?.membersPct ?? 0}%`,
              ];
            }}
            label={(item) => item.label}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <AgePie title="Trial age mix" subtitle="Share of trial guests who gave a date of birth." groups={combinedAgeGroups} field="trial" />
        <AgePie title="Member age mix" subtitle="Share of members who joined with a date of birth." groups={combinedAgeGroups} field="members" />
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Signups through the year</h2>
            <p className="mt-2 text-sm text-neutral-500">Click a month to focus the numbers above. Click it again for the full year.</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#E4F56C]" /> Trial bookings</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-white" /> New members</span>
          </div>
        </div>
        <div className="mt-6">
          <GroupedColumns
            items={trendItems}
            yMax={trendMax}
            barClass="w-8"
            selectedIndex={trendItems.findIndex((item) => item.monthNumber === selectedMonth)}
            onPick={(index) => {
              const month = trendItems[index]?.monthNumber;
              if (month) onMonthClick?.(month);
            }}
            renderTip={(item, index) => {
              const row = trendItems[index];
              return [
                `${item.label} ${row?.year ?? ""}`.trim(),
                `${item.lime + item.ink} people`,
                `${item.lime} trial bookings`,
                `${item.ink} new members`,
              ];
            }}
            label={(item) => item.label}
          />
        </div>
      </section>
    </div>
  );
}
