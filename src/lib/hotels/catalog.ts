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
  agodaHotelId: number;
  name: string;
  city: string;
  country: string;
  aliases: string[];
  /** Agoda's Content API has no free-text description field — this is our own editorial copy, stored locally. */
  description: string;
}

export interface HotelCatalog {
  findByDestination(destination: string): HotelCatalogEntry[];
  findByAppHotelId(appHotelId: string): HotelCatalogEntry | null;
  /** Reverse lookup — Supabase's `hotels` row only stores the provider's numeric id, so listing a user's tracked hotels needs this to get back to our own app id. */
  findByAgodaHotelId(agodaHotelId: number): HotelCatalogEntry | null;
  /** Every cataloged hotel — home-page curation (e.g. "recent price drops") scans this rather than one destination. */
  listAll(): HotelCatalogEntry[];
}

function toEntry(mock: (typeof mockHotels)[number]): HotelCatalogEntry {
  return {
    appHotelId: mock.id,
    agodaHotelId: mock.agodaHotelId,
    name: mock.name,
    city: mock.location.city,
    country: mock.location.country,
    aliases: mock.aliases,
    description: mock.description,
  };
}

export class MockHotelCatalog implements HotelCatalog {
  findByDestination(destination: string): HotelCatalogEntry[] {
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

  findByAppHotelId(appHotelId: string): HotelCatalogEntry | null {
    const mock = mockHotels.find((h) => h.id === appHotelId);
    return mock ? toEntry(mock) : null;
  }

  findByAgodaHotelId(agodaHotelId: number): HotelCatalogEntry | null {
    const mock = mockHotels.find((h) => h.agodaHotelId === agodaHotelId);
    return mock ? toEntry(mock) : null;
  }

  listAll(): HotelCatalogEntry[] {
    return mockHotels.map(toEntry);
  }
}
