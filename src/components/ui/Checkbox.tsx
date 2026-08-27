import type { InputHTMLAttributes } from "react";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
}

export function Checkbox({
  label,
  description,
  className,
  checked,
  ...props
}: CheckboxProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 py-2", className)}>
      <span className="relative mt-0.5 h-5 w-5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        <span
          className={cn(
            "pointer-events-none flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
            checked
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-transparent",
          )}
        >
          <CheckIcon width={14} height={14} />
        </span>
      </span>
      <span className="flex flex-col">
        <span className="text-body font-medium text-ink">{label}</span>
        {description && <span className="text-small text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}
