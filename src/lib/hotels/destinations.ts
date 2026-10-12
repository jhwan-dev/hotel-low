// Client-safe: no server-only imports. Kept separate from ./index.ts, which
// now pulls in server-only Supabase repositories.
// Matches the real SerpApi catalog's cities (scripts/seed-hotel-catalog.ts) —
// this list predated that catalog and pointed at cities (서울/방콕) that were
// never actually seeded, while missing ones that were (다낭).
export const supportedDestinations = ["오사카", "도쿄", "다낭", "후쿠오카"];
