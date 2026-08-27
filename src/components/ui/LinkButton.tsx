import type { AnchorHTMLAttributes } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function LinkButton({
  className,
  variant = "primary",
  size = "md",
  fullWidth,
  ...props
}: LinkButtonProps) {
  return (
    <a className={buttonClasses(variant, size, fullWidth, className)} {...props} />
  );
}
