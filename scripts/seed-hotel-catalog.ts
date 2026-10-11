/**
 * One-time (or re-run-anytime) catalog seed for the SerpApi-backed hotel
 * provider: for each configured city, lists hotels via Google Hotels, drops
 * anything that isn't type==="hotel" or has zero sellers in its detail
 * response, and upserts the rest into Supabase `hotels` — provider stays
 * "agoda" (SerpApi is just the lookup path), provider_hotel_id holds the
 * SerpApi property_token directly (see supabase/migrations/0007_...sql for
 * why there's no separate token column).
 *
 * Reuses the exact same list/detail response cache
 * scripts/verify-agoda-coverage.ts already populated under
 * scripts/.output/coverage/ — for Osaka/Tokyo/Danang specifically, every
 * response this script needs is already cached there, so a normal run
 * costs 0 real API calls. Run with `npm run seed:catalog`.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config — edit before running.
// ---------------------------------------------------------------------------

const CITIES: string[] = ["Osaka", "Tokyo", "Danang"];

/** Korean country name per city, matching how the rest of the app displays `hotel.location.country`. Add an entry here before adding a city above. */
const CITY_COUNTRY: Record<string, string> = {
  Osaka: "일본",
  Tokyo: "일본",
  Danang: "베트남",
};

const HOTELS_PER_CITY = 8;
const MAX_CALLS = 30;

// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.join(process.cwd(), "scripts", ".output");
// Same cache directory verify-agoda-coverage.ts uses — deliberately shared.
const COVERAGE_DIR = path.join(OUTPUT_DIR, "coverage");
const RUN_CONFIG_FILE = path.join(COVERAGE_DIR, "run-config.json");

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    console.error("SERPAPI_API_KEY is not set. Run via `npm run seed:catalog` so .env.local is loaded.");
    process.exit(1);
  }
  return key;
}

function requireSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다. .env.local을 채운 뒤 다시 실행해주세요.",
    );
    process.exit(1);
  }
  return { url, serviceRoleKey };
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
// Dates — only affects which cached files get hit; the seeded rows
// themselves don't carry a stay, so a mismatch here is harmless, just a
// cache miss. Mirrors verify-agoda-coverage.ts's Mon-Thu rule.
// ---------------------------------------------------------------------------

