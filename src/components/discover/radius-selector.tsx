"use client";

import { motion } from "motion/react";
import { RADIUS_OPTIONS_KM, type RadiusKm } from "@/lib/geo";
import { cn } from "@/lib/utils";

/** Segmented radius picker with a sliding highlight. Arrow keys move between options. */
export function RadiusSelector({ value, onChange }: { value: RadiusKm; onChange: (r: RadiusKm) => void }) {
  const idx = RADIUS_OPTIONS_KM.indexOf(value);
  return (
    <div
      role="radiogroup"
      aria-label="Search radius"
      className="no-scrollbar -mx-1 flex overflow-x-auto px-1"
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = RADIUS_OPTIONS_KM[Math.min(RADIUS_OPTIONS_KM.length - 1, Math.max(0, idx + (e.key === "ArrowRight" ? 1 : -1)))];
        onChange(next);
        requestAnimationFrame(() => (e.currentTarget.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
      }}
    >
      <div className="relative flex w-full gap-1 rounded-2xl border border-border bg-surface-2/80 p-1 sm:inline-flex sm:w-auto">
        {RADIUS_OPTIONS_KM.map((r) => {
          const active = r === value;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(r)}
              className={cn(
                "relative flex-1 rounded-xl px-1.5 py-2 text-[0.8125rem] font-semibold whitespace-nowrap tabular-nums transition-colors sm:flex-none sm:px-4 sm:text-sm",
                active ? "text-white" : "text-ink-muted hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  layoutId="radius-pill"
                  className="absolute inset-0 rounded-xl bg-sunset shadow-[0_6px_16px_-6px_rgb(240_83_44/0.7)]"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative">
                {r}
                <span className={cn("ml-0.5 text-[0.6875rem] font-medium sm:text-xs", active ? "text-white/80" : "text-ink-subtle")}>km</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
