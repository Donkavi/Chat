import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-sm flex-col items-center px-6 py-12 text-center", className)}>
      {icon && (
        <div className="relative mb-6 grid size-20 place-items-center">
          <span className="absolute inset-0 rounded-[1.75rem] bg-primary-soft rotate-6" />
          <span className="absolute inset-0 rounded-[1.75rem] bg-surface shadow-soft border border-border" />
          <span className="relative text-primary">{icon}</span>
        </div>
      )}
      <h3 className="font-display text-xl font-semibold tracking-tight text-ink text-balance">{title}</h3>
      {description && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted text-pretty">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
