"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { trackedHotelsRepository } from "./index";
import { TrackingRejectedError, type TrackingInput, type TrackingUpsertResult } from "./repository";

export interface TrackingActionError {
  error: string;
}

export async function startTracking(
  input: TrackingInput,
): Promise<TrackingUpsertResult | TrackingActionError> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  try {
    return await trackedHotelsRepository.upsert(user.id, input);
  } catch (err) {
    // Only a deliberate, user-facing rejection (rate limit, no Agoda price)
    // becomes a message — anything else is a real bug/outage and should
    // still surface as an error, not a misleadingly specific-looking string.
    if (err instanceof TrackingRejectedError) return { error: err.message };
    throw err;
  }
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
