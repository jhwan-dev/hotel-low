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
  /** Alert once the tracked price falls to or below this amount (total stay price). */
  targetPrice: number;
  /** Alert on any price drop, however small. */
  notifyOnAnyDrop: boolean;
  /** Alert whenever the price sets a new recorded low. */
  notifyOnNewLow: boolean;
}
