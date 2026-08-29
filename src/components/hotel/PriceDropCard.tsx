import { PriceChangeBadge } from "@/components/ui";
import type { PriceDrop } from "@/lib/hotels/recent-drops";
import { HotelDealCard } from "./HotelDealCard";

export function PriceDropCard({ result, percentDrop, isRecordLow }: PriceDrop) {
  return (
    <HotelDealCard
      hotel={result.hotel}
      price={result.price}
      ribbon={isRecordLow ? { label: "최저가", tone: "down" } : undefined}
      trailing={<PriceChangeBadge trend="down" percent={percentDrop} />}
    />
  );
}
