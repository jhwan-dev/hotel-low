import type { Currency } from "./hotel";

/**
 * Mirrors price_alerts.alert_type — every reason a notification can fire.
 * tracking_unavailable is a one-time notice fired when a pending tracking's
 * first-ever price check comes back with no quote at all (see
 * checkPriceAlerts.ts) — not a price-change event, so it's exempt from
 * detectPriceEvents' dedup-by-day logic. A pending tracking whose first
 * price already satisfies the user's target fires an ordinary
 * target_reached instead of a dedicated type — that's exactly what it is.
 */
export type NotificationType =
  | "price_drop"
  | "target_reached"
  | "new_low"
  | "tracking_unavailable";

/** Mirrors price_alerts.is_read, spelled out for the app layer. */
export type NotificationStatus = "unread" | "read";

export interface PriceNotification {
  id: string;
  userId: string;
  trackedHotelId: string;
  /** App catalog hotel id + stay — lets the UI link straight to /hotels/[id]. */
  hotelId: string;
  checkIn: string;
  checkOut: string;
  type: NotificationType;
  previousPrice: number | null;
  currentPrice: number;
  /** previousPrice - currentPrice — positive means the price dropped. */
  priceDifference: number | null;
  currency: Currency;
  message: string;
  status: NotificationStatus;
  sentAt: string;
}

/** What the price-check job hands to NotificationService.notify() — no id/status/sentAt, those are assigned on creation. */
export interface NewPriceNotification {
  userId: string;
  trackedHotelId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  type: NotificationType;
  previousPrice: number | null;
  currentPrice: number;
  currency: Currency;
  message: string;
}
