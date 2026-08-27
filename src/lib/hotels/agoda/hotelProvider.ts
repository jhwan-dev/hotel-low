import type { HotelCatalog, HotelCatalogEntry } from "@/lib/hotels/catalog";
import type { PriceHistoryRepository } from "@/lib/hotels/price-history-repository";
import type {
  HotelProvider,
  HotelSearchParams,
  HotelSearchResponse,
  HotelSearchResult,
  PriceHistoryRangeDays,
} from "@/types/hotel";
import { mapContentToHotel, mapPropertyToRoomPrice } from "./mapper";
import type { AgodaRepository } from "./repository";

const DEFAULT_ROOMS = 1;
const DEFAULT_ADULTS = 2;

/**
 * The app's HotelProvider, built from three independently swappable sources:
 *  - `repository` — live price + hotel content, today MockAgodaRepository,
 *    tomorrow a real Agoda HTTP client.
 *  - `catalog`    — resolves a free-text destination to Agoda hotel ids,
 *    today MockHotelCatalog reading mock-data.ts, tomorrow Supabase `hotels`.
 *  - `historyRepository` — the price graph's data, today generated
 *    deterministically, tomorrow Supabase `hotel_price_history`.
 * None of search/detail/tracking code needs to change when any one of these
 * three swaps to a real backend — only the wiring in ../index.ts does.
 */
export class AgodaHotelProvider implements HotelProvider {
  constructor(
    private readonly repository: AgodaRepository,
    private readonly catalog: HotelCatalog,
    private readonly historyRepository: PriceHistoryRepository,
  ) {}

  private async resolve(
    entries: HotelCatalogEntry[],
    params: HotelSearchParams,
  ): Promise<HotelSearchResult[]> {
    if (entries.length === 0) return [];

    const agodaHotelIds = entries.map((e) => e.agodaHotelId);
    const [contents, availability] = await Promise.all([
      this.repository.getHotelContent(agodaHotelIds),
      this.repository.searchAvailability({
        criteria: {
          propertyIds: agodaHotelIds,
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          rooms: params.rooms ?? DEFAULT_ROOMS,
          adults: params.adults ?? DEFAULT_ADULTS,
          children: params.children,
          childrenAges: params.childrenAges,
          currency: "KRW",
          language: "ko-kr",
        },
      }),
    ]);

    const results: HotelSearchResult[] = [];
    for (const entry of entries) {
      const content = contents.find((c) => c.hotelId === entry.agodaHotelId);
      const property = availability.properties.find((p) => p.propertyId === entry.agodaHotelId);
      if (!content || !property) continue;

      const price = mapPropertyToRoomPrice(
        property,
        entry.appHotelId,
        params.checkIn,
        params.checkOut,
      );
      if (!price) continue;

      results.push({
        hotel: mapContentToHotel(content, entry.appHotelId, entry.aliases, entry.description),
        price,
      });
    }
    return results;
  }

  async search(params: HotelSearchParams): Promise<HotelSearchResponse> {
    const entries = this.catalog.findByDestination(params.destination);
    const results = await this.resolve(entries, params);
    return { params, results, totalCount: results.length };
  }

  async getHotelById(id: string, params: HotelSearchParams): Promise<HotelSearchResult | null> {
    const entry = this.catalog.findByAppHotelId(id);
    if (!entry) return null;

    const [result] = await this.resolve([entry], params);
    return result ?? null;
  }

  async getPriceHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
  ) {
    return this.historyRepository.getHistory(hotelId, checkIn, checkOut, days);
  }
}
