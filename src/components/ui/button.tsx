import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "danger-soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,box-shadow,transform,opacity] duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_6px_18px_-8px_rgb(240_83_44/0.7)] hover:bg-primary-hover hover:shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_10px_26px_-8px_rgb(240_83_44/0.8)]",
  secondary: "bg-surface text-ink border border-border shadow-soft hover:bg-surface-2 hover:border-border-strong",
  soft: "bg-primary-soft text-primary-ink hover:brightness-[0.97] dark:hover:brightness-125",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
  "danger-soft": "bg-danger-soft text-danger hover:brightness-[0.97] dark:hover:brightness-125",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-xl px-3.5 text-sm",
  md: "h-11 rounded-2xl px-5 text-[0.9375rem]",
  lg: "h-13 rounded-2xl px-7 text-base",
  icon: "size-11 rounded-2xl",
  "icon-sm": "size-9 rounded-xl",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner className="size-4.5" />
        </span>
      )}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
    </button>
  );
});
