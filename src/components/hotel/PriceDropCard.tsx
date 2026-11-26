import { PriceChangeBadge } from "@/components/ui";
import type { PriceDrop } from "@/lib/hotels/recent-drops";
import { stayQueryToSearchParams } from "@/lib/search/stay-query";
import { HotelDealCard } from "./HotelDealCard";

export function PriceDropCard({ hotel, price, partySize, percentDrop, isRecordLow }: PriceDrop) {
  // Not the viewer's own search — this card's price was quoted for a
  // specific real (checkIn, checkOut, partySize) combo someone else tracked,
  // so the detail link has to carry that exact query, not the page's default.
  const detailHref = `/hotels/${hotel.id}?${stayQueryToSearchParams({
    checkIn: price.checkIn,
    checkOut: price.checkOut,
    adults: partySize.adults,
    children: partySize.children,
    rooms: partySize.rooms,
    childrenAges: [],
  }).toString()}`;

  return (
    <HotelDealCard
      hotel={hotel}
      price={price}
      detailHref={detailHref}
      ribbon={isRecordLow ? { label: "최저가", tone: "down" } : undefined}
      trailing={<PriceChangeBadge trend="down" percent={percentDrop} />}
    />
  );
}
