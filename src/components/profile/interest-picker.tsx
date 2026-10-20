"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { INTEREST_SUGGESTIONS, MAX_INTERESTS } from "@/shared/constants";

export function InterestPicker({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [custom, setCustom] = useState("");
  const has = (i: string) => value.some((v) => v.toLowerCase() === i.toLowerCase());
  const full = value.length >= MAX_INTERESTS;

  const toggle = (i: string) => {
    if (has(i)) onChange(value.filter((v) => v.toLowerCase() !== i.toLowerCase()));
    else if (!full) onChange([...value, i]);
  };

  const addCustom = () => {
    const v = custom.trim().replace(/\s+/g, " ");
    if (v.length < 2 || v.length > 24 || has(v) || full) return;
    onChange([...value, v]);
    setCustom("");
  };

  const extras = value.filter((v) => !INTEREST_SUGGESTIONS.some((s) => s.toLowerCase() === v.toLowerCase()));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-ink" id="interests-label">
          Interests
        </p>
        <span className={cn("text-xs tabular-nums", full ? "font-semibold text-primary-ink" : "text-ink-subtle")}>
          {value.length}/{MAX_INTERESTS}
        </span>
      </div>
      <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Pick a few — shared interests are highlighted for people you meet.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="interests-label">
        {[...extras, ...INTEREST_SUGGESTIONS].map((i) => {
          const on = has(i);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(i)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition active:scale-95 disabled:opacity-40",
                on
                  ? "border-transparent bg-primary text-white shadow-[0_4px_12px_-6px_rgb(240_83_44/0.7)]"
                  : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
              )}
            >
              {i}
              {on && <X className="size-3.5" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          disabled={full}
          maxLength={24}
          placeholder={full ? "That's the maximum" : "Add your own…"}
          aria-label="Add a custom interest"
          className="h-10 flex-1 rounded-xl border border-border bg-surface px-3.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-[var(--ring)]/20 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={full || custom.trim().length < 2}
          className="inline-flex h-10 items-center gap-1 rounded-xl bg-surface-2 px-3.5 text-sm font-semibold text-ink transition hover:bg-surface-3 disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Add
        </button>
      </div>
      {error && <p className="mt-2 text-[0.8125rem] font-medium text-danger">{error}</p>}
    </div>
  );
}
