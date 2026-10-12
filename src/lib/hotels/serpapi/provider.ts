import { nightsBetween, todayISO } from "@/lib/date";
import type { HotelCatalog, HotelCatalogEntry } from "@/lib/hotels/catalog";
import type { PriceHistoryRepository } from "@/lib/hotels/price-history-repository";
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
import { buildBookingUrl, mapDetailToRoomPrice } from "./mapper";

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

  private async resolveFromStorage(
    entry: HotelCatalogEntry,
    params: HotelSearchParams,
  ): Promise<HotelSearchResult> {
    const hotel = entryToHotel(entry);
    const partySize = resolvePartySize(params);
    const latest = await this.historyRepository.getLatestPrice(
      entry.appHotelId,
      params.checkIn,
      params.checkOut,
      partySize,
    );
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

  async search(params: HotelSearchParams): Promise<HotelSearchResponse> {
    const entries = await this.catalog.findByDestination(params.destination);
    const results = await Promise.all(entries.map((e) => this.resolveFromStorage(e, params)));
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
    return { ...mapped, checkedAt: todayISO(), deepLink: booking?.url, deepLinkKind: booking?.kind };
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
