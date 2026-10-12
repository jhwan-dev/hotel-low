import "server-only";

import { MOCK_USER_ID } from "@/lib/auth/getCurrentUser";
import { hotelCatalog, hotelProvider, priceHistoryRepository } from "@/lib/hotels";
import { getSerpApiCronReserve, getSerpApiDailyLimit, isSerpApiConfigured } from "@/lib/hotels/serpapi/env";
import { daysBetween, todayISO, todayISOInSeoul } from "@/lib/date";
import { toTotalPoints } from "@/lib/hotels/price-history";
import { tryConsumeDailyCall } from "@/lib/serpapi/callBudget";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { backfillHotelDetails } from "@/lib/supabase/hotelsTable";
import { trackedHotelsRepository } from "@/lib/tracking";
import type { PriceTrackingSettings } from "@/types/tracking";
import { detectPriceEvents } from "./detectPriceEvents";
import { notificationRepository, notificationService } from "./index";
import {
  deactivateExpiredTrackedHotels,
  listAllActiveTrackedHotels,
  type TrackedHotelForCheck,
} from "./priceCheckQueries";

/** A tracked stay this far out only needs re-checking every RECHECK_INTERVAL_DAYS — it's not going anywhere soon. */
const FAR_OUT_THRESHOLD_DAYS = 30;
const RECHECK_INTERVAL_DAYS = 2;

function toCheckItem(userId: string, settings: PriceTrackingSettings): TrackedHotelForCheck {
  return {
    // No real row id in mock mode — this composite key is stable enough for
    // the mock repository's in-memory hasAlertToday lookup.
    trackedHotelId: `${settings.hotelId}|${settings.checkIn}|${settings.checkOut}`,
    userId,
    hotelId: settings.hotelId,
    checkIn: settings.checkIn,
    checkOut: settings.checkOut,
    adults: settings.adults,
    children: settings.children,
    rooms: settings.rooms,
    targetPrice: settings.targetPrice,
    currency: settings.currency,
    notifyOnAnyDrop: settings.notifyOnAnyDrop,
    notifyOnNewLow: settings.notifyOnNewLow,
  };
}

/** Everything that determines the upstream price fetch — items sharing this key can share a single fetch+record. */
function groupKey(item: TrackedHotelForCheck): string {
  return `${item.hotelId}|${item.checkIn}|${item.checkOut}|${item.adults}|${item.children}|${item.rooms}`;
}

export interface PriceCheckSummary {
  checked: number;
  notificationsSent: number;
  /** Active trackings turned off this run because their check-in date has already passed (Asia/Seoul calendar day). */
  deactivatedExpired: number;
}

/**
 * The price-check job: for every distinct (hotel, dates, party size) among
 * actively tracked stays, fetches the price once, records it into
 * hotel_price_history, then evaluates every user tracking that exact
 * combination against detectPriceEvents() — so two users (or two rows)
 * tracking the same stay never trigger two upstream fetches. Call this from
 * src/app/api/notifications/check/route.ts (manually, or on a real cron
 * schedule — see that route for the CRON_SECRET check).
 */
