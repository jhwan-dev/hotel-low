import type { Currency } from "./hotel";

export interface PriceTrackingSettings {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  /** Guest/room counts this stay was tracked with — the same figures the price is quoted for. */
  adults: number;
  children: number;
  rooms: number;
  currency: Currency;
  /**
   * Alert once the tracked price falls to or below this amount (total stay
   * price). Null only while `status === "pending"` and the user didn't set
   * one at creation — the price-check cron fills it in (defaultTargetPrice)
   * the moment the first price lands. See SupabaseTrackedHotelsRepository.
   */
  targetPrice: number | null;
  /** Alert on any price drop, however small. */
  notifyOnAnyDrop: boolean;
  /** Alert whenever the price sets a new recorded low. */
  notifyOnNewLow: boolean;
  /**
   * "pending" = SerpApi's daily call budget was exhausted at creation time,
   * so there's no price yet — the cron fills one in on its next run. Every
   * tracking created outside that budget crunch (the normal case) is
   * "active" immediately.
   */
  status: "pending" | "active";
  /**
   * When this active tracking stint began (ISO timestamp) — preserved
   * across settings edits (notify toggles, target price), reset only when
   * the user actually stops and restarts tracking for this (hotel, stay).
   * The price graph (src/app/hotels/[id]/page.tsx) only ever shows
   * hotel_price_history rows from this point on — see
   * PriceHistoryRepository.getHistory's `since` param.
   */
  trackingStartedAt: string;
}
