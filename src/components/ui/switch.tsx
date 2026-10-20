"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
}

/** Accessible toggle row (role="switch") with label and description. */
export function SwitchRow({ checked, onChange, disabled, label, description, icon }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-4 py-4">
      {icon && <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink-muted">{icon}</span>}
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block cursor-pointer text-[0.9375rem] font-semibold text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-primary" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "inline-block size-5.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-out",
            checked ? "translate-x-[1.375rem]" : "translate-x-[0.1875rem]",
          )}
        />
      </button>
    </div>
  );
}
