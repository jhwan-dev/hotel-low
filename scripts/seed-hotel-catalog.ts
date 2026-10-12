/**
 * Catalog seed for the SerpApi-backed hotel provider — grows each configured
 * city's catalog toward TARGET_PER_CITY hotels by paginating Google Hotels'
 * list endpoint (no detail calls at all: name/images/rating/reviews/
 * coordinates/property_token all come straight off the list response —
 * address and Agoda's hid are filled in later, the same way they were for
 * the original 22 hotels: scripts/fill-agoda-hid.ts +
 * scripts/export-agoda-url-template.ts/import-agoda-detail-urls.ts).
 *
 * Never touches an existing hotels row: every property_token already in
 * the table (checked once up front) is skipped, and new rows are INSERTed,
 * never upserted — there is no code path in this script that can overwrite
 * the original 22 hotels' hand-filled address/agoda_hid/agoda_detail_path.
 *
 * Defaults to a dry run: prints a per-city estimate of how many additional
 * real API calls are needed and exits without calling anything or writing
 * to the DB. Pass --execute to actually run it:
 *
 *   npm run seed:catalog              # estimate only
 *   npm run seed:catalog -- --execute # actually seed
 *
 * Every list-page response is cached under scripts/.output/coverage/ (same
 * directory verify-agoda-coverage.ts uses) — page 1 for Osaka/Tokyo/Danang/
 * Fukuoka is already cached from earlier work, so both the estimate and a
 * real run reuse it for free. Hard call budget: MAX_CALLS real requests
 * total across every city in one invocation; hitting it stops the current
 * city (and every city after it) early rather than overspending — rerun
 * later to pick up where it left off, since finished pages stay cached.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config — edit before running.
// ---------------------------------------------------------------------------

const CITIES = ["Osaka", "Tokyo", "Danang", "Fukuoka"] as const;

/** Korean country name per city, matching how the rest of the app displays `hotel.location.country`. Add an entry here before adding a city above. */
const CITY_COUNTRY: Record<string, string> = {
  Osaka: "일본",
  Tokyo: "일본",
  Danang: "베트남",
  Fukuoka: "일본",
};

const TARGET_PER_CITY = 100;
const MAX_CALLS = 45;

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

async function fetchJson(params: Record<string, string>): Promise<JsonValue> {
  const url = new URL("https://serpapi.com/search.json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpApi request failed: ${res.status} ${res.statusText}\n${await res.text()}`);
  }
  return (await res.json()) as JsonValue;
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
// Cache — one file per (city, page). Page 1 keeps the exact filename earlier
// scripts already cached under (no "-p1" suffix), so this reuses that for
// free; page 2+ gets its own file per page number.
// ---------------------------------------------------------------------------

function searchCachePath(city: string, page: number): string {
  return page === 1
    ? path.join(COVERAGE_DIR, `search-${slugify(city)}.json`)
    : path.join(COVERAGE_DIR, `search-${slugify(city)}-p${page}.json`);
}

async function readCache(filePath: string): Promise<JsonValue | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as JsonValue;
  } catch {
    return null;
  }
}

async function fetchSearchPage(
  city: string,
  pageToken: string | null,
  config: RunConfig,
  apiKey: string,
): Promise<JsonValue> {
  const params: Record<string, string> = {
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
  };
  if (pageToken) params.next_page_token = pageToken;
  return fetchJson(params);
}

