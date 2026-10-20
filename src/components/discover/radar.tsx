import { cn } from "@/lib/utils";

/** Decorative pulsing "nearby" radar used in location prompts and empty states. */
export function Radar({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative grid size-48 place-items-center", className)} aria-hidden>
      <span className="absolute inset-0 rounded-full border border-primary/15 bg-primary/[0.03]" />
      <span className="absolute inset-[16%] rounded-full border border-primary/20" />
      <span className="absolute inset-[32%] rounded-full border border-primary/25" />
      <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar" />
      <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-radar [animation-delay:1.2s]" />
      <span className="absolute inset-0 rounded-full border-2 border-primary/20 animate-radar [animation-delay:2.4s]" />
      {children ?? (
        <span className="relative grid size-14 place-items-center rounded-full bg-sunset shadow-[0_10px_30px_-8px_rgb(240_83_44/0.7)]">
          <span className="size-3.5 rounded-full bg-white" />
        </span>
      )}
    </div>
  );
}
