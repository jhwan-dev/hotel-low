import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type PriceTrend = "down" | "up" | "neutral";

export interface PriceChangeIndicatorProps {
  trend: PriceTrend;
  label: string;
  className?: string;
}

const trendStyles: Record<PriceTrend, string> = {
  down: "text-price-down",
  up: "text-price-up",
  neutral: "text-price-neutral",
};

export function PriceChangeIndicator({
  trend,
  label,
  className,
}: PriceChangeIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-price-sm tabular-nums",
        trendStyles[trend],
        className,
      )}
    >
      {trend === "down" && <ArrowDownIcon width={16} height={16} />}
      {trend === "up" && <ArrowUpIcon width={16} height={16} />}
      {label}
    </span>
  );
}
