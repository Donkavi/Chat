import { cn } from "@/lib/utils";

const SIZE = { sm: "size-2.5", md: "size-3.5", lg: "size-4.5" } as const;

/** Presence indicator. Pulses gently when online; hidden from screen readers (status is stated in text nearby). */
export function OnlineDot({
  online,
  size = "md",
  className,
  pulse = true,
}: {
  online: boolean;
  size?: keyof typeof SIZE;
  className?: string;
  pulse?: boolean;
}) {
  if (!online) return null;
  return (
    <span className={cn("relative inline-flex", SIZE[size], className)} aria-hidden>
      {pulse && <span className="absolute inset-0 rounded-full bg-online animate-pulse-ring" />}
      <span className="relative inline-flex size-full rounded-full border-2 border-surface bg-online" />
    </span>
  );
}

export function OnlineBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide text-white backdrop-blur-md",
        className,
      )}
    >
      <span className="relative inline-flex size-2">
        <span className="absolute inset-0 rounded-full bg-online animate-pulse-ring" />
        <span className="relative size-2 rounded-full bg-online" />
      </span>
      Online
    </span>
  );
}
