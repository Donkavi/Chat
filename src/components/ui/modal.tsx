"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Open modals, innermost last. Only the top one reacts to Escape/Tab. */
const modalStack: symbol[] = [];

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Visually hide the title (still announced to screen readers). */
  hideTitle?: boolean;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Content rendered edge-to-edge (e.g. a hero photo); the close button floats over it. */
  bare?: boolean;
}

/**
 * Accessible dialog: bottom sheet on phones, centred card on larger screens.
 * Traps focus, closes on Escape/backdrop, restores focus and locks page scroll.
 */
export function Modal({ open, onClose, title, description, hideTitle, children, className, size = "md", bare }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const token = Symbol("modal");
    modalStack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
      first?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      modalStack.splice(modalStack.indexOf(token), 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[rgb(20_12_24/0.45)] backdrop-blur-[6px] dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={cn(
              "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-bg-elevated shadow-lift outline-none sm:rounded-[1.75rem]",
              size === "sm" && "sm:max-w-md",
              size === "md" && "sm:max-w-lg",
              size === "lg" && "sm:max-w-2xl",
              className,
            )}
            initial={{ opacity: 0, y: 48, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.9 }}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "absolute top-3.5 right-3.5 z-20 grid size-9 place-items-center rounded-full transition",
                bare ? "bg-black/35 text-white backdrop-blur-md hover:bg-black/50" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <X className="size-4.5" />
            </button>
            {title && (
              <div className={cn("px-6 pt-5 pr-14 sm:pt-6", hideTitle && "sr-only")}>
                <h2 id={titleId} className="font-display text-xl font-semibold tracking-tight text-ink">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {description}
                  </p>
                )}
              </div>
            )}
            <div className={cn("scrollbar-thin flex-1 overflow-y-auto pb-safe", !bare && "px-6 pt-4 pb-6")}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
