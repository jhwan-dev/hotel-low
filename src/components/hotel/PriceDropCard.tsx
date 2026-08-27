import { ArrowDownIcon } from "@/components/icons";
import type { PriceDrop } from "@/lib/hotels/recent-drops";
import { HotelDealCard } from "./HotelDealCard";

export function PriceDropCard({ result, percentDrop, isRecordLow }: PriceDrop) {
  return (
    <HotelDealCard
      hotel={result.hotel}
      price={result.price}
      ribbon={isRecordLow ? { label: "최저가", tone: "down" } : undefined}
      trailing={
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-small font-bold tabular-nums text-price-down">
          <ArrowDownIcon width={12} height={12} />
          {percentDrop}%
        </span>
      }
    />
  );
}
