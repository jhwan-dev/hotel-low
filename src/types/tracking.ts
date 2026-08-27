import type { Currency } from "./hotel";

export interface PriceTrackingSettings {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  currency: Currency;
  /** Alert once the tracked price falls to or below this amount. */
  targetPrice: number;
  /** Alert on any price drop, however small. */
  notifyOnAnyDrop: boolean;
  /** Alert whenever the price sets a new recorded low. */
  notifyOnNewLow: boolean;
}
