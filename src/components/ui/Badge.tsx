import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "default"
  | "primary"
  | "priceDown"
  | "priceUp"
  | "neutral"
  | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-muted text-ink",
  primary: "bg-primary-light text-primary",
  priceDown: "bg-price-down-bg text-price-down",
  priceUp: "bg-price-up-bg text-price-up",
  neutral: "bg-price-neutral-bg text-price-neutral",
  outline: "border border-border text-ink bg-transparent",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-caption font-semibold",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
