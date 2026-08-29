"use client";

import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { BottomSheet, Button, Stepper } from "@/components/ui";
import { addMonthsISO, startOfMonthISO, todayISO } from "@/lib/date";
import type { StayQuery } from "@/lib/search/stay-query";
import { CalendarMonth } from "./CalendarMonth";

export type StayPickerStep = "calendar" | "guests";

const MAX_CHILD_AGE = 17;
const DEFAULT_CHILD_AGE = 10;

export interface StayPickerSheetProps {
  open: boolean;
  /** Which step to land on when the sheet opens — lets a caller jump straight to guest counts. */
  initialStep?: StayPickerStep;
  value: StayQuery;
  onClose: () => void;
  onApply: (value: StayQuery) => void;
  /** Label for the final confirm button — defaults to "적용하기", but a caller starting a fresh flow (e.g. "가격 추적 시작") can say what happens next instead. */
  applyLabel?: string;
}

/**
 * The calendar → guests flow shared by DateRangeGuestPicker's trigger
 * buttons and any other place that needs to collect a stay on demand (e.g.
 * PriceTrackingCta, when a hotel page was opened with no search context).
 * BottomSheet itself already renders as a bottom sheet on mobile and a
 * centered modal on desktop, so this one component covers both.
 */
export function StayPickerSheet({
  open,
  initialStep = "calendar",
  value,
  onClose,
  onApply,
  applyLabel = "적용하기",
}: StayPickerSheetProps) {
  const [step, setStep] = useState<StayPickerStep>(initialStep);
  const [monthStart, setMonthStart] = useState(() => startOfMonthISO(0));
  const [draftStart, setDraftStart] = useState<string | null>(value.checkIn);
  const [draftEnd, setDraftEnd] = useState<string | null>(value.checkOut);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [draftGuests, setDraftGuests] = useState({
    rooms: value.rooms,
    adults: value.adults,
    children: value.children,
    childrenAges: value.childrenAges,
  });

  useEffect(() => {
    if (!open) return;
    setDraftStart(value.checkIn);
    setDraftEnd(value.checkOut);
    setDraftGuests({
      rooms: value.rooms,
      adults: value.adults,
      children: value.children,
      childrenAges: value.childrenAges,
    });
    setMonthStart(startOfMonthISO(0));
    setStep(initialStep);
    // Only re-sync when the sheet opens, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSelectDate(date: string) {
    // No start yet, or a full range already picked — start a fresh selection.
    if (!draftStart || draftEnd) {
      setDraftStart(date);
      setDraftEnd(null);
      return;
    }
    // Picking an earlier date than the current start just moves the start.
    if (date <= draftStart) {
      setDraftStart(date);
      setDraftEnd(null);
      return;
    }
    setDraftEnd(date);
    setStep("guests"); // right after check-out is picked, ask "how many"
  }

  function setChildrenCount(children: number) {
    setDraftGuests((g) => ({
      ...g,
      children,
      childrenAges:
        children > g.childrenAges.length
          ? [...g.childrenAges, ...Array(children - g.childrenAges.length).fill(DEFAULT_CHILD_AGE)]
          : g.childrenAges.slice(0, children),
    }));
  }

  function apply() {
    if (!draftStart || !draftEnd) return;
    onApply({ checkIn: draftStart, checkOut: draftEnd, ...draftGuests });
  }

  const canGoBack = monthStart > startOfMonthISO(0);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={step === "calendar" ? "여행 날짜 선택" : "인원 선택"}
    >
      {step === "calendar" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthStart((m) => addMonthsISO(m, -1))}
              disabled={!canGoBack}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted disabled:opacity-30"
              aria-label="이전 달"
            >
              <ChevronLeftIcon width={18} height={18} />
            </button>
            <button
              type="button"
              onClick={() => setMonthStart((m) => addMonthsISO(m, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted"
              aria-label="다음 달"
            >
              <ChevronRightIcon width={18} height={18} />
            </button>
          </div>
          <CalendarMonth
            monthStart={monthStart}
            start={draftStart}
            end={draftEnd}
            previewEnd={draftEnd ? null : hoverDate}
            minDate={todayISO()}
            onSelectDate={handleSelectDate}
            onHoverDate={setHoverDate}
          />
          <p className="text-center text-small text-ink-muted">
            {draftStart && draftEnd
              ? "날짜를 다시 정하려면 체크인 날짜를 눌러주세요."
              : draftStart
                ? "체크아웃 날짜를 선택해주세요."
                : "체크인 날짜를 선택해주세요."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex flex-col divide-y divide-border">
            <Stepper
              label="객실"
              value={draftGuests.rooms}
              min={1}
              max={8}
              onChange={(rooms) => setDraftGuests((g) => ({ ...g, rooms }))}
            />
            <Stepper
              label="성인"
              value={draftGuests.adults}
              min={1}
              max={16}
              onChange={(adults) => setDraftGuests((g) => ({ ...g, adults }))}
            />
            <Stepper
              label="아동"
              description="만 17세 이하"
              value={draftGuests.children}
              min={0}
              max={8}
              onChange={setChildrenCount}
            />
          </div>

          {draftGuests.children > 0 && (
            <div className="flex flex-col gap-2 pt-3">
              <span className="text-small font-medium text-ink">아동 나이</span>
              <div className="grid grid-cols-4 gap-2">
                {draftGuests.childrenAges.map((age, i) => (
                  <select
                    key={i}
                    value={age}
                    onChange={(e) => {
                      const nextAges = [...draftGuests.childrenAges];
                      nextAges[i] = Number(e.target.value);
                      setDraftGuests((g) => ({ ...g, childrenAges: nextAges }));
                    }}
                    className="rounded-control border border-border px-2 py-2 text-small text-ink"
                  >
                    {Array.from({ length: MAX_CHILD_AGE + 1 }, (_, ageOption) => (
                      <option key={ageOption} value={ageOption}>
                        {ageOption}세
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          )}

          <Button
            size="lg"
            fullWidth
            className="mt-5"
            disabled={!draftStart || !draftEnd}
            onClick={apply}
          >
            {applyLabel}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
