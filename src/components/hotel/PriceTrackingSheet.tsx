"use client";

import { useEffect, useState } from "react";
import { BottomSheet, Button, Checkbox, Input } from "@/components/ui";
import { formatDateLabel } from "@/lib/date";
import { formatPrice } from "@/lib/format";
import type { Currency } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";

type TrackingFormValues = Pick<
  PriceTrackingSettings,
  "targetPrice" | "notifyOnAnyDrop" | "notifyOnNewLow"
>;

export interface PriceTrackingSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: TrackingFormValues) => void;
  hotelName: string;
  location: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  currentPrice: number;
  currency: Currency;
  initial?: Partial<TrackingFormValues>;
  submitLabel?: string;
}

const PRESET_DROPS = [5, 10, 15];

function defaultTarget(currentPrice: number): number {
  return Math.round((currentPrice * 0.9) / 1000) * 1000;
}

export function PriceTrackingSheet({
  open,
  onClose,
  onSubmit,
  hotelName,
  location,
  checkIn,
  checkOut,
  nights,
  currentPrice,
  currency,
  initial,
  submitLabel = "가격 추적 시작",
}: PriceTrackingSheetProps) {
  const [targetPrice, setTargetPrice] = useState(
    initial?.targetPrice ?? defaultTarget(currentPrice),
  );
  const [notifyOnAnyDrop, setNotifyOnAnyDrop] = useState(
    initial?.notifyOnAnyDrop ?? true,
  );
  const [notifyOnNewLow, setNotifyOnNewLow] = useState(
    initial?.notifyOnNewLow ?? true,
  );

  useEffect(() => {
    if (!open) return;
    setTargetPrice(initial?.targetPrice ?? defaultTarget(currentPrice));
    setNotifyOnAnyDrop(initial?.notifyOnAnyDrop ?? true);
    setNotifyOnNewLow(initial?.notifyOnNewLow ?? true);
    // Only re-sync when the sheet opens, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isValid = targetPrice > 0 && targetPrice < currentPrice;
  const errorText =
    targetPrice > 0 && targetPrice >= currentPrice
      ? "현재 가격보다 낮은 금액을 입력해주세요."
      : undefined;

  return (
    <BottomSheet open={open} onClose={onClose} title="가격 추적 설정">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5 rounded-control bg-surface-muted p-4 text-small">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">호텔</span>
            <span className="font-medium text-ink">{hotelName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">위치</span>
            <span className="font-medium text-ink">{location}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">여행 날짜</span>
            <span className="font-medium text-ink">
              {formatDateLabel(checkIn)} – {formatDateLabel(checkOut)} · {nights}박
            </span>
          </div>
        </div>

        <div>
          <span className="text-small text-ink-muted">현재 가격</span>
          <p className="text-price-lg tabular-nums text-ink">
            {formatPrice(currentPrice, currency)}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Input
            label="목표 가격"
            type="number"
            inputMode="numeric"
            step={1000}
            min={0}
            value={targetPrice}
            onChange={(e) => setTargetPrice(Number(e.target.value) || 0)}
            errorText={errorText}
          />
          <div className="flex gap-2">
            {PRESET_DROPS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() =>
                  setTargetPrice(
                    Math.round((currentPrice * (1 - pct / 100)) / 1000) * 1000,
                  )
                }
                className="rounded-full bg-surface-muted px-3 py-1.5 text-small font-semibold text-ink-muted hover:bg-primary-light hover:text-primary"
              >
                -{pct}%
              </button>
            ))}
          </div>
          {isValid && (
            <p className="text-small text-ink-muted">
              {formatPrice(targetPrice, currency)} 이하가 되면 알려주세요.
            </p>
          )}
        </div>

        <div className="flex flex-col">
          <span className="pb-1 text-small font-medium text-ink">알림 받기</span>
          <Checkbox
            label="가격이 내려가면 알림"
            description="이전보다 저렴해질 때마다 알려드려요."
            checked={notifyOnAnyDrop}
            onChange={(e) => setNotifyOnAnyDrop(e.target.checked)}
          />
          <Checkbox
            label="최근 최저가 갱신 시 알림"
            description="최근 90일 중 가장 쌀 때만 알려드려요."
            checked={notifyOnNewLow}
            onChange={(e) => setNotifyOnNewLow(e.target.checked)}
          />
        </div>

        <Button
          size="lg"
          fullWidth
          disabled={!isValid}
          onClick={() => onSubmit({ targetPrice, notifyOnAnyDrop, notifyOnNewLow })}
        >
          {submitLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
