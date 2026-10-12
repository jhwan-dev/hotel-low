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
    // A deliberate, user-facing rejection (rate limit, no Agoda price,
    // invalid target) becomes its own message. Anything else — a Postgres
    // error, an unknown-hotel bug, a network blip calling SerpApi — used to
    // rethrow here, which crosses the Server Action boundary as an
    // uncaught exception. That doesn't reach PriceTrackingSheet's error
    // prop at all: depending on the failure it either blanks the page via
    // Next's error boundary, or — thrown from inside a plain async
    // startTransition callback with nothing awaiting/catching it — just
    // logs to console with the UI left exactly as it was, which is
    // indistinguishable from the button silently doing nothing. Convert
    // every other error to a generic message instead, so the sheet always
    // shows *something*; the real cause still goes to the server log.
    if (err instanceof TrackingRejectedError) return { error: err.message };
    console.error("startTracking: unexpected error", err);
    return { error: "추적을 시작하지 못했어요. 잠시 후 다시 시도해주세요." };
  }
}

export async function stopTracking(
  hotelId: string,
  checkIn: string,
  checkOut: string,
): Promise<{ ok: true } | TrackingActionError> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  try {
    await trackedHotelsRepository.deactivate(user.id, hotelId, checkIn, checkOut);
    return { ok: true };
  } catch (err) {
    console.error("stopTracking: unexpected error", err);
    return { error: "추적을 중지하지 못했어요. 잠시 후 다시 시도해주세요." };
  }
}
