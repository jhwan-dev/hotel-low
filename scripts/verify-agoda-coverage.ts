/**
 * Extends verify-serpapi-hotels.ts's single-hotel spot check into a batch
 * survey: for a configurable set of cities, how often does SerpApi's
 * engine=google_hotels property-detail response actually carry an Agoda
 * price, and what is that price — so it can be checked by hand against
 * Agoda's real site. Standalone, not part of the Next.js app (src/
 * untouched). Run with `npm run verify:coverage`.
 *
 * Every list/detail response is cached to disk under scripts/.output/coverage/
 * — a re-run makes zero network calls once everything is cached. Delete that
 * directory (or just run-config.json, to pick new dates) to start over.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config — edit these before running.
// ---------------------------------------------------------------------------

/** City names fed into `q: "${city} Hotels"`. Fill in with real cities. */
const CITIES: string[] = ["Osaka", "Tokyo", "Danang", "Fukuoka"];

/** Top-N organic (non-ad) hotels per city, ranked by SerpApi's "most reviewed" sort. */
const HOTELS_PER_CITY = 8;

/** Hard stop — refuses to run at all if the estimated call count exceeds this. */
const MAX_CALLS = 30;

// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.join(process.cwd(), "scripts", ".output");
const COVERAGE_DIR = path.join(OUTPUT_DIR, "coverage");
const RUN_CONFIG_FILE = path.join(COVERAGE_DIR, "run-config.json");
const CSV_FILE = path.join(OUTPUT_DIR, "agoda-coverage.csv");

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    console.error(
      "SERPAPI_API_KEY is not set. Run via `npm run verify:coverage` so .env.local is loaded.",
    );
    process.exit(1);
  }
  return key;
}

