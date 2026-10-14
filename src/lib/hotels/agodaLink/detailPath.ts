/**
 * Normalizes an Agoda detail-page URL/path down to the same format stored
 * in `hotels.agoda_detail_path`: no domain, no "/ko-kr/"-style locale
 * prefix, no leading slash (e.g. "rihga-royal-hotel-osaka/hotel/osaka-jp.html").
 * Shared by scripts/import-agoda-detail-urls.ts (hand-filled CSV import)
 * and src/lib/hotels/agodaLink/parse.ts (paste-a-link import) so both write
 * the exact same shape — that's what makes `agoda_detail_path` equality
 * lookups work regardless of which path filled the column in.
 */
export function extractDetailPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let pathname: string;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    // Not an absolute URL — the caller passed a bare path.
    pathname = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  const stripped = pathname.replace(/^\/+/, "");
  return stripped.replace(/^[a-z]{2}-[a-z]{2}\//i, "");
}

/** True when a normalized path (see extractDetailPath) matches Agoda's real detail-page shape (`<slug>/hotel/<citycode>.html`) — as opposed to a search/short-link/other path. */
export function isDetailPagePath(path: string): boolean {
  return /^[^/]+\/hotel\/[^/]+\.html$/i.test(path);
}
