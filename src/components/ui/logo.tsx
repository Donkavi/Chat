import { cn } from "@/lib/utils";

/** Lumos mark: a glowing point with two "nearby" rings. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="lumos-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9a4d" />
          <stop offset="0.5" stopColor="#f0532c" />
          <stop offset="1" stopColor="#e23e78" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#lumos-g)" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="6" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="2.6" fill="white" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && <span className="font-display text-xl font-bold tracking-tight text-ink">lumos</span>}
    </span>
  );
}
