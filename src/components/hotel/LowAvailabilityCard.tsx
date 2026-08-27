import { ClockIcon } from "@/components/icons";
import type { LowAvailabilityDeal } from "@/lib/hotels/low-availability";
import { HotelDealCard } from "./HotelDealCard";

export function LowAvailabilityCard({ result, remainingRooms }: LowAvailabilityDeal) {
  return (
    <HotelDealCard
      hotel={result.hotel}
      price={result.price}
      ribbon={remainingRooms <= 2 ? { label: "마감임박", tone: "urgent" } : undefined}
      trailing={
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-small font-bold tabular-nums text-price-up">
          <ClockIcon width={12} height={12} />
          {remainingRooms}개
        </span>
      }
    />
  );
}
