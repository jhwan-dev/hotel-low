"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type { PriceTrackingSettings } from "@/types/tracking";
import { trackedHotelsRepository } from "./index";
import type { TrackingInput } from "./repository";

export interface TrackingActionError {
  error: string;
}

export async function startTracking(
  input: TrackingInput,
): Promise<PriceTrackingSettings | TrackingActionError> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  return trackedHotelsRepository.upsert(user.id, input);
}

export async function stopTracking(
  hotelId: string,
  checkIn: string,
  checkOut: string,
): Promise<{ ok: true } | TrackingActionError> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  await trackedHotelsRepository.deactivate(user.id, hotelId, checkIn, checkOut);
  return { ok: true };
}
