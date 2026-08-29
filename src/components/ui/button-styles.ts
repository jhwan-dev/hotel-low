import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "success" | "kakao";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-light disabled:text-primary-light-2",
  secondary:
    "bg-primary-light text-primary hover:bg-primary-light-2 disabled:opacity-50",
  outline:
    "border border-border bg-surface text-ink hover:bg-surface-muted disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-surface-muted disabled:opacity-50",
  /** Emphasized booking CTA when the price is down — same green as the price-drop tokens, so it reads as a continuation of that state. */
  success: "bg-price-down text-white hover:opacity-90 active:opacity-80 disabled:opacity-50",
  /** Kakao's mandated brand yellow + near-black text — required by Kakao's own button guidelines, not part of our token palette. */
  kakao: "bg-[#FEE500] text-[#191919] hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  /** Compact footer actions (e.g. a card's inline "설정"/"중지" pair) — not for primary touch targets. */
  xs: "h-7 px-2 text-caption",
  sm: "h-9 px-4 text-small",
  md: "h-12 px-5 text-body",
  lg: "h-14 px-6 text-h3",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  fullWidth?: boolean,
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}
