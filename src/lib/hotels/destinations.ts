// Client-safe: no server-only imports. Kept separate from ./index.ts, which
// now pulls in server-only Supabase repositories.
// Matches the real SerpApi catalog's cities (scripts/seed-hotel-catalog.ts) —
// this list predated that catalog and pointed at cities (서울/방콕) that were
// never actually seeded, while missing ones that were (다낭).
export const supportedDestinations = ["오사카", "도쿄", "다낭", "후쿠오카"];

/**
 * English city names + Korean country names, for src/lib/hotels/agodaLink/
 * match.ts to fill `city`/`country` when inserting a brand-new hotel whose
 * city guess (derived from the pasted URL's citycode) happens to match one
 * of these. Kept separate from scripts/seed-hotel-catalog.ts's own local
 * copy of the same mapping — that script is a one-off batch job already
 * working as-is, not worth the risk of touching for this.
 */
export const CATALOG_CITIES = ["Osaka", "Tokyo", "Danang", "Fukuoka"] as const;

export const CATALOG_CITY_COUNTRY: Record<string, string> = {
  Osaka: "일본",
  Tokyo: "일본",
  Danang: "베트남",
  Fukuoka: "일본",
};
