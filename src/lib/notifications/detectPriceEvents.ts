import { priceStats } from "@/lib/hotels/price-history";
import type { PricePoint } from "@/types/hotel";
import type { NotificationType } from "@/types/notification";

export interface PriceEventInput {
  /** Total stay price (nights × rooms), matching what the user set targetPrice against. */
  currentTotal: number;
  /** Total stay price at the previous check, or null if this is the first check for this stay. */
  previousTotal: number | null;
  /** Trailing 30 days of total stay prices for this exact stay, oldest first. */
  last30DaysTotal: PricePoint[];
  targetPrice: number;
  notifyOnAnyDrop: boolean;
  notifyOnNewLow: boolean;
}

export interface DetectedPriceEvent {
  type: NotificationType;
  message: string;
}

/**
 * Pure decision logic for "does this price change deserve a notification" —
 * kept separate from persistence/delivery so it's trivial to unit-test and
 * to reuse from both the price-check job and (later) an admin "resend"
 * tool. A single check can fire more than one event (e.g. a drop that also
 * happens to be a new 30-day low and clears the target price).
 */
export function detectPriceEvents(input: PriceEventInput): DetectedPriceEvent[] {
  const { currentTotal, previousTotal, last30DaysTotal, targetPrice, notifyOnAnyDrop, notifyOnNewLow } =
    input;
  const events: DetectedPriceEvent[] = [];

  if (notifyOnAnyDrop && previousTotal !== null && currentTotal < previousTotal) {
    events.push({ type: "price_drop", message: "가격이 내려갔어요." });
  }

  if (currentTotal <= targetPrice) {
    events.push({ type: "target_reached", message: "목표 가격 이하로 내려갔어요." });
  }

  if (notifyOnNewLow && last30DaysTotal.length > 0) {
    const { min } = priceStats(last30DaysTotal);
    if (currentTotal <= min) {
      events.push({ type: "new_low", message: "최근 30일 중 최저가를 갱신했어요." });
    }
  }

  return events;
}
