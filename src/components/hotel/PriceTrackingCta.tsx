"use client";

import { useState, useTransition } from "react";
import { BellIcon } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { startTracking, stopTracking } from "@/lib/tracking/actions";
import type { Currency } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";
import { PriceTrackingSheet } from "./PriceTrackingSheet";

export interface PriceTrackingCtaProps {
  hotelId: string;
  hotelName: string;
  location: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  currentPrice: number;
  currency: Currency;
  /** Fetched server-side so the CTA renders in the right state on first paint — no login-wall flash. */
  initialSettings: PriceTrackingSettings | null;
}

export function PriceTrackingCta({
  hotelId,
  hotelName,
  location,
  checkIn,
  checkOut,
  nights,
  currentPrice,
  currency,
  initialSettings,
}: PriceTrackingCtaProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settings, setSettings] = useState<PriceTrackingSettings | null>(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(values: Pick<PriceTrackingSettings, "targetPrice" | "notifyOnAnyDrop" | "notifyOnNewLow">) {
    setError(null);
    startTransition(async () => {
      const result = await startTracking({ hotelId, checkIn, checkOut, currency, ...values });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSettings(result);
      setSheetOpen(false);
    });
  }

  function stop() {
    setError(null);
    startTransition(async () => {
      const result = await stopTracking(hotelId, checkIn, checkOut);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSettings(null);
    });
  }

  return (
    <>
      {settings ? (
        <div className="flex flex-col gap-3 rounded-card border border-primary-light-2 bg-primary-light/40 p-4">
          <span className="flex items-center gap-1.5 text-small font-semibold text-primary">
            <BellIcon width={16} height={16} />
            가격 추적 중
          </span>
          <p className="text-body text-ink">
            <span className="font-semibold tabular-nums">
              {formatPrice(settings.targetPrice, currency)}
            </span>{" "}
            이하가 되면 알려드릴게요.
          </p>
          <div className="flex flex-wrap gap-2">
            {settings.notifyOnAnyDrop && <Badge variant="primary">가격 하락 시 알림</Badge>}
            {settings.notifyOnNewLow && <Badge variant="primary">최저가 갱신 시 알림</Badge>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setSheetOpen(true)}
            >
              설정 변경
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={stop}>
              추적 중지
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" fullWidth disabled={isPending} onClick={() => setSheetOpen(true)}>
          가격 추적 시작
        </Button>
      )}

      {error && <p className="text-small text-price-up">{error}</p>}

      <PriceTrackingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        hotelName={hotelName}
        location={location}
        checkIn={checkIn}
        checkOut={checkOut}
        nights={nights}
        currentPrice={currentPrice}
        currency={currency}
        initial={settings ?? undefined}
        onSubmit={submit}
      />
    </>
  );
}
