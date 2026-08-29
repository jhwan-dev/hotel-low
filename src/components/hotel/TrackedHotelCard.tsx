"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ClockIcon } from "@/components/icons";
import { Button, Card, CardBody, CardRibbon, PriceChangeBadge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRelativeDays, formatShortDate } from "@/lib/date";
import { formatPrice } from "@/lib/format";
import { priceStatusToneClasses, type PriceStatus } from "@/lib/hotels/price-history";
import { stayQueryToSearchParams } from "@/lib/search/stay-query";
import { startTracking, stopTracking } from "@/lib/tracking/actions";
import type { Hotel, RoomPrice } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";
import { PriceTrackingSheet } from "./PriceTrackingSheet";

export interface TrackedHotelCardProps {
  hotel: Hotel;
  price: RoomPrice;
  settings: PriceTrackingSettings;
  previousTotalPrice: number | null;
  changePercent: number | null;
  status: PriceStatus | null;
  lastCheckedAt: string | null;
}

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
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [sheetOpen, setSheetOpen] = useState(false);
  const detailHref = `/hotels/${hotel.id}?${stayQueryToSearchParams({
    checkIn: currentSettings.checkIn,
    checkOut: currentSettings.checkOut,
    adults: currentSettings.adults,
    children: currentSettings.children,
    rooms: currentSettings.rooms,
    childrenAges: [],
  }).toString()}`;
  const isDrop = changePercent !== null && changePercent < 0;

  function stop() {
    startTransition(async () => {
      const result = await stopTracking(hotel.id, currentSettings.checkIn, currentSettings.checkOut);
      if (!("error" in result)) setStopped(true);
    });
  }

  function submitSettings(
    values: Pick<PriceTrackingSettings, "targetPrice" | "notifyOnAnyDrop" | "notifyOnNewLow">,
  ) {
    startTransition(async () => {
      const result = await startTracking({
        hotelId: hotel.id,
        checkIn: currentSettings.checkIn,
        checkOut: currentSettings.checkOut,
        adults: currentSettings.adults,
        children: currentSettings.children,
        rooms: currentSettings.rooms,
        currency: currentSettings.currency,
        ...values,
      });
      if (!("error" in result)) {
        setCurrentSettings(result);
        setSheetOpen(false);
      }
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
          {formatShortDate(currentSettings.checkIn)} - {formatShortDate(currentSettings.checkOut)}
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
              priceStatusToneClasses[status.trend],
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              disabled={isPending}
              onClick={() => setSheetOpen(true)}
            >
              알림 설정
            </Button>
            <Button variant="ghost" size="xs" disabled={isPending} onClick={stop}>
              추적 중지
            </Button>
          </div>
        </div>
      </CardBody>

      <PriceTrackingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        hotelName={hotel.name}
        location={`${hotel.location.city}, ${hotel.location.country}`}
        checkIn={currentSettings.checkIn}
        checkOut={currentSettings.checkOut}
        nights={price.nights}
        currentPrice={price.totalPrice}
        currency={price.currency}
        initial={currentSettings}
        onSubmit={submitSettings}
        submitLabel="설정 저장"
      />
    </Card>
  );
}
