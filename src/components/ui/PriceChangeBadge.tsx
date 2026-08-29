import { cn } from "@/lib/cn";

export interface PriceChangeBadgeProps {
  trend: "down" | "up";
  /** Absolute magnitude, e.g. 12 for "12% cheaper" — sign comes from `trend`. */
  percent: number;
  className?: string;
}

/**
 * Bold arrow+percent pill shown right next to a price — always paired with
 * it, never alone. Uses a solid ▼/▲ glyph (not a thin outline icon) so it
 * reads with the same visual weight as the bold price it sits next to.
 */
export function PriceChangeBadge({ trend, percent, className }: PriceChangeBadgeProps) {
  const isDrop = trend === "down";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control px-1.5 py-0.5 text-small font-bold tabular-nums",
        isDrop ? "bg-price-down-bg text-price-down" : "bg-price-up-bg text-price-up",
        className,
      )}
    >
      <span aria-hidden className="text-[0.7em]">
        {isDrop ? "▼" : "▲"}
      </span>
      {percent}%
    </span>
  );
}
