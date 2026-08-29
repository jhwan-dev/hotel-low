import "server-only";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type { PriceTrackingSettings } from "@/types/tracking";
import { trackedHotelsRepository } from "./index";

/** For Server Components — fetches the signed-in user's active tracking for one stay, if any. */
export async function getMyTrackingStatus(
  hotelId: string,
  checkIn: string,
  checkOut: string,
): Promise<PriceTrackingSettings | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return trackedHotelsRepository.findActive(user.id, hotelId, checkIn, checkOut);
}

/** For Server Components — the signed-in user's full tracked-hotel list, or [] if signed out. */
export async function getMyTrackedHotels(): Promise<PriceTrackingSettings[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return trackedHotelsRepository.listActive(user.id);
}
