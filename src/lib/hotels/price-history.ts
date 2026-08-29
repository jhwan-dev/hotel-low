import { formatPrice } from "@/lib/format";
import type { Currency, PricePoint } from "@/types/hotel";

export interface PriceStats {
  current: number;
  min: number;
  max: number;
  avg: number;
}

export function priceStats(points: PricePoint[]): PriceStats {
  const prices = points.map((p) => p.price);
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    current: prices[prices.length - 1] ?? 0,
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(sum / prices.length),
  };
}

/**
 * hotel_price_history stores one quote per room per night — scale each point
 * up to the full stay (nights × rooms) so it lines up with RoomPrice.totalPrice.
 * Every price comparison (status message, graph, target-price alerts) reads
 * off these total-stay figures, never the raw nightly quote, so "현재가" on
 * the graph always matches the headline total shown above it.
 */
export function toTotalPoints(points: PricePoint[], nights: number, rooms: number): PricePoint[] {
  return points.map((p) => ({ checkedAt: p.checkedAt, price: p.price * nights * rooms }));
}

export type PriceStatusTrend = "down" | "up" | "neutral";

export interface PriceStatus {
  message: string;
  trend: PriceStatusTrend;
}

/**
 * Compares a stay's total price against its own most recent prior check and
 * the trailing 30-day range — all three figures (current, previous,
 * last30Days) must be on the same basis (use toTotalPoints() first).
 */
export function computePriceStatus(
  current: number,
  previous: number | null,
  last30Days: PricePoint[],
  currency: Currency,
): PriceStatus {
  if (last30Days.length > 0) {
    const { min } = priceStats(last30Days);
    if (current <= min) {
      return { message: "최근 30일 중 최저가예요", trend: "down" };
    }
  }

  if (previous === null || previous === current) {
    return { message: "현재 가격이 유지되고 있어요", trend: "neutral" };
  }

  if (current < previous) {
    return {
      message: `최근 가격보다 ${formatPrice(previous - current, currency)} 저렴해요`,
      trend: "down",
    };
  }

  return {
    message: `최근 가격보다 ${formatPrice(current - previous, currency)} 비싸요`,
    trend: "up",
  };
}
