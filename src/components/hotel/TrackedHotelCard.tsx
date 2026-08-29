"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ClockIcon } from "@/components/icons";
import { Button, Card, CardBody, CardRibbon, PriceChangeBadge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRelativeDays, formatShortDate } from "@/lib/date";
import { formatPrice } from "@/lib/format";
import type { PriceStatus } from "@/lib/hotels/price-history";
import { stopTracking } from "@/lib/tracking/actions";
import type { Hotel, RoomPrice } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";

export interface TrackedHotelCardProps {
  hotel: Hotel;
  price: RoomPrice;
  settings: PriceTrackingSettings;
  previousTotalPrice: number | null;
  changePercent: number | null;
  status: PriceStatus | null;
  lastCheckedAt: string | null;
}

const statusStyles: Record<PriceStatus["trend"], string> = {
  down: "bg-price-down-bg text-price-down",
  up: "bg-price-up-bg text-price-up",
  neutral: "bg-price-neutral-bg text-price-neutral",
};

export function TrackedHotelCard({
  hotel,
  price,
  settings,
  previousTotalPrice,
  changePercent,
  status,
  lastCheckedAt,
}: TrackedHotelCardProps) {
  const [isPending, startTransition] = useTransition();
  const [stopped, setStopped] = useState(false);
  const detailHref = `/hotels/${hotel.id}?checkIn=${settings.checkIn}&checkOut=${settings.checkOut}`;
  const isDrop = changePercent !== null && changePercent < 0;

  function stop() {
    startTransition(async () => {
      const result = await stopTracking(hotel.id, settings.checkIn, settings.checkOut);
      if (!("error" in result)) setStopped(true);
    });
  }

  if (stopped) return null;

  return (
    <Card
      className={cn("flex overflow-hidden", isDrop && "border-l-4 border-l-price-down")}
    >
      <Link
        href={detailHref}
        className="relative w-28 shrink-0 overflow-hidden rounded-l-card sm:w-36"
      >
        <Image src={hotel.images[0]} alt={hotel.name} fill sizes="144px" className="object-cover" />
        <CardRibbon label="추적 중" tone="tracking" />
      </Link>
      <CardBody className="flex-1 gap-1.5 p-3">
        <Link href={detailHref}>
          <h3 className="truncate text-small font-semibold text-ink">{hotel.name}</h3>
        </Link>
        <p className="text-caption text-ink-muted">
          {formatShortDate(settings.checkIn)} - {formatShortDate(settings.checkOut)}
        </p>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-0.5">
          <span className="text-price-md tabular-nums text-ink">
            {formatPrice(price.totalPrice, price.currency)}
          </span>
          {changePercent !== null && changePercent !== 0 && (
            <PriceChangeBadge trend={isDrop ? "down" : "up"} percent={Math.abs(changePercent)} />
          )}
        </div>
        {previousTotalPrice !== null && changePercent !== null && changePercent !== 0 && (
          <p className={cn("text-caption font-semibold", isDrop ? "text-price-down" : "text-price-up")}>
            {formatPrice(Math.abs(previousTotalPrice - price.totalPrice), price.currency)}{" "}
            {isDrop ? "하락" : "상승"}
          </p>
        )}

        {status && (
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-control px-2 py-1 text-caption font-semibold",
              statusStyles[status.trend],
            )}
          >
            {status.message}
          </span>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {lastCheckedAt ? (
            <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
              <ClockIcon width={12} height={12} />
              {formatRelativeDays(lastCheckedAt)}
            </span>
          ) : (
            <span />
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={stop}
            className="h-7 px-2 text-caption"
          >
            추적 중지
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
