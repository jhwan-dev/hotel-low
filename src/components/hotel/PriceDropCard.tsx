import { PriceChangeBadge } from "@/components/ui";
import type { PriceDrop } from "@/lib/hotels/recent-drops";
import { HotelDealCard } from "./HotelDealCard";

export function PriceDropCard({ hotel, price, percentDrop, isRecordLow }: PriceDrop) {
  return (
    <HotelDealCard
      hotel={hotel}
      price={price}
      ribbon={isRecordLow ? { label: "최저가", tone: "down" } : undefined}
      trailing={<PriceChangeBadge trend="down" percent={percentDrop} />}
    />
  );
}
