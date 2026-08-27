import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      errorText,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hasError = Boolean(errorText);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-small font-medium text-ink"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 text-ink-muted">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-12 w-full rounded-control border bg-surface px-4 text-body text-ink placeholder:text-ink-muted",
              "focus:outline-none focus:ring-2 focus:ring-primary-light-2 focus:border-primary",
              hasError ? "border-price-up" : "border-border",
              leftIcon && "pl-11",
              rightIcon && "pr-11",
              className,
            )}
            aria-invalid={hasError}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3.5 text-ink-muted">
              {rightIcon}
            </span>
          )}
        </div>
        {errorText ? (
          <p className="text-small text-price-up">{errorText}</p>
        ) : helperText ? (
          <p className="text-small text-ink-muted">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