async function fetchUrl(url: string): Promise<JsonValue> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SerpApi request failed: ${res.status} ${res.statusText}\n${await res.text()}`);
  }
  return (await res.json()) as JsonValue;
}

async function fetchJson(params: Record<string, string>): Promise<JsonValue> {
  const url = new URL("https://serpapi.com/search.json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return fetchUrl(url.toString());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
}

// ---------------------------------------------------------------------------
// Dates — "30 days from today, nearest weekday", persisted so re-runs reuse
// the same stay instead of drifting a day every time they're run.
// ---------------------------------------------------------------------------

function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Mon-Thu only, not just "not weekend" — a Friday check-in's one night is
 * Friday night, which many hotels price at the weekend rate. Fri/Sat both
 * shift back to Thursday, Sunday shifts forward to Monday.
 */
function nearestWeekdayMonToThuISO(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  if (day === 0) d.setDate(d.getDate() + 1); // Sunday -> Monday
  else if (day === 5) d.setDate(d.getDate() - 1); // Friday -> Thursday
  else if (day === 6) d.setDate(d.getDate() - 2); // Saturday -> Thursday
  return d.toISOString().slice(0, 10);
}

interface RunConfig {
  checkIn: string;
  checkOut: string;
}

async function loadOrCreateRunConfig(): Promise<RunConfig> {
  try {
    const raw = await readFile(RUN_CONFIG_FILE, "utf8");
    return JSON.parse(raw) as RunConfig;
  } catch {
    const checkIn = nearestWeekdayMonToThuISO(30);
    const config: RunConfig = { checkIn, checkOut: addDays(checkIn, 1) };
    await mkdir(COVERAGE_DIR, { recursive: true });
    await writeFile(RUN_CONFIG_FILE, JSON.stringify(config, null, 2));
    return config;
  }
}

// ---------------------------------------------------------------------------
// Cache-or-fetch — every network call goes through here so "already on disk"
// always wins over hitting the API again.
// ---------------------------------------------------------------------------

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function searchCachePath(city: string): string {
  return path.join(COVERAGE_DIR, `search-${slugify(city)}.json`);
}

function detailCachePath(city: string, propertyToken: string): string {
  return path.join(COVERAGE_DIR, `detail-${slugify(city)}-${slugify(propertyToken)}.json`);
}

async function readCache(filePath: string): Promise<JsonValue | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as JsonValue;
  } catch {
    return null;
  }
}

interface CallCounter {
  count: number;
}

async function cachedSearch(
  city: string,
  config: RunConfig,
  apiKey: string,
  counter: CallCounter,
): Promise<JsonValue> {
  const cacheFile = searchCachePath(city);
  const cached = await readCache(cacheFile);
  if (cached) return cached;

  const data = await fetchJson({
    engine: "google_hotels",
    q: `${city} Hotels`,
    gl: "kr",
    hl: "ko",
    currency: "KRW",
    check_in_date: config.checkIn,
    check_out_date: config.checkOut,
    adults: "2",
    sort_by: "13", // "Most reviewed" — see https://serpapi.com/google-hotels-api
    api_key: apiKey,
  });
  counter.count++;
  await mkdir(COVERAGE_DIR, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(data, null, 2));
  await sleep(300);
  return data;
}

async function cachedDetail(
  city: string,
  hotel: SelectedHotel,
  config: RunConfig,
  apiKey: string,
  counter: CallCounter,
): Promise<JsonValue> {
  const cacheFile = detailCachePath(city, hotel.propertyToken);
  const cached = await readCache(cacheFile);
  if (cached) return cached;

  // Prefer SerpApi's own serpapi_property_details_link (it includes the `q`
  // param the detail endpoint turns out to require — see verify-serpapi-hotels.ts).
  const data = hotel.detailsLink
    ? await fetchUrl(`${hotel.detailsLink}&api_key=${apiKey}`)
    : await fetchJson({
        engine: "google_hotels",
        q: `${city} Hotels`,
        property_token: hotel.propertyToken,
        gl: "kr",
        hl: "ko",
        currency: "KRW",
        check_in_date: config.checkIn,
        check_out_date: config.checkOut,
        adults: "2",
        api_key: apiKey,
      });
  counter.count++;
  await mkdir(COVERAGE_DIR, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(data, null, 2));
  await sleep(300);
  return data;
}

// ---------------------------------------------------------------------------
// Pre-flight call estimate — computed from disk state only, zero network
// calls. Exact once a city's search is cached (we then know its real
// property tokens); a conservative upper bound (HOTELS_PER_CITY) otherwise.
// ---------------------------------------------------------------------------

async function estimateCalls(): Promise<number> {
  let total = 0;
  for (const city of CITIES) {
    const searchFile = searchCachePath(city);
    const cachedSearchData = await readCache(searchFile);
    if (!cachedSearchData) {
      total += 1 + HOTELS_PER_CITY; // list call + worst-case detail calls
      continue;
    }
    const hotels = selectTopOrganicHotels(cachedSearchData, HOTELS_PER_CITY);
    for (const hotel of hotels) {
      if (!(await fileExists(detailCachePath(city, hotel.propertyToken)))) total += 1;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Extraction — list response -> candidate hotels; detail response -> Agoda
// price + market context. Field names are taken directly from saved
// responses (see scripts/.output/detail-response.json from
// verify-serpapi-hotels.ts), not guessed from docs alone.
// ---------------------------------------------------------------------------

interface SelectedHotel {
  name: string;
  propertyToken: string;
  detailsLink: string | null;
}

/** Organic `properties` only — ads are a different, sponsored array and not what "top N hotels" should mean here. */
function selectTopOrganicHotels(searchResponse: JsonValue, limit: number): SelectedHotel[] {
  const properties = isRecord(searchResponse) && Array.isArray(searchResponse.properties)
    ? searchResponse.properties
    : [];
  const withToken = properties.filter(
    (p): p is { [key: string]: JsonValue } => isRecord(p) && typeof p.property_token === "string",
  );
  // Already sorted server-side by sort_by=13 ("most reviewed") — just take the top slice.
  return withToken.slice(0, limit).map((p) => ({
    name: typeof p.name === "string" ? p.name : "(이름 없음)",
    propertyToken: String(p.property_token),
    detailsLink:
      typeof p.serpapi_property_details_link === "string" ? p.serpapi_property_details_link : null,
  }));
}

interface PriceEntry {
  source: string;
  withTax: number | null;
  withoutTax: number | null;
}

/**
 * `prices` and `featured_prices` can each carry sources the other is missing
 * (observed directly in cached responses — a hotel can show Agoda in one and
 * not the other), so union both rather than treating one as a fallback for
 * an empty other. Dedup by source name: when both arrays list the same OTA,
 * the `prices` copy wins (it's iterated first below) since every sample
 * checked had identical numbers either way.
 */
function extractPriceEntries(detail: JsonValue): PriceEntry[] {
  if (!isRecord(detail)) return [];
  const pricesArr = Array.isArray(detail.prices) ? detail.prices : [];
  const featuredArr = Array.isArray(detail.featured_prices) ? detail.featured_prices : [];

  const bySource = new Map<string, PriceEntry>();
  for (const item of [...pricesArr, ...featuredArr]) {
    if (!isRecord(item) || typeof item.source !== "string") continue;
    const key = item.source.toLowerCase();
    if (bySource.has(key)) continue;
    const totalRate = isRecord(item.total_rate) ? item.total_rate : null;
    const ratePerNight = isRecord(item.rate_per_night) ? item.rate_per_night : null;
    const basis = totalRate ?? ratePerNight;
    bySource.set(key, {
      source: item.source,
      withTax:
        basis && typeof basis.extracted_lowest === "number" ? basis.extracted_lowest : null,
      withoutTax:
        basis && typeof basis.extracted_before_taxes_fees === "number"
          ? basis.extracted_before_taxes_fees
          : null,
    });
  }
  return [...bySource.values()];
}

function findAgoda(entries: PriceEntry[]): PriceEntry | null {
  return entries.find((e) => e.source.toLowerCase() === "agoda") ?? null;
}

/** "Lowest" here is always the tax/fee-included figure (extracted_lowest), matching what a traveler would actually pay at checkout — not extracted_before_taxes_fees. */
function lowestNonAgoda(entries: PriceEntry[]): number | null {
  const values = entries
    .filter((e) => e.source.toLowerCase() !== "agoda")
    .map((e) => e.withTax)
    .filter((v): v is number => v !== null);
  return values.length > 0 ? Math.min(...values) : null;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

interface CsvRow {
  city: string;
  hotelName: string;
  propertyToken: string;
  checkIn: string;
  checkOut: string;
  agodaFound: boolean;
  agodaWithTax: number | null;
  agodaWithoutTax: number | null;
  lowestNonAgoda: number | null;
  sourceCount: number;
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(rows: CsvRow[]): Promise<void> {
  const header = [
    "도시",
    "호텔명",
    "property_token",
    "체크인",
    "체크아웃",
    "아고다노출",
    "아고다가격_세금포함",
    "아고다가격_세금제외",
    "아고다제외최저가(세금포함)",
    "판매처수",
    "아고다실제가", // fill in by hand
    "오차(%)", // fill in by hand
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.city),
        csvCell(row.hotelName),
        csvCell(row.propertyToken),
        csvCell(row.checkIn),
        csvCell(row.checkOut),
        csvCell(row.agodaFound ? "예" : "아니오"),
        csvCell(row.agodaWithTax),
        csvCell(row.agodaWithoutTax),
        csvCell(row.lowestNonAgoda),
        csvCell(row.sourceCount),
        "",
        "",
      ].join(","),
    );
  }
  // BOM so Excel opens the Korean headers as UTF-8, not mojibake.
  return writeFile(CSV_FILE, `﻿${lines.join("\n")}\n`);
}

// ---------------------------------------------------------------------------

async function main() {
  const apiKey = requireApiKey();
  await mkdir(COVERAGE_DIR, { recursive: true });
  const config = await loadOrCreateRunConfig();
  console.log(`체크인 ${config.checkIn} / 체크아웃 ${config.checkOut} (run-config.json 삭제 시 날짜 재계산)`);

  const estimate = await estimateCalls();
  console.log(
    `예상 API 호출 수(캐시 제외, 상세조회는 도시당 미확정 시 최대 ${HOTELS_PER_CITY}건으로 가정): ${estimate} / MAX_CALLS=${MAX_CALLS}`,
  );
  if (estimate > MAX_CALLS) {
    console.error("MAX_CALLS를 초과해서 중단합니다. CITIES/HOTELS_PER_CITY를 줄이거나 MAX_CALLS를 늘려주세요.");
    process.exit(1);
  }

  const counter: CallCounter = { count: 0 };
  const rows: CsvRow[] = [];
  const perCity = new Map<string, { attempted: number; withAgoda: number }>();

  for (const city of CITIES) {
    let searchResponse: JsonValue;
    try {
      searchResponse = await cachedSearch(city, config, apiKey, counter);
    } catch (err) {
      console.warn(`[${city}] 목록 조회 실패, 이 도시는 건너뜁니다:`, err);
      continue;
    }

    const hotels = selectTopOrganicHotels(searchResponse, HOTELS_PER_CITY);
    const stats = { attempted: 0, withAgoda: 0 };

    for (const hotel of hotels) {
      let detailResponse: JsonValue;
      try {
        detailResponse = await cachedDetail(city, hotel, config, apiKey, counter);
      } catch (err) {
        console.warn(`[${city}] "${hotel.name}" 상세 조회 실패, 건너뜁니다:`, err);
        continue;
      }

      const entries = extractPriceEntries(detailResponse);
      const agoda = findAgoda(entries);

      stats.attempted++;
      if (agoda) stats.withAgoda++;

      rows.push({
        city,
        hotelName: hotel.name,
        propertyToken: hotel.propertyToken,
        checkIn: config.checkIn,
        checkOut: config.checkOut,
        agodaFound: agoda !== null,
        agodaWithTax: agoda?.withTax ?? null,
        agodaWithoutTax: agoda?.withoutTax ?? null,
        lowestNonAgoda: lowestNonAgoda(entries),
        sourceCount: new Set(entries.map((e) => e.source)).size,
      });
    }

    perCity.set(city, stats);
  }

  await writeCsv(rows);

  console.log("\n--- 도시별 아고다 노출률 ---");
  let totalAttempted = 0;
  let totalWithAgoda = 0;
  for (const [city, stats] of perCity) {
    totalAttempted += stats.attempted;
    totalWithAgoda += stats.withAgoda;
    const pct = stats.attempted > 0 ? ((stats.withAgoda / stats.attempted) * 100).toFixed(1) : "N/A";
    console.log(`${city}: ${stats.withAgoda}/${stats.attempted} (${pct}%)`);
  }
  const overallPct = totalAttempted > 0 ? ((totalWithAgoda / totalAttempted) * 100).toFixed(1) : "N/A";
  console.log(`전체: ${totalWithAgoda}/${totalAttempted} (${overallPct}%)`);
  console.log(`\nCSV: ${CSV_FILE}`);
  console.log(`실제 API 호출 수: ${counter.count}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
