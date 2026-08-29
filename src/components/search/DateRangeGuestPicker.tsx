"use client";

import { useState } from "react";
import {
  formatDateRangeLabel,
  formatGuestsLabel,
  type StayQuery,
} from "@/lib/search/stay-query";
import { StayPickerSheet, type StayPickerStep } from "./StayPickerSheet";

export interface DateRangeGuestPickerProps {
  value: StayQuery;
  onChange: (value: StayQuery) => void;
}

export function DateRangeGuestPicker({ value, onChange }: DateRangeGuestPickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StayPickerStep>("calendar");

  function openAt(initialStep: StayPickerStep) {
    setStep(initialStep);
    setOpen(true);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => openAt("calendar")}
          className="rounded-control border border-border px-3 py-2.5 text-left"
        >
          <span className="block text-caption text-ink-muted">여행 날짜</span>
          <span className="block text-small font-semibold text-ink">
            {formatDateRangeLabel(value.checkIn, value.checkOut)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => openAt("guests")}
          className="rounded-control border border-border px-3 py-2.5 text-left"
        >
          <span className="block text-caption text-ink-muted">인원</span>
          <span className="block truncate text-small font-semibold text-ink">
            {formatGuestsLabel(value.rooms, value.adults, value.children)}
          </span>
        </button>
      </div>

      <StayPickerSheet
        open={open}
        initialStep={step}
        value={value}
        onClose={() => setOpen(false)}
        onApply={(next) => {
          onChange(next);
          setOpen(false);
        }}
      />
    </>
  );
}
