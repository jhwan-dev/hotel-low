"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StayPickerSheet } from "@/components/search";
import { formatDateLabel } from "@/lib/date";
import { formatGuestsLabel, stayQueryToSearchParams, type StayQuery } from "@/lib/search/stay-query";

export interface StayConditionsBarProps {
  hotelId: string;
  stay: StayQuery;
  nights: number;
  /** False when these dates/guests are only a fallback default, not something the user actually chose. */
  confirmed: boolean;
}

/** Top-of-page summary of the stay this hotel is being priced for, with a "변경" action that re-queries the whole page for the new dates/guests. */
export function StayConditionsBar({ hotelId, stay, nights, confirmed }: StayConditionsBarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function apply(next: StayQuery) {
    setOpen(false);
    const params = stayQueryToSearchParams(next);
    router.push(`/hotels/${hotelId}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-1 rounded-control bg-surface-muted px-4 py-3 text-small">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink">
          {formatDateLabel(stay.checkIn)} → {formatDateLabel(stay.checkOut)} · {nights}박
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 text-small font-semibold text-primary"
        >
          변경
        </button>
      </div>
      <span className="text-ink-muted">{formatGuestsLabel(stay.rooms, stay.adults, stay.children)}</span>
      {!confirmed && (
        <span className="text-caption text-ink-muted">
          정확한 가격을 보려면 여행 조건을 선택해주세요.
        </span>
      )}

      <StayPickerSheet open={open} value={stay} onClose={() => setOpen(false)} onApply={apply} />
    </div>
  );
}
