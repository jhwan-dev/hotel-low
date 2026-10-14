import { nightsBetween, todayISO } from "@/lib/date";
import type { HotelCatalog, HotelCatalogEntry } from "@/lib/hotels/catalog";
import type { LatestPrice, PriceHistoryRepository } from "@/lib/hotels/price-history-repository";
import type {
  Hotel,
  HotelProvider,
  HotelSearchParams,
  HotelSearchResponse,
  HotelSearchResult,
  PartySize,
  PriceHistoryRangeDays,
  RoomPrice,
} from "@/types/hotel";
import { getPropertyDetails } from "./client";
import { buildBookingUrl, extractAddress, extractAgodaHid, extractName, mapDetailToRoomPrice } from "./mapper";

const DEFAULT_ROOMS = 1;
const DEFAULT_ADULTS = 2;
const DEFAULT_CHILDREN = 0;

function entryToHotel(entry: HotelCatalogEntry): Hotel {
  return {
    id: entry.appHotelId,
    name: entry.name,
    location: { city: entry.city, country: entry.country, address: entry.address },
    rating: entry.rating,
    reviewCount: entry.reviewCount,
    images: entry.images,
    amenities: entry.amenities,
    description: entry.description,
    aliases: entry.aliases,
  };
}

function resolvePartySize(params: HotelSearchParams): PartySize {
  return {
    adults: params.adults ?? DEFAULT_ADULTS,
    children: params.children ?? DEFAULT_CHILDREN,
    rooms: params.rooms ?? DEFAULT_ROOMS,
  };
}

/**
 * The Supabase-catalog-backed HotelProvider. `search`/`getHotelById` never
 * call SerpApi — they read the catalog plus whatever hotel_price_history
 * already has for this exact stay, or `price: null` ("가격 확인 전") if
 * nothing's been checked yet. `fetchLivePrice` is the only method that
 * actually spends a SerpApi call; callers (tracking-start, the price-check
 * cron) own rate-limiting and persisting the result — see
 * src/lib/serpapi/callBudget.ts and priceHistoryRepository.recordPrice.
 */
export class SerpApiHotelProvider implements HotelProvider {
  constructor(
    private readonly catalog: HotelCatalog,
    private readonly historyRepository: PriceHistoryRepository,
  ) {}

  /** Builds the search-result shape from an already-fetched LatestPrice (or null) — no query of its own, so both the single-hotel and batched callers below can share it. */
  private buildResult(
    entry: HotelCatalogEntry,
    params: HotelSearchParams,
    partySize: PartySize,
    latest: LatestPrice | null,
  ): HotelSearchResult {
    const hotel = entryToHotel(entry);
    if (!latest) return { hotel, price: null };

    const nights = nightsBetween(params.checkIn, params.checkOut);
    const booking = buildBookingUrl(
      { hid: entry.agodaHid, detailPath: entry.agodaDetailPath },
      { ...partySize, checkIn: params.checkIn, checkOut: params.checkOut, childrenAges: params.childrenAges },
    );
    const price: RoomPrice = {
      hotelId: entry.appHotelId,
      provider: latest.provider,
      currency: latest.currency,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      nights,
      nightlyPrice: latest.nightlyPrice,
      totalPrice: latest.nightlyPrice * nights * partySize.rooms,
      checkedAt: latest.checkedAt,
      deepLink: booking?.url,
      deepLinkKind: booking?.kind,
    };
    return { hotel, price };
  }

  private async resolveFromStorage(
    entry: HotelCatalogEntry,
    params: HotelSearchParams,
  ): Promise<HotelSearchResult> {
    const partySize = resolvePartySize(params);
    const latest = await this.historyRepository.getLatestPrice(
      entry.appHotelId,
      params.checkIn,
      params.checkOut,
      partySize,
    );
    return this.buildResult(entry, params, partySize, latest);
  }

  /**
   * One Supabase round-trip for every hotel in the destination combined —
   * was previously one `resolveFromStorage` (and so one getLatestPrice)
   * *per hotel*, up to ~100 for a single city. findByDestination and
   * getLatestPricesForHotels are the only two queries this makes
   * regardless of how many hotels that city has.
   */
  async search(params: HotelSearchParams): Promise<HotelSearchResponse> {
    const entries = await this.catalog.findByDestination(params.destination);
    const partySize = resolvePartySize(params);
    const latestByHotel = await this.historyRepository.getLatestPricesForHotels(
      entries.map((e) => e.appHotelId),
      params.checkIn,
      params.checkOut,
      partySize,
    );
    const results = entries.map((entry) =>
      this.buildResult(entry, params, partySize, latestByHotel.get(entry.appHotelId) ?? null),
    );
    return { params, results, totalCount: results.length };
  }

  async getHotelById(id: string, params: HotelSearchParams): Promise<HotelSearchResult | null> {
    const entry = await this.catalog.findByAppHotelId(id);
    if (!entry) return null;
    return this.resolveFromStorage(entry, params);
  }

  async fetchLivePrice(id: string, params: HotelSearchParams): Promise<RoomPrice | null> {
    const entry = await this.catalog.findByAppHotelId(id);
    if (!entry) return null;

    const partySize = resolvePartySize(params);
    const detail = await getPropertyDetails({
      q: `${entry.city} Hotels`,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: partySize.adults,
      children: partySize.children,
      propertyToken: entry.providerHotelId,
    });

    const mapped = mapDetailToRoomPrice(detail, id, params.checkIn, params.checkOut, partySize.rooms);
    if (!mapped) return null;

    const booking = buildBookingUrl(
      { hid: entry.agodaHid, detailPath: entry.agodaDetailPath },
      { ...partySize, checkIn: params.checkIn, checkOut: params.checkOut, childrenAges: params.childrenAges },
    );
    return {
      ...mapped,
      checkedAt: todayISO(),
      deepLink: booking?.url,
      deepLinkKind: booking?.kind,
      detailAddress: extractAddress(detail),
      detailAgodaHid: extractAgodaHid(detail),
      detailName: extractName(detail),
    };
  }

  async getPriceHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
    partySize?: PartySize,
  ) {
    return this.historyRepository.getHistory(hotelId, checkIn, checkOut, days, partySize);
  }
}
