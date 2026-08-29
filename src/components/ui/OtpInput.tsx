"use client";

import { useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  errorText?: string;
  autoFocus?: boolean;
}

/** Six separate boxes for a numeric one-time code, instead of one free-text field — auto-advances as each digit is typed, supports paste, and backspace steps back through empty boxes. */
export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
  errorText,
  autoFocus,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const hasError = Boolean(errorText);

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigit(index, digit);
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setDigit(index - 1, "");
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    const next = digits.slice();
    for (let i = 0; i < pasted.length && index + i < length; i++) {
      next[index + i] = pasted[i];
    }
    onChange(next.join("").slice(0, length));
    const lastFilled = Math.min(index + pasted.length, length) - 1;
    inputRefs.current[lastFilled]?.focus();
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex justify-between gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            autoFocus={autoFocus && index === 0}
            disabled={disabled}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className={cn(
              "h-14 w-full rounded-control border bg-surface text-center text-h2 tabular-nums text-ink",
              "focus:outline-none focus:ring-2 focus:ring-primary-light-2 focus:border-primary",
              hasError ? "border-price-up" : "border-border",
            )}
            aria-invalid={hasError}
          />
        ))}
      </div>
      {errorText && <p className="text-small text-price-up">{errorText}</p>}
    </div>
  );
}
