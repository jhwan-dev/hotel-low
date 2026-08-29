"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoginPromptSheet } from "@/components/auth/LoginPromptSheet";
import { StayPickerSheet } from "@/components/search";
import { BellIcon } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
import { formatShortDate } from "@/lib/date";
import { formatPrice } from "@/lib/format";
import { formatGuestsLabel, stayQueryToSearchParams, type StayQuery } from "@/lib/search/stay-query";
import { startTracking, stopTracking } from "@/lib/tracking/actions";
import type { Currency } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";
import { PriceTrackingSheet } from "./PriceTrackingSheet";

export interface PriceTrackingCtaProps {
  hotelId: string;
  hotelName: string;
  location: string;
  stay: StayQuery;
  nights: number;
  currentPrice: number;
  currency: Currency;
  /** Fetched server-side so the CTA renders in the right state on first paint — no login-wall flash. */
  initialSettings: PriceTrackingSettings | null;
  /** Also fetched server-side — decides whether "가격 추적 시작" opens the settings sheet or a login prompt. */
  isLoggedIn: boolean;
  /** Where to return to after logging in — this hotel's detail page, dates and all. */
  loginRedirectPath: string;
  /** False when `stay` is only today/tomorrow/2-adults defaults, not something the user actually picked (arrived here without a search). */
  hasExplicitStay: boolean;
  /** True right after the user picked conditions in the no-context flow — opens the tracking-settings sheet immediately instead of making them tap "가격 추적 시작" again. */
  autoOpen: boolean;
}

/**
 * Renders keyed by stay (see hotels/[id]/page.tsx) so every field here
 * resets cleanly whenever the tracked conditions change — no stale
 * `settings`/`sheetOpen` state left over from a previous (hotel, stay) pair.
 */
export function PriceTrackingCta({
  hotelId,
  hotelName,
  location,
  stay,
  nights,
  currentPrice,
  currency,
  initialSettings,
  isLoggedIn,
  loginRedirectPath,
  hasExplicitStay,
  autoOpen,
}: PriceTrackingCtaProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(autoOpen && isLoggedIn && !initialSettings);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [settings, setSettings] = useState<PriceTrackingSettings | null>(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!autoOpen) return;
    // One-shot flag from the "no conditions yet" flow — drop it from the
    // visible URL so refreshing the page doesn't reopen the sheet.
    const url = new URL(window.location.href);
    url.searchParams.delete("startTracking");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startTrackingFlow() {
    if (!isLoggedIn) {
      setLoginPromptOpen(true);
      return;
    }
    if (!hasExplicitStay && !settings) {
      setConditionsOpen(true);
      return;
    }
    setSheetOpen(true);
  }

  function applyConditions(next: StayQuery) {
    setConditionsOpen(false);
    const params = stayQueryToSearchParams(next);
    params.set("startTracking", "1");
    router.push(`/hotels/${hotelId}?${params.toString()}`);
  }

  function submit(values: Pick<PriceTrackingSettings, "targetPrice" | "notifyOnAnyDrop" | "notifyOnNewLow">) {
    setError(null);
    startTransition(async () => {
      const result = await startTracking({
        hotelId,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: stay.adults,
        children: stay.children,
        rooms: stay.rooms,
        currency,
        ...values,
      });
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
      const result = await stopTracking(hotelId, stay.checkIn, stay.checkOut);
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
            ✓ 가격 추적 중
          </span>
          <p className="text-caption text-ink-muted">
            {formatShortDate(settings.checkIn)} → {formatShortDate(settings.checkOut)} · {nights}박
            <br />
            {formatGuestsLabel(settings.rooms, settings.adults, settings.children)}
          </p>
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
              알림 설정
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={stop}>
              추적 중지
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" fullWidth disabled={isPending} onClick={startTrackingFlow}>
          가격 추적 시작
        </Button>
      )}

      {error && <p className="text-small text-price-up">{error}</p>}

      <PriceTrackingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        hotelName={hotelName}
        location={location}
        checkIn={stay.checkIn}
        checkOut={stay.checkOut}
        nights={nights}
        currentPrice={currentPrice}
        currency={currency}
        initial={settings ?? undefined}
        onSubmit={submit}
        submitLabel={settings ? "설정 저장" : "가격 추적 시작"}
      />

      <StayPickerSheet
        open={conditionsOpen}
        value={stay}
        onClose={() => setConditionsOpen(false)}
        onApply={applyConditions}
        applyLabel="이 조건으로 추적 시작"
      />

      <LoginPromptSheet
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        next={loginRedirectPath}
      />
    </>
  );
}