interface CallCounter {
  count: number;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

interface ListedHotel {
  name: string;
  propertyToken: string;
  rating: number;
  reviewCount: number;
  images: string[];
  latitude: number | null;
  longitude: number | null;
}

/**
 * Only type==="hotel", with a property_token, AND a quoted rate_per_night —
 * vacation rentals, sold-out listings, and anything without a token don't
 * belong in this catalog. Everything used here comes straight off the list
 * response; no detail call.
 */
function extractQualifyingHotels(searchResponse: JsonValue): ListedHotel[] {
  const properties = isRecord(searchResponse) && Array.isArray(searchResponse.properties)
    ? searchResponse.properties
    : [];
  return properties
    .filter((p): p is { [key: string]: JsonValue } => {
      if (!isRecord(p)) return false;
      if (p.type !== "hotel") return false;
      if (typeof p.property_token !== "string" || p.property_token.length === 0) return false;
      const rate = isRecord(p.rate_per_night) ? p.rate_per_night.extracted_lowest : null;
      return typeof rate === "number";
    })
    .map((p) => {
      const images = Array.isArray(p.images)
        ? p.images
            .map((img) => (isRecord(img) && typeof img.original_image === "string" ? img.original_image : null))
            .filter((url): url is string => url !== null)
        : [];
      const coords = isRecord(p.gps_coordinates) ? p.gps_coordinates : null;
      return {
        name: typeof p.name === "string" ? p.name : "(이름 없음)",
        propertyToken: String(p.property_token),
        rating: typeof p.overall_rating === "number" ? p.overall_rating : 0,
        reviewCount: typeof p.reviews === "number" ? p.reviews : 0,
        images,
        latitude: coords && typeof coords.latitude === "number" ? coords.latitude : null,
        longitude: coords && typeof coords.longitude === "number" ? coords.longitude : null,
      };
    });
}

function nextPageToken(searchResponse: JsonValue): string | null {
  if (!isRecord(searchResponse)) return null;
  const pagination = searchResponse.serpapi_pagination;
  if (!isRecord(pagination)) return null;
  return typeof pagination.next_page_token === "string" ? pagination.next_page_token : null;
}

// ---------------------------------------------------------------------------
// Existing catalog snapshot — read once, up front, so nothing seeded today
// can ever collide with (let alone overwrite) the original 22 hotels.
// ---------------------------------------------------------------------------

interface ExistingState {
  tokens: Set<string>;
  countByCity: Record<string, number>;
}

async function loadExistingState(supabase: SupabaseClient): Promise<ExistingState> {
  const { data, error } = await supabase.from("hotels").select("provider_hotel_id, city").eq("provider", "agoda");
  if (error) throw error;
  const tokens = new Set<string>();
  const countByCity: Record<string, number> = {};
  for (const row of data ?? []) {
    tokens.add(row.provider_hotel_id as string);
    const city = row.city as string;
    countByCity[city] = (countByCity[city] ?? 0) + 1;
  }
  return { tokens, countByCity };
}

// ---------------------------------------------------------------------------
// Per-city page walk — shared by the dry-run estimate and the real run. In
// dry-run mode it only ever reads already-cached pages (0 calls) and stops
// the moment it would need an uncached one; in execute mode it fetches
// (and caches) whatever's missing, respecting the shared call budget.
// ---------------------------------------------------------------------------

interface CityWalkResult {
  pagesUsed: number;
  newQualifying: ListedHotel[];
  /** Dry-run only: stopped because the next page isn't cached yet — more might exist, just unknown without a real call. */
  ranOutOfCache: boolean;
  /** SerpApi itself had no next_page_token — this city's real result set is exhausted, more calls wouldn't help. */
  ranOutOfPages: boolean;
  /** Execute-mode only: stopped because MAX_CALLS was reached. */
  ranOutOfBudget: boolean;
}

type WalkMode = { execute: false } | { execute: true; apiKey: string; counter: CallCounter };

async function walkCity(
  city: string,
  config: RunConfig,
  existingTokens: Set<string>,
  globalSeenTokens: Set<string>,
  target: number,
  mode: WalkMode,
): Promise<CityWalkResult> {
  const accepted: ListedHotel[] = [];
  let page = 1;
  let pageToken: string | null = null;
  let ranOutOfCache = false;
  let ranOutOfPages = false;
  let ranOutOfBudget = false;

  while (accepted.length < target) {
    const cacheFile = searchCachePath(city, page);
    let data = await readCache(cacheFile);

    if (!data) {
      if (!mode.execute) {
        ranOutOfCache = true;
        break;
      }
      if (mode.counter.count >= MAX_CALLS) {
        ranOutOfBudget = true;
        break;
      }
      try {
        data = await fetchSearchPage(city, pageToken, config, mode.apiKey);
      } catch (err) {
        console.warn(`[${city}] 목록 조회 실패(페이지 ${page}), 중단합니다:`, err);
        break;
      }
      mode.counter.count++;
      await mkdir(COVERAGE_DIR, { recursive: true });
      await writeFile(cacheFile, JSON.stringify(data, null, 2));
      await sleep(300);
    }

    for (const hotel of extractQualifyingHotels(data)) {
      if (existingTokens.has(hotel.propertyToken) || globalSeenTokens.has(hotel.propertyToken)) continue;
      globalSeenTokens.add(hotel.propertyToken);
      accepted.push(hotel);
      if (accepted.length >= target) break;
    }

    const token = nextPageToken(data);
    if (!token) {
      ranOutOfPages = true;
      break;
    }
    pageToken = token;
    page++;
  }

  return { pagesUsed: page, newQualifying: accepted, ranOutOfCache, ranOutOfPages, ranOutOfBudget };
}

/** Conservative fallback when zero cached pages exist for a city yet — observed pass-rate from the other cities' first pages hovers well above this. */
const FALLBACK_QUALIFYING_PER_PAGE = 12;

function estimateAdditionalCalls(result: CityWalkResult, stillNeeded: number): number {
  if (stillNeeded <= 0 || !result.ranOutOfCache) return 0;
  const pagesObserved = result.pagesUsed - 1;
  const avgPerPage =
    pagesObserved > 0 && result.newQualifying.length > 0
      ? result.newQualifying.length / pagesObserved
      : FALLBACK_QUALIFYING_PER_PAGE;
  return Math.max(1, Math.ceil(stillNeeded / avgPerPage));
}

// ---------------------------------------------------------------------------

async function main() {
  const execute = process.argv.includes("--execute");
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await mkdir(COVERAGE_DIR, { recursive: true });
  const config = await loadOrCreateRunConfig();
  const existing = await loadExistingState(supabase);
  const globalSeenTokens = new Set<string>();

  if (!execute) {
    console.log(`체크인 ${config.checkIn} / 체크아웃 ${config.checkOut} (평일 1박, 성인 2명 기준)\n`);
    let totalEstimate = 0;
    for (const city of CITIES) {
      const alreadyInDb = existing.countByCity[city] ?? 0;
      const target = Math.max(0, TARGET_PER_CITY - alreadyInDb);
      if (target === 0) {
        console.log(`[${city}] 이미 ${alreadyInDb}개 — 목표(${TARGET_PER_CITY}) 달성, 추가 호출 불필요`);
        continue;
      }
      const result = await walkCity(city, config, existing.tokens, globalSeenTokens, target, { execute: false });
      const stillNeeded = target - result.newQualifying.length;
      const additional = estimateAdditionalCalls(result, stillNeeded);
      totalEstimate += additional;

      const status = result.ranOutOfPages
        ? "SerpApi 결과 전체 소진(캐시만으로 더 찾을 게 없음)"
        : stillNeeded <= 0
          ? "캐시만으로 목표 달성"
          : `추가 호출 약 ${additional}회 예상`;
      console.log(
        `[${city}] 기존 ${alreadyInDb}개 + 캐시에서 신규 ${result.newQualifying.length}개 확인(캐시된 페이지 ${result.pagesUsed - (result.ranOutOfCache ? 1 : 0)}개) — ${status}`,
      );
    }
    console.log(`\n예상 추가 API 호출 수(합계): 약 ${totalEstimate}회 / MAX_CALLS=${MAX_CALLS}`);
    console.log("실제 응답 내용에 따라 달라질 수 있는 추정치입니다 (캐시된 페이지만으로 계산, 추가 호출 0회).");
    console.log("확인 후 실행: npm run seed:catalog -- --execute");
    return;
  }

  const apiKey = requireApiKey();
  let totalInserted = 0;
  const insertedByCity: Record<string, number> = {};
  const counter: CallCounter = { count: 0 };

  for (const city of CITIES) {
    const country = CITY_COUNTRY[city];
    if (!country) {
      console.error(`CITY_COUNTRY에 "${city}" 매핑이 없습니다. 추가한 뒤 다시 실행해주세요.`);
      process.exit(1);
    }

    const alreadyInDb = existing.countByCity[city] ?? 0;
    const target = Math.max(0, TARGET_PER_CITY - alreadyInDb);
    insertedByCity[city] = 0;
    if (target === 0) {
      console.log(`[${city}] 이미 ${alreadyInDb}개 — 목표(${TARGET_PER_CITY}) 달성, 건너뜁니다.`);
      continue;
    }

    const result = await walkCity(city, config, existing.tokens, globalSeenTokens, target, {
      execute: true,
      apiKey,
      counter,
    });

    for (const hotel of result.newQualifying) {
      const { error } = await supabase.from("hotels").insert({
        provider: "agoda",
        provider_hotel_id: hotel.propertyToken,
        name: hotel.name,
        city,
        country,
        // Left empty on purpose — not derivable from the list response.
        // Filled in later the same way as the original 22 hotels: see
        // scripts/fill-agoda-hid.ts and the export/import-agoda-urls pair.
        address: "",
        rating: hotel.rating,
        review_count: hotel.reviewCount,
        images: hotel.images,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
      });
      if (error) {
        console.warn(`[${city}] "${hotel.name}" insert 실패:`, error);
        continue;
      }
      insertedByCity[city]++;
    }
    totalInserted += insertedByCity[city];

    const reason = result.ranOutOfBudget
      ? "MAX_CALLS 도달"
      : result.ranOutOfPages
        ? "SerpApi 결과 소진"
        : "목표 달성";
    console.log(
      `[${city}] +${insertedByCity[city]}개 (총 ${alreadyInDb + insertedByCity[city]}/${TARGET_PER_CITY}) — 중단 이유: ${reason}`,
    );

    if (result.ranOutOfBudget) {
      console.log("전체 호출 한도(MAX_CALLS)에 도달해 남은 도시는 이번 실행에서 처리하지 않습니다. 캐시된 페이지는 남으니 다시 실행하면 이어서 진행됩니다.");
      break;
    }
  }

  console.log(`\n==== 결과 ====`);
  for (const city of CITIES) console.log(`${city}: +${insertedByCity[city] ?? 0}`);
  console.log(`총 추가: ${totalInserted}개`);
  console.log(`실제 API 호출 수: ${counter.count} / MAX_CALLS=${MAX_CALLS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
