// No "server-only" here on purpose — these are pure string functions with
// nothing to protect, used both by server-only code (parse.ts, match.ts)
// and by scripts/calibrate-agoda-match.ts (a plain Node script, not part
// of the Next.js server runtime).

/** "rihga-royal-hotel-osaka" -> "rihga royal hotel osaka" */
export function deslugifyHotelName(slug: string): string {
  return slug.replace(/-/g, " ").trim();
}

/** "osaka-jp" -> "osaka", "da-nang-vn" -> "da nang" — strips the trailing 2-letter country code. */
export function cityGuessFromCityCode(citycode: string): string {
  return citycode.replace(/-[a-z]{2}$/i, "").replace(/-/g, " ").trim();
}
