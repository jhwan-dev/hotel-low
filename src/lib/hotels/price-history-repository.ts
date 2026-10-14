import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO, todayISO } from "@/lib/date";
import type { HotelCatalog } from "@/lib/hotels/catalog";
import { mockHotels } from "@/lib/hotels/mock-data";
import { priceCheckedOn } from "@/lib/hotels/mock-pricing";
import { SupabaseHotelCatalog } from "@/lib/hotels/supabaseCatalog";
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
    /** ISO timestamp — only points recorded at/after this are returned (see HotelProvider.getPriceHistory). */
    since?: string,
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

  /**
   * Batched getLatestPrice — one round-trip for every hotel in `hotelIds`
   * instead of one per hotel. SerpApiHotelProvider.search() is the only
   * caller (one city can be ~100 catalog entries); a hotel with no stored
   * price for this exact stay just has no entry in the returned Map.
   */
  getLatestPricesForHotels(
    hotelIds: string[],
    checkIn: string,
    checkOut: string,
    partySize: PartySize,
  ): Promise<Map<string, LatestPrice>>;
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

  /** Same unreachable-in-practice note as getLatestPrice above. */
  async getLatestPricesForHotels(): Promise<Map<string, LatestPrice>> {
    return new Map();
  }
}

/**
 * Reads Supabase's hotel_price_history — public SELECT policy, so the
 * session/anon client is enough. Writes come from the price-check cron
 * and from tracking-start's own one-time live check (see
 * src/lib/tracking/supabaseRepository.ts's upsert()). There is no mock/
 * fabricated fallback here — a stay nobody's ever actually tracked
 * genuinely has no history, and the UI (hotels/[id]/page.tsx) is expected
 * to show "추적을 시작하면..." instead of calling this at all in that case,
 * not a fake graph.
 */
export class SupabasePriceHistoryRepository implements PriceHistoryRepository {
  /** SupabaseHotelCatalog.toEntry() sets appHotelId: row.id — when this is the catalog in use, hotelId already *is* the hotels.id row id, so resolveHotelRowId can skip the catalog+findHotelRowId round trip entirely. See that method for the (rare) case where it can't. */
  private readonly isSupabaseCatalog: boolean;

  constructor(private readonly catalog: HotelCatalog) {
    this.isSupabaseCatalog = catalog instanceof SupabaseHotelCatalog;
  }

  /**
   * Was 2 extra Supabase round-trips per call (catalog.findByAppHotelId +
   * findHotelRowId) to re-derive a value callers already had — appHotelId
   * only needs translating when the catalog *isn't* Supabase-backed (the
   * Supabase-price-history-with-mock-catalog hybrid isSupabaseConfigured()
   * && !isSerpApiConfigured() allows — see src/lib/hotels/index.ts). That
   * hybrid is the only case this method still does the translation for.
   */
  private async resolveHotelRowId(
    client: SupabaseClient,
    hotelId: string,
  ): Promise<string | null> {
    if (this.isSupabaseCatalog) return hotelId;
    const entry = await this.catalog.findByAppHotelId(hotelId);
    if (!entry) return null;
    return findHotelRowId(client, "agoda", entry.providerHotelId);
  }

  async getHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
    partySize?: PartySize,
    since?: string,
  ): Promise<PriceHistory | null> {
    const supabase = await createClient();
    const hotelRowId = await this.resolveHotelRowId(supabase, hotelId);
    // No matching hotel row, or (below) no rows yet: a stay nobody's
    // actually tracked/checked a real price for genuinely has no history —
    // return it empty rather than null, so callers don't mistake "no
    // history yet" (normal — see HotelProvider.fetchLivePrice) for "hotel
    // not found" (the bug every never-tracked catalog hotel's detail page
    // 404 used to be).
    if (!hotelRowId) return { hotelId, checkIn, checkOut, currency: "KRW", points: [] };

    // The day-range window (days) and the tracking-start floor (since) are
    // both lower bounds on checked_at — use whichever is later, so a
    // long-running tracking still respects the 7/30/90-day toggle, and a
    // freshly-started one never reaches back before it began.
    const sinceDays = addDaysISO(todayISO(), -(days - 1));
    const effectiveSince = since && since > sinceDays ? since : sinceDays;

    let query = supabase
      .from("hotel_price_history")
      .select("checked_at, price, currency")
      .eq("hotel_id", hotelRowId)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut)
      .gte("checked_at", effectiveSince);
    if (partySize) {
      query = query
        .eq("adults", partySize.adults)
        .eq("children", partySize.children)
        .eq("rooms", partySize.rooms);
    }
    const { data, error } = await query.order("checked_at", { ascending: true });
    if (error) throw error;

    return {
      hotelId,
      checkIn,
      checkOut,
      currency: (data?.[0]?.currency as Currency) ?? "KRW",
      points: (data ?? []).map((row) => ({
        checkedAt: String(row.checked_at).slice(0, 10),
        price: Number(row.price),
      })),
    };
  }

  /** Writes always go through the admin client — hotel_price_history has no INSERT policy for anon/authenticated (see supabase/migrations/0001_init.sql), only service_role. */
  async recordPrice(entry: RecordPriceInput): Promise<void> {
    const admin = createAdminClient();
    const hotelRowId = await this.resolveHotelRowId(admin, entry.hotelId);
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
    const supabase = await createClient();
    const hotelRowId = await this.resolveHotelRowId(supabase, hotelId);
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

  async getLatestPricesForHotels(
    hotelIds: string[],
    checkIn: string,
    checkOut: string,
    partySize: PartySize,
  ): Promise<Map<string, LatestPrice>> {
    if (hotelIds.length === 0) return new Map();

    // hotelIds are appHotelIds, used directly as hotel_price_history.hotel_id
    // with no per-id translation — safe because the only caller
    // (SerpApiHotelProvider.search()) only ever runs with a Supabase-backed
    // catalog (see src/lib/hotels/index.ts's useSerpApi), where appHotelId
    // already *is* the hotels.id row id (same fact resolveHotelRowId above
    // relies on).
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hotel_price_history")
      .select("hotel_id, price, currency, checked_at, provider")
      .in("hotel_id", hotelIds)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut)
      .eq("adults", partySize.adults)
      .eq("children", partySize.children)
      .eq("rooms", partySize.rooms)
      // Ascending so the last write per hotel_id below ends up being the
      // latest — no DISTINCT ON support in PostgREST's query builder.
      .order("checked_at", { ascending: true });
    if (error) throw error;

    const latestByHotel = new Map<string, LatestPrice>();
    for (const row of data ?? []) {
      latestByHotel.set(row.hotel_id, {
        nightlyPrice: Number(row.price),
        currency: row.currency as Currency,
        checkedAt: String(row.checked_at),
        provider: row.provider as PriceProvider,
      });
    }
    return latestByHotel;
  }
}
