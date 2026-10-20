import { cn } from "@/lib/utils";

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "violet" | "glass";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        tone === "neutral" && "bg-surface-2 text-ink-muted",
        tone === "primary" && "bg-primary-soft text-primary-ink",
        tone === "violet" && "bg-violet-soft text-violet",
        tone === "glass" && "bg-white/18 text-white backdrop-blur-md ring-1 ring-white/25",
        className,
      )}
    >
      {children}
    </span>
  );
}
