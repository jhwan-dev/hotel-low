import "server-only";

import { MOCK_USER_ID } from "@/lib/auth/getCurrentUser";
import { hotelProvider } from "@/lib/hotels";
import { todayISO } from "@/lib/date";
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
    targetPrice: settings.targetPrice,
    currency: settings.currency,
    notifyOnAnyDrop: settings.notifyOnAnyDrop,
    notifyOnNewLow: settings.notifyOnNewLow,
  };
}

export interface PriceCheckSummary {
  checked: number;
  notificationsSent: number;
}

/**
 * The price-check job: for every actively tracked stay, compares today's
 * price against history and fires whatever notifications
 * detectPriceEvents() decides apply. This is the "receive a price drop
 * event from the tracking system" piece — call it from
 * src/app/api/notifications/check/route.ts (manually, or wire that route to
 * Vercel Cron once a real schedule is wanted).
 */
export async function checkPriceAlerts(): Promise<PriceCheckSummary> {
  const items = isSupabaseConfigured()
    ? await listAllActiveTrackedHotels()
    : (await trackedHotelsRepository.listActive(MOCK_USER_ID)).map((s) =>
        toCheckItem(MOCK_USER_ID, s),
      );

  const today = todayISO();
  let notificationsSent = 0;

  for (const item of items) {
    const [result, history] = await Promise.all([
      hotelProvider.getHotelById(item.hotelId, {
        destination: "",
        checkIn: item.checkIn,
        checkOut: item.checkOut,
      }),
      hotelProvider.getPriceHistory(item.hotelId, item.checkIn, item.checkOut, 30),
    ]);
    if (!result || !history || history.points.length === 0) continue;

    const points = history.points;
    const previousPoint = points.length >= 2 ? points[points.length - 2] : null;

    const events = detectPriceEvents({
      currentNightly: result.price.nightlyPrice,
      previousNightly: previousPoint?.price ?? null,
      last30Days: points,
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
        currentPrice: result.price.nightlyPrice,
        currency: result.price.currency,
        message: `${result.hotel.name}: ${event.message}`,
      });
      notificationsSent++;
    }
  }

  return { checked: items.length, notificationsSent };
}
