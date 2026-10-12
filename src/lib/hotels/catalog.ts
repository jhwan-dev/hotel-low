import { mockHotels } from "@/lib/hotels/mock-data";

/**
 * A directory entry mapping our own stable hotel id (used in URLs, tracking,
 * etc.) to the id a provider's API actually understands. Agoda's real Search
 * API takes `criteria.propertyIds` — a list of *their* numeric hotel ids —
 * not a free-text destination, so "search by city" has to be resolved
 * locally first. In production this table is the Supabase `hotels` table
 * (populated ahead of time from Agoda's Content API / Hotel Data Feed);
 * MockHotelCatalog stands in for that today.
 */
export interface HotelCatalogEntry {
  appHotelId: string;
  /** The provider's own opaque id for this hotel — Agoda's numeric hotel id today, a SerpApi `property_token` once that's the live source. Always carried as a string since not every provider's id is numeric. */
  providerHotelId: string;
  name: string;
  city: string;
  country: string;
  address: string;
  rating: number;
  reviewCount: number;
  images: string[];
  amenities: string[];
  aliases: string[];
  /** Agoda's Content API has no free-text description field — this is our own editorial copy, stored locally. */
  description: string;
  /** Agoda's own numeric hotel id, decoded from a cached SerpApi response's pcurl — see scripts/fill-agoda-hid.ts. Only the search-results fallback link needs it (buildBookingUrl in src/lib/hotels/serpapi/mapper.ts); undefined/null in mock mode. */
  agodaHid?: string | null;
  /** Path portion of Agoda's real detail page (no leading slash, no locale prefix) — filled in by hand, see scripts/import-agoda-detail-urls.ts. Undefined/null in mock mode or before someone's filled it in. */
  agodaDetailPath?: string | null;
  /** From SerpApi's list response (gps_coordinates) at seed time — see scripts/seed-hotel-catalog.ts. Null for the original 22-hotel catalog, seeded before this column existed. */
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Async because a real catalog is a database table (Supabase `hotels`) —
 * MockHotelCatalog's in-memory lookups are synchronous underneath, but
 * `async` methods wrap that transparently, so callers always `await`
 * regardless of which implementation is wired in.
 */
export interface HotelCatalog {
  findByDestination(destination: string): Promise<HotelCatalogEntry[]>;
  findByAppHotelId(appHotelId: string): Promise<HotelCatalogEntry | null>;
  /** Reverse lookup — Supabase's `hotels` row only stores the provider's own id, so listing a user's tracked hotels needs this to get back to our own app id. */
  findByProviderHotelId(providerHotelId: string): Promise<HotelCatalogEntry | null>;
  /** Every cataloged hotel — home-page curation (e.g. "recent price drops") scans this rather than one destination. */
  listAll(): Promise<HotelCatalogEntry[]>;
}

function toEntry(mock: (typeof mockHotels)[number]): HotelCatalogEntry {
  return {
    appHotelId: mock.id,
    providerHotelId: String(mock.agodaHotelId),
    name: mock.name,
    city: mock.location.city,
    country: mock.location.country,
    address: mock.location.address,
    rating: mock.rating,
    reviewCount: mock.reviewCount,
    images: mock.images,
    amenities: mock.amenities,
    aliases: mock.aliases,
    description: mock.description,
  };
}

export class MockHotelCatalog implements HotelCatalog {
  async findByDestination(destination: string): Promise<HotelCatalogEntry[]> {
    const q = destination.trim().toLowerCase();
    if (!q) return [];

    return mockHotels
      .filter(
        (mock) =>
          mock.location.city.toLowerCase().includes(q) ||
          mock.location.country.toLowerCase().includes(q) ||
          mock.name.toLowerCase().includes(q) ||
          mock.aliases.some((alias) => alias.toLowerCase().includes(q)),
      )
      .map(toEntry);
  }

  async findByAppHotelId(appHotelId: string): Promise<HotelCatalogEntry | null> {
    const mock = mockHotels.find((h) => h.id === appHotelId);
    return mock ? toEntry(mock) : null;
  }

  async findByProviderHotelId(providerHotelId: string): Promise<HotelCatalogEntry | null> {
    const mock = mockHotels.find((h) => String(h.agodaHotelId) === providerHotelId);
    return mock ? toEntry(mock) : null;
  }

  async listAll(): Promise<HotelCatalogEntry[]> {
    return mockHotels.map(toEntry);
  }
}
