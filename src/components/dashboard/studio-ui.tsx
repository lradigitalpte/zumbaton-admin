import React from "react";

export function formatPercent(value: number) {
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 10) / 10;
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${value < 0 ? "−" : ""}${body}%`;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PercentRing({
  value,
  tone = "default",
}: {
  value: number;
  tone?: "default" | "lime" | "light";
}) {
  const pct = Math.max(0, Math.min(100, Math.abs(value)));
  const r = 7;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const color =
    tone === "lime" ? "text-neutral-950" : tone === "light" ? "text-white" : "text-neutral-900 dark:text-white";

  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${color}`}>
      <span>{formatPercent(value)}</span>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.6" />
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 9 9)"
        />
      </svg>
    </span>
  );
}

export function Capsules({
  value,
  tone = "default",
}: {
  value: number;
  tone?: "default" | "lime" | "light";
}) {
  const count = 7;
  const filled = Math.round((Math.max(0, Math.min(100, Math.abs(value))) / 100) * count);
  const filledClass =
    tone === "light" ? "bg-white" : tone === "lime" ? "bg-neutral-950" : "bg-neutral-950 dark:bg-white";
  const emptyClass =
    tone === "light"
      ? "border border-dashed border-white/35"
      : tone === "lime"
        ? "border border-dashed border-neutral-950/35"
        : "border border-dashed border-neutral-300 dark:border-white/25";

  return (
    <div className="mt-5 flex gap-1.5" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`h-7 w-[16px] rounded-full ${i < filled ? filledClass : emptyClass}`}
        />
      ))}
    </div>
  );
}

export function StudioCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}
