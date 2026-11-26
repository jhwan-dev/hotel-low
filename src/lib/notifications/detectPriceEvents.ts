import { priceStats } from "@/lib/hotels/price-history";
import type { PricePoint } from "@/types/hotel";
import type { NotificationType } from "@/types/notification";

export interface PriceEventInput {
  /** Total stay price (nights × rooms), matching what the user set targetPrice against. */
  currentTotal: number;
  /** Total stay price at the previous check, or null if this is the first check for this stay. */
  previousTotal: number | null;
  /**
   * Trailing ~30 days of total stay prices for this exact stay, oldest
   * first — NOT including today's own point. The caller resolves whether
   * today is already present in its data source (the mock generator always
   * includes it, a real history read before today's price is recorded
   * never does) and passes only prior days, so this function doesn't have
   * to guess.
   */
  priorDaysTotal: PricePoint[];
  targetPrice: number;
  notifyOnAnyDrop: boolean;
  notifyOnNewLow: boolean;
  /** The total stay price when this tracking started — null for a pre-migration row whose backfill found nothing. Used only to append a "추적 시작가 대비 N% 하락" clause; absence just means a plainer message, not a skipped event. */
  baselinePrice: number | null;
}

export interface DetectedPriceEvent {
  type: NotificationType;
  message: string;
}

/**
 * "추적 시작가 대비 N% 하락" clause, appended to every event message below —
 * the absolute currentTotal/previousTotal are already carried as their own
 * notification fields (see NewPriceNotification), so the message itself
 * leads with the percent-off-baseline framing instead of repeating a won
 * amount. Omitted (not "0%") when there's no baseline, or the price isn't
 * actually below it (e.g. a price_drop that's still above where tracking
 * started) — a drop percent should never read as a drop that isn't one.
 */
function baselineDropSuffix(currentTotal: number, baselinePrice: number | null): string {
  if (baselinePrice === null || baselinePrice <= 0 || currentTotal >= baselinePrice) return "";
  const percent = Math.round(((baselinePrice - currentTotal) / baselinePrice) * 100);
  return percent > 0 ? ` 추적 시작가 대비 ${percent}% 하락했어요.` : "";
}

/**
 * Pure decision logic for "does this price change deserve a notification" —
 * kept separate from persistence/delivery so it's trivial to unit-test and
 * to reuse from both the price-check job and (later) an admin "resend"
 * tool. A single check can fire more than one event (e.g. a drop that also
 * happens to be a new 30-day low and clears the target price).
 */
export function detectPriceEvents(input: PriceEventInput): DetectedPriceEvent[] {
  const {
    currentTotal,
    previousTotal,
    priorDaysTotal,
    targetPrice,
    notifyOnAnyDrop,
    notifyOnNewLow,
    baselinePrice,
  } = input;
  const events: DetectedPriceEvent[] = [];
  const suffix = baselineDropSuffix(currentTotal, baselinePrice);

  if (notifyOnAnyDrop && previousTotal !== null && currentTotal < previousTotal) {
    events.push({ type: "price_drop", message: `가격이 내려갔어요.${suffix}` });
  }

  // Fire only on the crossing into "at or below target" — comparing
  // currentTotal alone would re-fire every single day the price stays down
  // there, not just the day it first arrives.
  const wasAboveTarget = previousTotal === null || previousTotal > targetPrice;
  if (wasAboveTarget && currentTotal <= targetPrice) {
    events.push({ type: "target_reached", message: `목표 가격 이하로 내려갔어요.${suffix}` });
  }

  // Require a strictly lower price than every prior day — otherwise a price
  // that's simply sitting flat at an already-recorded low re-triggers "new
  // low" every day it stays there, which isn't actually a new record.
  if (notifyOnNewLow && priorDaysTotal.length > 0) {
    const { min: priorMin } = priceStats(priorDaysTotal);
    if (currentTotal < priorMin) {
      events.push({ type: "new_low", message: `최근 30일 중 최저가를 갱신했어요.${suffix}` });
    }
  }

  return events;
}
