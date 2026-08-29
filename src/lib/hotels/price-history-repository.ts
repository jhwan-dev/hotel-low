import "server-only";

import { addDaysISO, todayISO } from "@/lib/date";
import type { HotelCatalog } from "@/lib/hotels/catalog";
import { mockHotels } from "@/lib/hotels/mock-data";
import { priceCheckedOn } from "@/lib/hotels/mock-pricing";
import { createClient } from "@/lib/supabase/server";
import { findHotelRowId } from "@/lib/supabase/hotelsTable";
import type { Currency, PriceHistory, PriceHistoryRangeDays } from "@/types/hotel";

/**
 * Agoda's Search API has no "price history" endpoint — it only ever answers
 * "what's the price right now". The price graph is our own product's data,
 * built by polling Search API for each tracked stay and logging the result
 * into Supabase `hotel_price_history` (see supabase/migrations/0001_init.sql).
 * This repository is that log's read side; MockPriceHistoryRepository fakes
 * it deterministically today, and a SupabasePriceHistoryRepository can
 * replace it later without touching anything that calls getPriceHistory.
 */
export interface PriceHistoryRepository {
  getHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
  ): Promise<PriceHistory | null>;
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
  ): Promise<PriceHistory | null> {
    const entry = this.catalog.findByAppHotelId(hotelId);
    if (!entry) return this.fallback.getHistory(hotelId, checkIn, checkOut, days);

    const supabase = await createClient();
    const hotelRowId = await findHotelRowId(supabase, "agoda", entry.agodaHotelId);
    if (!hotelRowId) return this.fallback.getHistory(hotelId, checkIn, checkOut, days);

    const since = addDaysISO(todayISO(), -(days - 1));
    const { data, error } = await supabase
      .from("hotel_price_history")
      .select("checked_at, price, currency")
      .eq("hotel_id", hotelRowId)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut)
      .gte("checked_at", since)
      .order("checked_at", { ascending: true });
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
}
