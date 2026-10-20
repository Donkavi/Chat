"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { motion } from "motion/react";
import { SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";
import { MESSAGE_MAX_LENGTH } from "@/shared/constants";

export interface ComposerHandle {
  fill: (text: string) => void;
  focus: () => void;
}

const TYPING_REFRESH_MS = 3000;
const TYPING_IDLE_MS = 2500;

/** Auto-growing message input. Enter sends on keyboards; on touch devices Enter adds a newline. */
export const Composer = forwardRef<
  ComposerHandle,
  { onSend: (text: string) => void; onTyping: (typing: boolean) => void; placeholder: string; disabled?: boolean }
>(function Composer({ onSend, onTyping, placeholder, disabled }, ref) {
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const typingSentAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  useImperativeHandle(ref, () => ({
    fill: (t) => {
      setText(t);
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.setSelectionRange(t.length, t.length);
      });
    },
    focus: () => area.current?.focus(),
  }));

  // Grow with content up to ~6 lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const stopTyping = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (isTyping.current) {
      isTyping.current = false;
      typingSentAt.current = 0;
      onTyping(false);
    }
  };

  useEffect(() => () => stopTyping(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (value: string) => {
    setText(value);
    if (!value.trim()) return stopTyping();
    const now = Date.now();
    if (now - typingSentAt.current > TYPING_REFRESH_MS) {
      typingSentAt.current = now;
      isTyping.current = true;
      onTyping(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = () => {
    const value = text.trim();
    if (!value || disabled || value.length > MESSAGE_MAX_LENGTH) return;
    onSend(value);
    setText("");
    stopTyping();
    area.current?.focus();
  };

  const remaining = MESSAGE_MAX_LENGTH - text.length;
  const canSend = text.trim().length > 0 && remaining >= 0 && !disabled;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2"
    >
      <div className="relative flex-1">
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <textarea
          id="composer"
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={MESSAGE_MAX_LENGTH + 200}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={stopTyping}
          onKeyDown={(e) => {
            const coarse = window.matchMedia("(pointer: coarse)").matches;
            if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="scrollbar-thin block max-h-40 min-h-12 w-full resize-none rounded-[1.5rem] border border-border bg-surface px-4.5 py-3 text-[0.9375rem] leading-[1.45] text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary focus:ring-4 focus:ring-[var(--ring)]/20 disabled:opacity-60"
        />
        {remaining < 200 && (
          <span className={cn("absolute right-4 -top-5 text-[0.6875rem] tabular-nums", remaining < 0 ? "font-semibold text-danger" : "text-ink-subtle")}>
            {remaining}
          </span>
        )}
      </div>
      <motion.button
        type="submit"
        disabled={!canSend}
        whileTap={canSend ? { scale: 0.9 } : undefined}
        animate={{ scale: canSend ? 1 : 0.92, opacity: canSend ? 1 : 0.5 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full text-white transition-shadow",
          canSend ? "bg-sunset shadow-[0_8px_20px_-8px_rgb(240_83_44/0.8)]" : "bg-surface-3 text-ink-subtle",
        )}
        aria-label="Send message"
      >
        <SendHorizonal className="size-5 translate-x-[1px]" />
      </motion.button>
    </form>
  );
});
