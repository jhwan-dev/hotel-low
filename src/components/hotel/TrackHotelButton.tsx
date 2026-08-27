"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui";

export interface TrackHotelButtonProps extends Omit<ButtonProps, "variant" | "onClick"> {
  label?: string;
  trackingLabel?: string;
}

export function TrackHotelButton({
  label = "가격 추적",
  trackingLabel = "추적 중",
  ...props
}: TrackHotelButtonProps) {
  const [tracking, setTracking] = useState(false);

  return (
    <Button
      variant={tracking ? "secondary" : "primary"}
      onClick={(e) => {
        e.preventDefault();
        setTracking((v) => !v);
      }}
      {...props}
    >
      {tracking ? trackingLabel : label}
    </Button>
  );
}
