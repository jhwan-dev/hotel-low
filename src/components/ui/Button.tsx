import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";

export type { ButtonVariant, ButtonSize };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", fullWidth, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={buttonClasses(variant, size, fullWidth, className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
