import Image from "next/image";
import Link from "next/link";
import { StarIcon } from "@/components/icons";
import { Card, CardBody, CardFooter, CardMedia } from "@/components/ui";
import { formatPrice, formatRating } from "@/lib/format";
import { stayQueryToSearchParams, type StayQuery } from "@/lib/search/stay-query";
import type { HotelSearchResult } from "@/types/hotel";
import { TrackHotelButton } from "./TrackHotelButton";

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
            src={hotel.images[0]}
            alt={hotel.name}
            fill
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
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-price-md tabular-nums text-ink">
              {formatPrice(price.nightlyPrice, price.currency)}
            </span>
            <span className="text-small text-ink-muted">/ 1박</span>
          </div>
          <p className="text-small text-ink-muted tabular-nums">
            {formatPrice(price.totalPrice, price.currency)} / {price.nights}박
          </p>
        </CardBody>
      </Link>
      <CardFooter>
        <span className="text-caption text-ink-muted">
          {hotel.amenities[0]}
        </span>
        <TrackHotelButton size="sm" />
      </CardFooter>
    </Card>
  );
}