export async function checkPriceAlerts(): Promise<PriceCheckSummary> {
  // A stay that has already started has nothing left to notify about — turn
  // it off and leave it out of this run entirely, rather than letting it sit
  // active forever (e.g. a user who never clicks "추적 중지" after their trip).
  // Asia/Seoul specifically, not the server's own TZ, since that's the
  // calendar day the user actually experiences the check-in on.
  const todaySeoul = todayISOInSeoul();
  let deactivatedExpired: number;
  if (isSupabaseConfigured()) {
    deactivatedExpired = await deactivateExpiredTrackedHotels(todaySeoul);
  } else {
    const staleMock = (await trackedHotelsRepository.listActive(MOCK_USER_ID)).filter(
      (s) => s.checkIn < todaySeoul,
    );
    for (const s of staleMock) {
      await trackedHotelsRepository.deactivate(MOCK_USER_ID, s.hotelId, s.checkIn, s.checkOut);
    }
    deactivatedExpired = staleMock.length;
  }

  const items = isSupabaseConfigured()
    ? await listAllActiveTrackedHotels()
    : (await trackedHotelsRepository.listActive(MOCK_USER_ID)).map((s) =>
        toCheckItem(MOCK_USER_ID, s),
      );

  const groups = new Map<string, TrackedHotelForCheck[]>();
  for (const item of items) {
    const key = groupKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const today = todayISO();
  let notificationsSent = 0;
  // Only SerpApi mode has anything to throttle/rate-limit — the mock/Agoda
  // fallback's fetchLivePrice() costs nothing real.
  const serpApiActive = isSerpApiConfigured();

  for (const group of groups.values()) {
    const { hotelId, checkIn, checkOut, adults, children, rooms } = group[0];
    const partySize = { adults, children, rooms };

    if (serpApiActive && daysBetween(today, checkIn) >= FAR_OUT_THRESHOLD_DAYS) {
      const latest = await priceHistoryRepository.getLatestPrice(hotelId, checkIn, checkOut, partySize);
      if (latest && daysBetween(latest.checkedAt.slice(0, 10), today) < RECHECK_INTERVAL_DAYS) continue;
    }

    if (serpApiActive) {
      const allowed = await tryConsumeDailyCall(getSerpApiDailyLimit() - getSerpApiCronReserve());
      // Budget is shared across every remaining group this run too — once
      // it's gone, it's gone for the rest of this tick. Whatever's left
      // over gets picked up on the next cron run.
      if (!allowed) break;
    }

    let price, history;
    try {
      // A live price-source failure (bad request, network error, timeout —
      // e.g. SerpApi rejecting a stale tracking whose check-in date has
      // already passed) must not take down every other group's check in
      // this run. Log and move on; the stale group just gets retried next
      // tick.
      [price, history] = await Promise.all([
        hotelProvider.fetchLivePrice(hotelId, { destination: "", checkIn, checkOut, adults, children, rooms }),
        hotelProvider.getPriceHistory(hotelId, checkIn, checkOut, 30, partySize),
      ]);
    } catch (err) {
      console.error(`checkPriceAlerts: live price fetch failed for ${hotelId} ${checkIn}->${checkOut}`, err);
      continue;
    }
    if (!price) continue; // Agoda has no quote today — skip record+notify, keep the tracking as-is

    // Opportunistic, zero-extra-call catalog backfill from the detail
    // response the fetchLivePrice call above already made — never
    // overwrites a value that's already there. Isolated in its own
    // try/catch so a backfill hiccup can't take the rest of this group's
    // recording/notification work down with it.
    if (isSupabaseConfigured() && (price.detailAddress || price.detailAgodaHid)) {
      try {
        await backfillHotelDetails(createAdminClient(), hotelId, {
          address: price.detailAddress ?? null,
          agodaHid: price.detailAgodaHid ?? null,
        });
      } catch (err) {
        console.error(`checkPriceAlerts: detail backfill failed for ${hotelId}`, err);
      }
    }

    const totalPoints = toTotalPoints(history?.points ?? [], price.nights, rooms);
    const lastPoint = totalPoints.length > 0 ? totalPoints[totalPoints.length - 1] : null;
    // The mock history generator always includes a point for "today", but the
    // real Supabase-backed history is read *before* recordPrice below writes
    // today's price — so its last point is yesterday's, not today's. Only
    // treat the last point as "previous"/exclude it from priorDaysTotal when
    // it actually is today's.
    const lastIsToday = lastPoint?.checkedAt === today;
    const previousPoint = lastIsToday
      ? totalPoints.length >= 2
        ? totalPoints[totalPoints.length - 2]
        : null
      : lastPoint;
    const priorDaysTotal = lastIsToday ? totalPoints.slice(0, -1) : totalPoints;

    await priceHistoryRepository.recordPrice({
      hotelId,
      checkIn,
      checkOut,
      adults,
      children,
      rooms,
      price: price.nightlyPrice,
      currency: price.currency,
      provider: price.provider,
      bookingUrl: price.deepLink,
    });

    const entry = await hotelCatalog.findByAppHotelId(hotelId);
    const hotelName = entry?.name ?? "호텔";

    for (const item of group) {
      const events = detectPriceEvents({
        currentTotal: price.totalPrice,
        previousTotal: previousPoint?.price ?? null,
        priorDaysTotal,
        targetPrice: item.targetPrice,
        notifyOnAnyDrop: item.notifyOnAnyDrop,
        notifyOnNewLow: item.notifyOnNewLow,
      });

      for (const event of events) {
        const alreadySent = await notificationRepository.hasAlertToday(
          item.trackedHotelId,
          event.type,
          today,
        );
        if (alreadySent) continue;

        await notificationService.notify({
          userId: item.userId,
          trackedHotelId: item.trackedHotelId,
          hotelId: item.hotelId,
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          type: event.type,
          previousPrice: previousPoint?.price ?? null,
          currentPrice: price.totalPrice,
          currency: price.currency,
          message: `${hotelName}: ${event.message}`,
        });
        notificationsSent++;
      }
    }
  }

  return { checked: items.length, notificationsSent, deactivatedExpired };
}
