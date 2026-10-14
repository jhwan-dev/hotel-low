import type { HotelProvider } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";
import { defaultTargetPrice } from "./targetPrice";
import { TrackingRejectedError, type TrackedHotelsRepository, type TrackingInput, type TrackingUpsertResult } from "./repository";

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

  constructor(private readonly provider: HotelProvider) {}

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

  async upsert(_userId: string, input: TrackingInput): Promise<TrackingUpsertResult> {
    // The mock/Agoda provider's fetchLivePrice() just delegates to
    // getHotelById() and never returns null, unlike the real SerpApi
    // provider — so this never hits the "no price at all" rejection, but
    // still goes through the same live-check-then-validate shape so the two
    // repositories behave identically from the caller's point of view.
    const price = await this.provider.fetchLivePrice(input.hotelId, {
      destination: "",
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      rooms: input.rooms,
    });
    if (!price) throw new TrackingRejectedError("이 숙소는 현재 가격을 확인할 수 없어요");

    const targetPrice = input.targetPrice ?? defaultTargetPrice(price.totalPrice);
    if (targetPrice <= 0 || targetPrice >= price.totalPrice) {
      throw new TrackingRejectedError("목표 가격은 현재 가격보다 낮아야 해요");
    }

    const index = this.rows.findIndex((r) =>
      matches(r, input.hotelId, input.checkIn, input.checkOut),
    );
    // Preserve the original trackingStartedAt across a settings edit
    // (update) — only a fresh tracking (no existing row) gets a new one.
    const trackingStartedAt = index >= 0 ? this.rows[index].trackingStartedAt : new Date().toISOString();
    const row: PriceTrackingSettings = { ...input, targetPrice, trackingStartedAt };
    if (index >= 0) {
      this.rows[index] = row;
    } else {
      this.rows.push(row);
    }
    return { settings: row, price };
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
