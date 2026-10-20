"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
}

/** Small accessible popover menu (button + role="menu", arrow-key navigation, Escape/outside to close). */
export function Menu({
  trigger,
  items,
  align = "end",
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => React.ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const els = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const idx = els.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") {
        // Capture phase + stop: close just the menu, not a surrounding modal.
        e.stopPropagation();
        setOpen(false);
        (wrap.current?.querySelector("[aria-haspopup]") as HTMLElement | null)?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        els[(idx + 1) % els.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        els[(idx - 1 + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={list}
            id={id}
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className={cn(
              "absolute top-full z-40 mt-2 min-w-52 origin-top-right overflow-hidden rounded-2xl border border-border bg-bg-elevated p-1.5 shadow-lift",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition outline-none",
                  item.tone === "danger"
                    ? "text-danger hover:bg-danger-soft focus:bg-danger-soft"
                    : "text-ink hover:bg-surface-2 focus:bg-surface-2",
                )}
              >
                {item.icon && <span className="size-4.5 shrink-0 [&>svg]:size-4.5">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
