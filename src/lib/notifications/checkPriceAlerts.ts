import "server-only";

import { MOCK_USER_ID } from "@/lib/auth/getCurrentUser";
import { hotelProvider, priceHistoryRepository } from "@/lib/hotels";
import { todayISO } from "@/lib/date";
import { toTotalPoints } from "@/lib/hotels/price-history";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { trackedHotelsRepository } from "@/lib/tracking";
import type { PriceTrackingSettings } from "@/types/tracking";
import { detectPriceEvents } from "./detectPriceEvents";
import { notificationRepository, notificationService } from "./index";
import { listAllActiveTrackedHotels, type TrackedHotelForCheck } from "./priceCheckQueries";

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

  for (const group of groups.values()) {
    const { hotelId, checkIn, checkOut, adults, children, rooms } = group[0];
    const partySize = { adults, children, rooms };

    const [result, history] = await Promise.all([
      hotelProvider.getHotelById(hotelId, { destination: "", checkIn, checkOut, adults, children, rooms }),
      hotelProvider.getPriceHistory(hotelId, checkIn, checkOut, 30, partySize),
    ]);
    if (!result) continue;

    const totalPoints = toTotalPoints(history?.points ?? [], result.price.nights, rooms);
    const lastPoint = totalPoints.length > 0 ? totalPoints[totalPoints.length - 1] : null;
    // The mock history generator always includes a point for "today", but the
    // real Supabase-backed history is read *before* recordPrice below writes
    // today's price — so its last point is yesterday's, not today's. Only
    // step back an extra point when the last one actually is today.
    const previousPoint =
      lastPoint && lastPoint.checkedAt === today
        ? totalPoints.length >= 2
          ? totalPoints[totalPoints.length - 2]
          : null
        : lastPoint;

    await priceHistoryRepository.recordPrice({
      hotelId,
      checkIn,
      checkOut,
      adults,
      children,
      rooms,
      price: result.price.nightlyPrice,
      currency: result.price.currency,
      provider: result.price.provider,
      bookingUrl: result.price.deepLink,
    });

    for (const item of group) {
      const events = detectPriceEvents({
        currentTotal: result.price.totalPrice,
        previousTotal: previousPoint?.price ?? null,
        last30DaysTotal: totalPoints,
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
          currentPrice: result.price.totalPrice,
          currency: result.price.currency,
          message: `${result.hotel.name}: ${event.message}`,
        });
        notificationsSent++;
      }
    }
  }

  return { checked: items.length, notificationsSent };
}