function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nearestWeekdayMonToThuISO(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1);
  else if (day === 5) d.setDate(d.getDate() - 1);
  else if (day === 6) d.setDate(d.getDate() - 2);
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
// Cache-or-fetch — identical shape to verify-agoda-coverage.ts, same files.
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
    sort_by: "13",
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
  hotel: ListedHotel,
  config: RunConfig,
  apiKey: string,
  counter: CallCounter,
): Promise<JsonValue> {
  const cacheFile = detailCachePath(city, hotel.propertyToken);
  const cached = await readCache(cacheFile);
  if (cached) return cached;

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
// Pre-flight call estimate — same conservative-upper-bound approach as
// verify-agoda-coverage.ts: exact once a city's search is cached, an upper
// bound (HOTELS_PER_CITY detail calls) otherwise.
// ---------------------------------------------------------------------------

async function estimateCalls(): Promise<number> {
  let total = 0;
  for (const city of CITIES) {
    const cachedSearchData = await readCache(searchCachePath(city));
    if (!cachedSearchData) {
      total += 1 + HOTELS_PER_CITY;
      continue;
    }
    const hotels = selectCandidateHotels(cachedSearchData, HOTELS_PER_CITY);
    for (const hotel of hotels) {
      if (!(await fileExists(detailCachePath(city, hotel.propertyToken)))) total += 1;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

interface ListedHotel {
  name: string;
  propertyToken: string;
  detailsLink: string | null;
  rating: number;
  reviewCount: number;
  images: string[];
  amenities: string[];
  description: string;
}

/** Only type==="hotel" with a property_token — vacation rentals etc. don't belong in this catalog. */
function selectCandidateHotels(searchResponse: JsonValue, limit: number): ListedHotel[] {
  const properties = isRecord(searchResponse) && Array.isArray(searchResponse.properties)
    ? searchResponse.properties
    : [];
  const hotelsOnly = properties.filter(
    (p): p is { [key: string]: JsonValue } =>
      isRecord(p) && p.type === "hotel" && typeof p.property_token === "string",
  );
  return hotelsOnly.slice(0, limit).map((p) => {
    const images = Array.isArray(p.images)
      ? p.images
          .map((img) => (isRecord(img) && typeof img.original_image === "string" ? img.original_image : null))
          .filter((url): url is string => url !== null)
      : [];
    return {
      name: typeof p.name === "string" ? p.name : "(이름 없음)",
      propertyToken: String(p.property_token),
      detailsLink:
        typeof p.serpapi_property_details_link === "string" ? p.serpapi_property_details_link : null,
      rating: typeof p.overall_rating === "number" ? p.overall_rating : 0,
      reviewCount: typeof p.reviews === "number" ? p.reviews : 0,
      images,
      amenities: Array.isArray(p.amenities) ? p.amenities.filter((a): a is string => typeof a === "string") : [],
      description: typeof p.description === "string" ? p.description : "",
    };
  });
}

/** Same prices+featured_prices union-by-source as src/lib/hotels/serpapi/mapper.ts — only need the count here, not the prices themselves. */
function countSellers(detail: JsonValue): number {
  if (!isRecord(detail)) return 0;
  const sources = new Set<string>();
  for (const item of [...(Array.isArray(detail.prices) ? detail.prices : []), ...(Array.isArray(detail.featured_prices) ? detail.featured_prices : [])]) {
    if (isRecord(item) && typeof item.source === "string") sources.add(item.source.toLowerCase());
  }
  return sources.size;
}

// ---------------------------------------------------------------------------

async function main() {
  const apiKey = requireApiKey();
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await mkdir(COVERAGE_DIR, { recursive: true });
  const config = await loadOrCreateRunConfig();

  const estimate = await estimateCalls();
  console.log(`예상 API 호출 수(캐시 제외): ${estimate} / MAX_CALLS=${MAX_CALLS}`);
  if (estimate > MAX_CALLS) {
    console.error("MAX_CALLS를 초과해서 중단합니다. CITIES/HOTELS_PER_CITY를 줄이거나 MAX_CALLS를 늘려주세요.");
    process.exit(1);
  }

  const counter: CallCounter = { count: 0 };
  let seeded = 0;
  let skippedNoSellers = 0;

  for (const city of CITIES) {
    const country = CITY_COUNTRY[city];
    if (!country) {
      console.error(`CITY_COUNTRY에 "${city}" 매핑이 없습니다. 추가한 뒤 다시 실행해주세요.`);
      process.exit(1);
    }

    let searchResponse: JsonValue;
    try {
      searchResponse = await cachedSearch(city, config, apiKey, counter);
    } catch (err) {
      console.warn(`[${city}] 목록 조회 실패, 이 도시는 건너뜁니다:`, err);
      continue;
    }

    const candidates = selectCandidateHotels(searchResponse, HOTELS_PER_CITY);

    for (const hotel of candidates) {
      let detail: JsonValue;
      try {
        detail = await cachedDetail(city, hotel, config, apiKey, counter);
      } catch (err) {
        console.warn(`[${city}] "${hotel.name}" 상세 조회 실패, 건너뜁니다:`, err);
        continue;
      }

      if (countSellers(detail) === 0) {
        console.log(`[${city}] "${hotel.name}" 판매처 0개, 건너뜁니다.`);
        skippedNoSellers++;
        continue;
      }

      // No address field anywhere in SerpApi's list/detail response — left
      // blank rather than guessed. agoda_price_status/agoda_price_checked_at
      // are deliberately omitted here (not just set to defaults): omitting
      // them means a re-seed never resets a status a real tracking-start
      // check already set (see src/lib/supabase/hotelsTable.ts:ensureHotelRow,
      // same reasoning).
      const { error } = await supabase.from("hotels").upsert(
        {
          provider: "agoda",
          provider_hotel_id: hotel.propertyToken,
          name: hotel.name,
          city,
          country,
          address: "",
          rating: hotel.rating,
          review_count: hotel.reviewCount,
          images: hotel.images,
          amenities: hotel.amenities,
          description: hotel.description,
        },
        { onConflict: "provider,provider_hotel_id" },
      );
      if (error) {
        console.warn(`[${city}] "${hotel.name}" upsert 실패:`, error);
        continue;
      }
      seeded++;
    }
  }

  console.log(`\n시딩 완료: ${seeded}개 추가/갱신, 판매처 0개로 제외된 호텔 ${skippedNoSellers}개`);
  console.log(`실제 API 호출 수: ${counter.count}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
