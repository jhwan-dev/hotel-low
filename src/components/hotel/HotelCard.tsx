import Image from "next/image";
import Link from "next/link";
import { ClockIcon, StarIcon } from "@/components/icons";
import { Card, CardBody, CardFooter, CardMedia, LinkButton } from "@/components/ui";
import { formatRelativeDays } from "@/lib/date";
import { formatPrice, formatRating } from "@/lib/format";
import { shrinkHotelImage } from "@/lib/hotels/imageUrl";
import { stayQueryToSearchParams, type StayQuery } from "@/lib/search/stay-query";
import type { HotelSearchResult } from "@/types/hotel";

export interface HotelCardProps {
  result: HotelSearchResult;
  /** This search's full conditions — carried into the detail link so it doesn't have to ask again. */
  stay: StayQuery;
}

export function HotelCard({ result, stay }: HotelCardProps) {
  const { hotel, price } = result;
  const detailHref = `/hotels/${hotel.id}?${stayQueryToSearchParams(stay).toString()}`;

  return (
    <Card className="overflow-hidden">
      <Link href={detailHref} className="contents">
        <CardMedia>
          <Image
            src={shrinkHotelImage(hotel.images[0], 600)}
            alt={hotel.name}
            fill
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-caption font-semibold text-ink">
            <StarIcon width={14} height={14} className="text-primary-light-2" />
            {formatRating(hotel.rating)}
          </span>
        </CardMedia>
        <CardBody>
          <h3 className="text-h3 text-ink">{hotel.name}</h3>
          <p className="text-small text-ink-muted">
            {hotel.location.city}, {hotel.location.country}
          </p>
          {price ? (
            <>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-price-md tabular-nums text-ink">
                  {formatPrice(price.nightlyPrice, price.currency)}
                </span>
                <span className="text-small text-ink-muted">/ 1박</span>
              </div>
              <p className="text-small text-ink-muted tabular-nums">
                {formatPrice(price.totalPrice, price.currency)} / {price.nights}박
              </p>
              {price.checkedAt && (
                <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                  <ClockIcon width={12} height={12} />
                  {formatRelativeDays(price.checkedAt)} · 쿠폰 등으로 실제가는 더 낮을 수 있어요
                </span>
              )}
            </>
          ) : (
            <p className="pt-1 text-small text-ink-muted">가격 확인 전</p>
          )}
        </CardBody>
      </Link>
      <CardFooter>
        <span className="text-caption text-ink-muted">
          {hotel.amenities[0]}
        </span>
        {/* Same tracking flow as the hotel detail page, not a separate one
            — `startTracking=1` auto-opens PriceTrackingCta's sheet there
            (see hotels/[id]/page.tsx's autoOpenTrackingSheet), so this card
            never needs its own copy of the login/price/settings logic. */}
        <LinkButton href={`${detailHref}&startTracking=1`} size="sm">
          가격 추적
        </LinkButton>
      </CardFooter>
    </Card>
  );
}
