import "server-only";

import { addDaysISO, todayISO } from "@/lib/date";
import type { HotelCatalog } from "@/lib/hotels/catalog";
import { mockHotels } from "@/lib/hotels/mock-data";
import { priceCheckedOn } from "@/lib/hotels/mock-pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findHotelRowId } from "@/lib/supabase/hotelsTable";
import type {
  Currency,
  PartySize,
  PriceHistory,
  PriceHistoryRangeDays,
  PriceProvider,
} from "@/types/hotel";

export interface LatestPrice {
  nightlyPrice: number;
  currency: Currency;
  checkedAt: string;
  provider: PriceProvider;
}

export interface RecordPriceInput extends PartySize {
  /** App catalog id (what hotelProvider.getHotelById expects), not the Supabase hotels.id. */
  hotelId: string;
  checkIn: string;
  checkOut: string;
  /** One room, one night — same basis as RoomPrice.nightlyPrice, not the full-stay total. */
  price: number;
  currency: Currency;
  provider: PriceProvider;
  bookingUrl?: string;
}

/**
 * Agoda's Search API has no "price history" endpoint — it only ever answers
 * "what's the price right now". The price graph is our own product's data,
 * built by polling Search API for each tracked stay and logging the result
 * into Supabase `hotel_price_history` (see supabase/migrations/0001_init.sql).
 * This repository is that log's read+write side; MockPriceHistoryRepository
 * fakes reads deterministically today (and doesn't need to persist writes),
 * SupabasePriceHistoryRepository is the real log.
 */
export interface PriceHistoryRepository {
  getHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
    partySize?: PartySize,
  ): Promise<PriceHistory | null>;

  /** Appends today's price check. Called once per (hotel, dates, party size) by the price-check job — see src/lib/notifications/checkPriceAlerts.ts. */
  recordPrice(entry: RecordPriceInput): Promise<void>;

  /**
   * Most recently recorded price for this EXACT (hotel, checkIn, checkOut,
   * partySize) — no fallback to a near match or a different party size.
   * This is what search()/getHotelById() show instead of ever calling a
   * live price API — see src/lib/hotels/serpapi/provider.ts.
   */
  getLatestPrice(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    partySize: PartySize,
  ): Promise<LatestPrice | null>;
}

export class MockPriceHistoryRepository implements PriceHistoryRepository {
  async getHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
  ): Promise<PriceHistory | null> {
    const mock = mockHotels.find((h) => h.id === hotelId);
    if (!mock) return null;

    const today = todayISO();
    const currency: Currency = "KRW";
    const points = Array.from({ length: days }, (_, i) => {
      const checkedAt = addDaysISO(today, i - (days - 1));
      const price = priceCheckedOn(mock.id, mock.basePrice, checkIn, checkOut, checkedAt);
      return { checkedAt, price };
    });

    return { hotelId, checkIn, checkOut, currency, points };
  }

  /** The mock generator is deterministic from (hotelId, checkIn, checkOut, checkedAt) alone — there's nowhere to persist a write that getHistory would ever read back, so this is intentionally a no-op. */
  async recordPrice(): Promise<void> {}

  /** Mock mode never runs behind SerpApiHotelProvider (the only caller of this method) — unreachable in practice, but implemented for interface completeness. */
  async getLatestPrice(): Promise<LatestPrice | null> {
    return null;
  }
}

/**
 * Reads Supabase's hotel_price_history — public SELECT policy, so the
 * session/anon client is enough. Nothing writes to this table yet (that's a
 * scheduled price-check job we haven't built), so for any stay Supabase has
 * no rows for yet, this falls back to the same deterministic mock generator
 * MockPriceHistoryRepository uses — real rows win the moment they exist.
 */
export class SupabasePriceHistoryRepository implements PriceHistoryRepository {
  private readonly fallback = new MockPriceHistoryRepository();

  constructor(private readonly catalog: HotelCatalog) {}

  async getHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
    partySize?: PartySize,
  ): Promise<PriceHistory | null> {
    const entry = await this.catalog.findByAppHotelId(hotelId);
    if (!entry) return this.fallback.getHistory(hotelId, checkIn, checkOut, days);

    const supabase = await createClient();
    const hotelRowId = await findHotelRowId(supabase, "agoda", entry.providerHotelId);
    if (!hotelRowId) return this.fallback.getHistory(hotelId, checkIn, checkOut, days);

    const since = addDaysISO(todayISO(), -(days - 1));
    let query = supabase
      .from("hotel_price_history")
      .select("checked_at, price, currency")
      .eq("hotel_id", hotelRowId)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut)
      .gte("checked_at", since);
    if (partySize) {
      query = query
        .eq("adults", partySize.adults)
        .eq("children", partySize.children)
        .eq("rooms", partySize.rooms);
    }
    const { data, error } = await query.order("checked_at", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return this.fallback.getHistory(hotelId, checkIn, checkOut, days);

    return {
      hotelId,
      checkIn,
      checkOut,
      currency: data[0].currency as Currency,
      points: data.map((row) => ({
        checkedAt: String(row.checked_at).slice(0, 10),
        price: Number(row.price),
      })),
    };
  }

  /** Writes always go through the admin client — hotel_price_history has no INSERT policy for anon/authenticated (see supabase/migrations/0001_init.sql), only service_role. */
  async recordPrice(entry: RecordPriceInput): Promise<void> {
    const catalogEntry = await this.catalog.findByAppHotelId(entry.hotelId);
    if (!catalogEntry) return;

    const admin = createAdminClient();
    const hotelRowId = await findHotelRowId(admin, "agoda", catalogEntry.providerHotelId);
    if (!hotelRowId) return;

    const { error } = await admin.from("hotel_price_history").insert({
      hotel_id: hotelRowId,
      check_in: entry.checkIn,
      check_out: entry.checkOut,
      adults: entry.adults,
      children: entry.children,
      rooms: entry.rooms,
      provider: entry.provider,
      price: entry.price,
      currency: entry.currency,
      booking_url: entry.bookingUrl ?? null,
    });
    if (error) throw error;
  }

  async getLatestPrice(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    partySize: PartySize,
  ): Promise<LatestPrice | null> {
    const entry = await this.catalog.findByAppHotelId(hotelId);
    if (!entry) return null;

    const supabase = await createClient();
    const hotelRowId = await findHotelRowId(supabase, "agoda", entry.providerHotelId);
    if (!hotelRowId) return null;

    const { data, error } = await supabase
      .from("hotel_price_history")
      .select("price, currency, checked_at, provider")
      .eq("hotel_id", hotelRowId)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut)
      .eq("adults", partySize.adults)
      .eq("children", partySize.children)
      .eq("rooms", partySize.rooms)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      nightlyPrice: Number(data.price),
      currency: data.currency as Currency,
      checkedAt: String(data.checked_at),
      provider: data.provider as PriceProvider,
    };
  }
}
