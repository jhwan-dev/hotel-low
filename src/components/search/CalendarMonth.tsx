import { formatMonthLabel, getMonthGrid } from "@/lib/date";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export interface CalendarMonthProps {
  /** First of the month, YYYY-MM-01. */
  monthStart: string;
  start: string | null;
  end: string | null;
  /** Live hover/drag preview for the end date, before it's actually picked. */
  previewEnd: string | null;
  /** Dates before this are disabled. */
  minDate: string;
  onSelectDate: (date: string) => void;
  onHoverDate?: (date: string | null) => void;
}

export function CalendarMonth({
  monthStart,
  start,
  end,
  previewEnd,
  minDate,
  onSelectDate,
  onHoverDate,
}: CalendarMonthProps) {
  const cells = getMonthGrid(monthStart);
  const effectiveEnd = end ?? previewEnd;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-small font-semibold text-ink">
        {formatMonthLabel(monthStart)}
      </p>
      <div className="grid grid-cols-7 text-center text-caption text-ink-muted">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-y-1"
        onMouseLeave={() => onHoverDate?.(null)}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;

          const disabled = date < minDate;
          const isStart = date === start;
          const isEnd = date === effectiveEnd;
          const inRange = Boolean(
            start && effectiveEnd && date > start && date < effectiveEnd,
          );

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(date)}
              onMouseEnter={() => onHoverDate?.(date)}
              className={cn(
                "relative h-10 text-small",
                inRange && "bg-primary-light",
                isStart && "rounded-l-full",
                isEnd && "rounded-r-full",
              )}
            >
              <span
                className={cn(
                  "mx-auto flex h-9 w-9 items-center justify-center rounded-full tabular-nums",
                  disabled && "text-ink-muted/30",
                  !disabled && !isStart && !isEnd && "text-ink",
                  (isStart || isEnd) && "bg-primary font-semibold text-white",
                )}
              >
                {Number(date.slice(-2))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
