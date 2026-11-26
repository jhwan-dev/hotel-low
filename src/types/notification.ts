import type { Currency } from "./hotel";

/**
 * Mirrors price_alerts.alert_type — every reason a notification can fire.
 * tracking_unavailable/target_price_adjusted are one-time notices fired
 * while a pending tracking resolves its first price (see checkPriceAlerts.ts)
 * — not price-change events, so they're exempt from detectPriceEvents'
 * dedup-by-day logic.
 */
export type NotificationType =
  | "price_drop"
  | "target_reached"
  | "new_low"
  | "tracking_unavailable"
  | "target_price_adjusted";

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
