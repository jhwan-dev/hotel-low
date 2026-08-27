import type { PriceTrackingSettings } from "@/types/tracking";

export type TrackingInput = Pick<
  PriceTrackingSettings,
  "hotelId" | "checkIn" | "checkOut" | "currency" | "targetPrice" | "notifyOnAnyDrop" | "notifyOnNewLow"
>;

/**
 * Swap point for tracked_hotels: MockTrackedHotelsRepository (in-memory,
 * single-process) today, SupabaseTrackedHotelsRepository (RLS-scoped to the
 * signed-in user) once a project is connected. Everything above this
 * interface — the Server Actions in ./actions.ts, PriceTrackingCta — is
 * identical either way.
 */
export interface TrackedHotelsRepository {
  findActive(
    userId: string,
    hotelId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<PriceTrackingSettings | null>;

  /** Creates a new active tracking, or updates the existing active one for the same (hotel, stay). */
  upsert(userId: string, input: TrackingInput): Promise<PriceTrackingSettings>;

  /** Soft-delete: marks the tracking inactive rather than removing history. */
  deactivate(userId: string, hotelId: string, checkIn: string, checkOut: string): Promise<void>;
}
