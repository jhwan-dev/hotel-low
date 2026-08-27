import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardBody, CardMedia } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { Hotel, RoomPrice } from "@/types/hotel";

export interface HotelDealCardProps {
  hotel: Hotel;
  price: RoomPrice;
  /** Corner tag for standout deals — used sparingly, not on every card (a Fallcent-style touch, kept subtle). */
  ribbon?: { label: string; tone: "down" | "urgent" };
  /** Rendered right next to the price, e.g. "▼12%" or "3개 남음". */
  trailing: ReactNode;
}

const ribbonTone = {
  down: "bg-price-down text-white",
  urgent: "bg-price-up text-white",
};

/** Shared shape for every home-screen deal card (price drops, low availability, …) so they read as one system. */
export function HotelDealCard({ hotel, price, ribbon, trailing }: HotelDealCardProps) {
  return (
    <Link href={`/hotels/${hotel.id}?checkIn=${price.checkIn}&checkOut=${price.checkOut}`}>
      <Card className="overflow-hidden">
        <CardMedia className="aspect-square">
          <Image
            src={hotel.images[0]}
            alt={hotel.name}
            fill
            sizes="(min-width: 640px) 25vw, 50vw"
            className="object-cover"
          />
          {ribbon && (
            <span
              className={cn(
                "absolute left-0 top-3 rounded-r-full py-1 pl-3 pr-2.5 text-caption font-bold",
                ribbonTone[ribbon.tone],
              )}
            >
              {ribbon.label}
            </span>
          )}
        </CardMedia>
        <CardBody className="gap-0.5 p-3">
          <h3 className="truncate text-small font-semibold text-ink">{hotel.name}</h3>
          <div className="flex items-baseline gap-1.5">
            <span className="text-price-sm tabular-nums text-ink">
              {formatPrice(price.nightlyPrice, price.currency)}
            </span>
            {trailing}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
