"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { priceStats } from "@/lib/hotels/price-history";
import type { Currency, PriceHistoryRangeDays, PricePoint } from "@/types/hotel";

export interface PriceHistoryChartProps {
  /** Full history the caller has available; the chart slices the last N days itself. */
  points: PricePoint[];
  currency: Currency;
  className?: string;
}

const RANGE_OPTIONS: { days: PriceHistoryRangeDays; label: string }[] = [
  { days: 7, label: "최근 7일" },
  { days: 30, label: "최근 30일" },
  { days: 90, label: "최근 90일" },
];

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PADDING_X = 8;
const PADDING_Y = 16;

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function PriceHistoryChart({ points, currency, className }: PriceHistoryChartProps) {
  const [range, setRange] = useState<PriceHistoryRangeDays>(30);
  const gradientId = useId();

  const visible = points.slice(-range);
  const stats = priceStats(visible);
  const span = stats.max - stats.min || 1;

  const coords = visible.map((point, i) => {
    const x =
      visible.length > 1
        ? PADDING_X + (i / (visible.length - 1)) * (CHART_WIDTH - PADDING_X * 2)
        : CHART_WIDTH / 2;
    const y =
      CHART_HEIGHT -
      PADDING_Y -
      ((point.price - stats.min) / span) * (CHART_HEIGHT - PADDING_Y * 2);
    return { x, y, point };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x.toFixed(1)} ${CHART_HEIGHT} L ${coords[0]?.x.toFixed(1)} ${CHART_HEIGHT} Z`;
  const avgY =
    CHART_HEIGHT - PADDING_Y - ((stats.avg - stats.min) / span) * (CHART_HEIGHT - PADDING_Y * 2);
  const last = coords[coords.length - 1];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex gap-1.5">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.days}
            type="button"
            onClick={() => setRange(option.days)}
            className={cn(
              "rounded-full px-3 py-1.5 text-small font-semibold transition-colors",
              range === option.days
                ? "bg-primary text-white"
                : "bg-surface-muted text-ink-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label={`최근 ${range}일 가격 변화 그래프`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={PADDING_X}
          x2={CHART_WIDTH - PADDING_X}
          y1={avgY}
          y2={avgY}
          stroke="var(--color-ink-muted)"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth={2} />

        {last && (
          <circle cx={last.x} cy={last.y} r={4} fill="var(--color-primary)" />
        )}
      </svg>

      <div className="flex items-center justify-between text-caption text-ink-muted">
        <span>{visible[0] && shortDate(visible[0].checkedAt)}</span>
        <span>{last && shortDate(last.point.checkedAt)}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-ink-muted">현재가</span>
          <span className="text-price-sm tabular-nums text-ink">
            {formatPrice(stats.current, currency)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-ink-muted">최고가</span>
          <span className="text-price-sm tabular-nums text-price-up">
            {formatPrice(stats.max, currency)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-ink-muted">최저가</span>
          <span className="text-price-sm tabular-nums text-price-down">
            {formatPrice(stats.min, currency)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-ink-muted">평균가</span>
          <span className="text-price-sm tabular-nums text-ink">
            {formatPrice(stats.avg, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
