import { addDaysISO, nightsBetween, todayISO } from "@/lib/date";
import { mockHotels, type MockHotel } from "@/lib/hotels/mock-data";
import type {
  Hotel,
  HotelProvider,
  HotelSearchParams,
  HotelSearchResult,
  PriceHistory,
  PriceHistoryRangeDays,
  RoomPrice,
} from "@/types/hotel";

/** FNV-1a 32-bit — turns a hotel id into a stable per-hotel seed. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Well-mixed 0..1 value from (hotelSeed, dayIndex). A plain string hash of
 * "id-2026-08-27" vs "id-2026-08-28" only differs in its last character, and
 * a naive polynomial hash barely moves between them — the resulting "history"
 * is a smooth ramp, not something that looks like a price chart. Mixing the
 * day index in as an integer with a full avalanche step (murmur3-style) fixes
 * that: consecutive days land far apart, like real daily price noise.
 */
function seededUnit(hotelSeed: number, dayIndex: number): number {
  let h = (hotelSeed ^ Math.imul(dayIndex, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function dayIndexOf(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

function toHotel(mock: MockHotel): Hotel {
  const { basePrice: _basePrice, ...hotel } = mock;
  return hotel;
}

/** Nightly price for a single calendar date — the one source of truth shared by search pricing and price history. */
function priceForDate(mock: MockHotel, date: string): number {
  const hotelSeed = hashString(mock.id);
  const dayIndex = dayIndexOf(date);

  const noise = seededUnit(hotelSeed, dayIndex) * 2 - 1; // [-1, 1], day-to-day jitter
  const period = 12 + (hotelSeed % 20); // 12–31 day demand cycle, per hotel
  const phase = ((hotelSeed >>> 8) % 1000) / 1000;
  const wave = Math.sin(dayIndex / period + phase * Math.PI * 2); // slow trend

  const fluctuation = 1 + noise * 0.08 + wave * 0.07;
  return Math.round((mock.basePrice * fluctuation) / 100) * 100;
}

function priceFor(mock: MockHotel, params: HotelSearchParams): RoomPrice {
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const nightlyPrices = Array.from({ length: nights }, (_, i) =>
    priceForDate(mock, addDaysISO(params.checkIn, i)),
  );
  const totalPrice = nightlyPrices.reduce((sum, p) => sum + p, 0);
  const nightlyPrice = Math.round(totalPrice / nights / 100) * 100;

  return {
    hotelId: mock.id,
    provider: "mock",
    currency: "KRW",
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights,
    nightlyPrice,
    totalPrice,
    deepLink: `https://example.com/mock-booking/agoda/${mock.id}?checkIn=${params.checkIn}&checkOut=${params.checkOut}`,
  };
}

function historyFor(mock: MockHotel, days: PriceHistoryRangeDays): PriceHistory {
  const today = todayISO();
  const points = Array.from({ length: days }, (_, i) => {
    const date = addDaysISO(today, i - (days - 1));
    return { date, price: priceForDate(mock, date) };
  });

  return {
    hotelId: mock.id,
    currency: "KRW",
    points,
  };
}

function matches(mock: MockHotel, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    mock.location.city.toLowerCase().includes(q) ||
    mock.location.country.toLowerCase().includes(q) ||
    mock.name.toLowerCase().includes(q) ||
    mock.aliases.some((alias) => alias.toLowerCase().includes(q))
  );
}

export const mockHotelProvider: HotelProvider = {
  async search(params: HotelSearchParams) {
    const matched = mockHotels.filter((mock) => matches(mock, params.destination));
    const results: HotelSearchResult[] = matched.map((mock) => ({
      hotel: toHotel(mock),
      price: priceFor(mock, params),
    }));

    return {
      params,
      results,
      totalCount: results.length,
    };
  },

  async getHotelById(id: string, params: HotelSearchParams) {
    const mock = mockHotels.find((h) => h.id === id);
    if (!mock) return null;

    return {
      hotel: toHotel(mock),
      price: priceFor(mock, params),
    };
  },

  async getPriceHistory(hotelId: string, days: PriceHistoryRangeDays) {
    const mock = mockHotels.find((h) => h.id === hotelId);
    if (!mock) return null;

    return historyFor(mock, days);
  },
};
