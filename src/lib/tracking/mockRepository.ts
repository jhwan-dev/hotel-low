import type { PriceTrackingSettings } from "@/types/tracking";
import type { TrackedHotelsRepository, TrackingInput } from "./repository";

function matches(row: PriceTrackingSettings, hotelId: string, checkIn: string, checkOut: string) {
  return row.hotelId === hotelId && row.checkIn === checkIn && row.checkOut === checkOut;
}

/**
 * In-memory stand-in for the tracked_hotels table. Lives for the lifetime of
 * the server process (persists across navigations in `next dev`, resets on
 * a fresh serverless instance in prod) — good enough for a mock, and it
 * intentionally ignores `userId` since there's no real multi-user session to
 * scope by until Supabase is connected.
 */
export class MockTrackedHotelsRepository implements TrackedHotelsRepository {
  private rows: PriceTrackingSettings[] = [];

  async findActive(
    _userId: string,
    hotelId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<PriceTrackingSettings | null> {
    return this.rows.find((r) => matches(r, hotelId, checkIn, checkOut)) ?? null;
  }

  async listActive(_userId: string): Promise<PriceTrackingSettings[]> {
    return [...this.rows];
  }

  async upsert(_userId: string, input: TrackingInput): Promise<PriceTrackingSettings> {
    const index = this.rows.findIndex((r) =>
      matches(r, input.hotelId, input.checkIn, input.checkOut),
    );
    const row: PriceTrackingSettings = { ...input };
    if (index >= 0) {
      this.rows[index] = row;
    } else {
      this.rows.push(row);
    }
    return row;
  }

  async deactivate(
    _userId: string,
    hotelId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<void> {
    this.rows = this.rows.filter((r) => !matches(r, hotelId, checkIn, checkOut));
  }
}
