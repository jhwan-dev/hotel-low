import type { PriceTrackingSettings } from "@/types/tracking";

/** Thrown by TrackedHotelsRepository.upsert for a reason the user should see verbatim (e.g. "이 숙소는 현재 아고다 가격을 확인할 수 없어요") — src/lib/tracking/actions.ts catches this specifically and turns it into a TrackingActionError, unlike any other thrown error. */
export class TrackingRejectedError extends Error {}

export type TrackingInput = Pick<
  PriceTrackingSettings,
  | "hotelId"
  | "checkIn"
  | "checkOut"
  | "adults"
  | "children"
  | "rooms"
  | "currency"
  | "targetPrice"
  | "notifyOnAnyDrop"
  | "notifyOnNewLow"
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

  /** Every active tracking for this user, most recent first — the "내 추적 목록" page. */
  listActive(userId: string): Promise<PriceTrackingSettings[]>;

  /** Creates a new active tracking, or updates the existing active one for the same (hotel, stay). */
  upsert(userId: string, input: TrackingInput): Promise<PriceTrackingSettings>;

  /** Soft-delete: marks the tracking inactive rather than removing history. */
  deactivate(userId: string, hotelId: string, checkIn: string, checkOut: string): Promise<void>;
}
