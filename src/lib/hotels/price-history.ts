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

export type PriceStatusTrend = "down" | "up" | "neutral";

export interface PriceStatus {
  message: string;
  trend: PriceStatusTrend;
}

/** Compares a stay's nightly price against the trailing 30-day range for that hotel. */
export function computePriceStatus(
  currentNightly: number,
  last30Days: PricePoint[],
  currency: Currency,
): PriceStatus {
  const { min, avg } = priceStats(last30Days);

  if (currentNightly <= min) {
    return { message: "최근 30일 중 최저가예요", trend: "down" };
  }

  if (currentNightly < avg) {
    const pct = Math.round(((avg - currentNightly) / avg) * 100);
    return { message: `최근 30일 평균보다 ${pct}% 저렴해요`, trend: "down" };
  }

  if (currentNightly === avg) {
    return { message: "최근 30일 평균과 비슷해요", trend: "neutral" };
  }

  const gap = currentNightly - min;
  return {
    message: `최근 30일 최저가까지 ${formatPrice(gap, currency)} 남았어요`,
    trend: "up",
  };
}
