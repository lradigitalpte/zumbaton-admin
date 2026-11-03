"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export interface StudioMenuOption {
  value: string;
  label: string;
  hint?: string;
}

export default function StudioMenu({
  id,
  value,
  onChange,
  placeholder,
  options,
  disabled = false,
  size = "md",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: StudioMenuOption[];
  disabled?: boolean;
  size?: "md" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const node = buttonRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const openUp = below < 180 && above > below;
      const maxHeight = Math.max(140, Math.min(280, openUp ? above : below));
      const width = Math.max(rect.width, 180);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setBox({
        top: openUp ? Math.max(8, rect.top - 8 - maxHeight) : rect.bottom + 8,
        left,
        width,
        maxHeight,
      });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value);
  const compact = size === "sm";

  return (
    <div className={compact ? "relative" : "relative mt-1.5"}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 border bg-neutral-50 text-left dark:bg-white/5 ${
          compact ? "h-9 rounded-full px-3 text-xs" : "h-12 rounded-2xl px-4 text-sm"
        } ${open ? "border-neutral-950 dark:border-white" : "border-neutral-200 dark:border-white/10"} ${
          disabled ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        <span className={`truncate ${selected ? "font-medium text-neutral-950 dark:text-white" : "text-neutral-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed z-[100001] overflow-auto rounded-[22px] border border-neutral-200/80 bg-white p-1.5 shadow-[0_18px_50px_rgba(16,24,40,0.16)] dark:border-white/10 dark:bg-neutral-950"
            style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-neutral-500">Nothing to choose</div>
            ) : (
              options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full flex-col rounded-2xl px-3 py-2.5 text-left ${
                      active
                        ? "bg-[#E4F56C] text-neutral-950"
                        : "text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10"
                    }`}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    {option.hint ? (
                      <span className={`mt-0.5 text-xs ${active ? "text-neutral-950/70" : "text-neutral-500 dark:text-white/45"}`}>
                        {option.hint}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
