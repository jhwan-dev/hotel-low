import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardBody, CardMedia, CardRibbon, type CardRibbonTone } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import type { Hotel, RoomPrice } from "@/types/hotel";

export interface HotelDealCardProps {
  hotel: Hotel;
  price: RoomPrice;
  /** Corner tag for standout deals — used sparingly, not on every card (a Fallcent-style touch, kept subtle). */
  ribbon?: { label: string; tone: CardRibbonTone };
  /** Rendered right next to the price, e.g. "▼12%" or "3개 남음". */
  trailing: ReactNode;
  /** Second line under the price row, e.g. "40,400원 하락". */
  secondaryLine?: ReactNode;
  /** Overrides the default (hotel-only, no query) detail link — pass full stay params when this card reflects a real, confirmed condition (e.g. an active tracking). */
  detailHref?: string;
  /**
   * False for cards backed by a real, confirmed stay (e.g. an active
   * tracking) — suppresses the "~ · 1박 기준" hint. True (default) for
   * generic browse cards (price drops, low availability) whose price is
   * only for a placeholder date the user never chose, so it shouldn't read
   * as a firm quote.
   */
  approximate?: boolean;
}

/** Shared shape for every home-screen deal card (price drops, low availability, …) so they read as one system. */
export function HotelDealCard({
  hotel,
  price,
  ribbon,
  trailing,
  secondaryLine,
  detailHref,
  approximate = true,
}: HotelDealCardProps) {
  return (
    <Link href={detailHref ?? `/hotels/${hotel.id}`}>
      <Card className="overflow-hidden">
        <CardMedia className="aspect-square">
          <Image
            src={hotel.images[0]}
            alt={hotel.name}
            fill
            sizes="(min-width: 640px) 25vw, 50vw"
            className="object-cover"
          />
          {ribbon && <CardRibbon label={ribbon.label} tone={ribbon.tone} />}
        </CardMedia>
        <CardBody className="gap-0.5 p-3">
          <h3 className="truncate text-small font-semibold text-ink">{hotel.name}</h3>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-price-sm font-bold tabular-nums text-ink">
              {formatPrice(price.nightlyPrice, price.currency)}
              {approximate && "~"}
            </span>
            {trailing}
          </div>
          {secondaryLine}
          {approximate && <span className="text-caption text-ink-muted">1박 기준</span>}
        </CardBody>
      </Card>
    </Link>
  );
}
