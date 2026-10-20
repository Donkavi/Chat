"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemePref = "system" | "light" | "dark";
const KEY = "langa-theme";
const EVENT = "langa-theme-change";

let memoryPref: ThemePref | null = null;

function readPref(): ThemePref {
  if (memoryPref) return memoryPref;
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
    mq.removeEventListener("change", cb);
  };
}

function setPref(p: ThemePref) {
  memoryPref = p;
  try {
    localStorage.setItem(KEY, p);
  } catch {
    // Storage may be unavailable (private mode); the choice still applies for this visit.
  }
  apply(p);
  window.dispatchEvent(new Event(EVENT));
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);
  // Follow OS changes while on "system".
  useEffect(() => subscribe(() => readPref() === "system" && apply("system")), []);
  return [pref, setPref] as const;
}

function useIsDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Segmented light / dark / system control. */
export function ThemeSegmented({ className }: { className?: string }) {
  const [pref] = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-2xl bg-surface-2 p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          onClick={() => setPref(value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition",
            pref === value ? "bg-surface text-ink shadow-soft" : "text-ink-muted hover:text-ink",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Compact icon button that flips between light and dark. */
export function ThemeIconToggle({ className }: { className?: string }) {
  useTheme();
  const isDark = useIsDark();
  return (
    <button
      type="button"
      onClick={() => setPref(isDark ? "light" : "dark")}
      className={cn("grid size-10 place-items-center rounded-2xl text-ink-muted transition hover:bg-surface-2 hover:text-ink", className)}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
