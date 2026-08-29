import { cn } from "@/lib/cn";

export type CardRibbonTone = "down" | "urgent" | "tracking";

export interface CardRibbonProps {
  label: string;
  tone: CardRibbonTone;
  className?: string;
}

const ribbonTone: Record<CardRibbonTone, string> = {
  down: "bg-price-down text-white",
  urgent: "bg-price-up text-white",
  tracking: "bg-primary text-white",
};

/** Corner sticker for a card's image — status like "최저가" / "마감임박" / "추적 중". */
export function CardRibbon({ label, tone, className }: CardRibbonProps) {
  return (
    <span
      className={cn(
        "absolute left-0 top-3 rounded-r-full py-1 pl-3 pr-2.5 text-caption font-bold",
        ribbonTone[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
