"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-2xl border bg-surface px-4 text-[0.9375rem] text-ink shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-[border-color,box-shadow,background-color] duration-150 outline-none placeholder:text-ink-subtle hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-[var(--ring)]/25 disabled:opacity-60";

interface FieldShellProps {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  id: string;
  children: React.ReactNode;
  trailingLabel?: React.ReactNode;
}

function FieldShell({ label, hint, error, id, children, trailingLabel }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      {(label || trailingLabel) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-sm font-semibold text-ink">
              {label}
            </label>
          )}
          {trailingLabel}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  trailingLabel?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, trailingLabel, className, id: idProp, type, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  return (
    <FieldShell label={label} hint={hint} error={error} id={id} trailingLabel={trailingLabel}>
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-subtle">{leading}</span>}
        <input
          ref={ref}
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            control,
            "h-12",
            error ? "border-danger focus:border-danger" : "border-border",
            leading && "pl-11",
            (trailing || isPassword) && "pr-12",
            className,
          )}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute inset-y-0 right-2 my-auto grid size-9 place-items-center rounded-xl text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        ) : (
          trailing && <span className="absolute inset-y-0 right-4 flex items-center">{trailing}</span>
        )}
      </div>
    </FieldShell>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  trailingLabel?: React.ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id: idProp, trailingLabel, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id} trailingLabel={trailingLabel}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(control, "min-h-28 resize-none py-3 leading-relaxed", error ? "border-danger" : "border-border", className)}
        {...props}
      />
    </FieldShell>
  );
});
