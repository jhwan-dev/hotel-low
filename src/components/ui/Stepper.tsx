"use client";

export interface StepperProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, description, value, min = 0, max = 20, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col">
        <span className="text-body font-medium text-ink">{label}</span>
        {description && <span className="text-small text-ink-muted">{description}</span>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-h3 text-ink disabled:opacity-30"
          aria-label={`${label} 줄이기`}
        >
          −
        </button>
        <span className="w-5 text-center text-body font-semibold tabular-nums text-ink">
          {value}
        </span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-h3 text-ink disabled:opacity-30"
          aria-label={`${label} 늘리기`}
        >
          +
        </button>
      </div>
    </div>
  );
}
