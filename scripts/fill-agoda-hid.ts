/**
 * One-time (or re-run-anytime) backfill of hotels.agoda_hid for every
 * SerpApi-seeded hotel — see supabase/migrations/0009_hotel_agoda_booking_link.sql
 * and buildBookingUrl() in src/lib/hotels/serpapi/mapper.ts, which uses this
 * as the search-results-fallback link when no agoda_detail_path is set.
 *
 * Costs 0 real API calls: the hid is decoded straight out of the Agoda price
 * entry's `link` (a Google-ads redirect whose `pcurl` query param is Agoda's
 * own partnersearch.aspx URL, which carries `hid`) in the detail responses
 * scripts/verify-agoda-coverage.ts / scripts/seed-hotel-catalog.ts already
 * cached under scripts/.output/coverage/. Run with `npm run fill:agoda-hid`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const COVERAGE_DIR = path.join(process.cwd(), "scripts", ".output", "coverage");

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

// Same slugify/path shape as scripts/seed-hotel-catalog.ts — duplicated
// rather than imported, matching that script's own convention.
function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
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

/** Same prices+featured_prices union-by-source as src/lib/hotels/serpapi/mapper.ts, but we only need Agoda's own `link` here. */
function extractAgodaHid(detail: JsonValue): string | null {
  if (!isRecord(detail)) return null;
  const all = [
    ...(Array.isArray(detail.prices) ? detail.prices : []),
    ...(Array.isArray(detail.featured_prices) ? detail.featured_prices : []),
  ];
  const agoda = all.find(
    (p): p is { [key: string]: JsonValue } =>
      isRecord(p) && typeof p.source === "string" && p.source.toLowerCase() === "agoda",
  );
  if (!agoda || typeof agoda.link !== "string") return null;

  try {
    const outer = new URL(agoda.link);
    const pcurl = outer.searchParams.get("pcurl");
    if (!pcurl) return null;
    const inner = new URL(pcurl);
    return inner.searchParams.get("hid");
  } catch {
    return null;
  }
}

interface HotelRow {
  id: string;
  provider_hotel_id: string;
  city: string;
  name: string;
  agoda_hid: string | null;
}

async function main() {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("hotels")
    .select("id, provider_hotel_id, city, name, agoda_hid")
    .eq("provider", "agoda");
  if (error) throw error;

  const rows = (data ?? []) as HotelRow[];
  let updated = 0;
  let skippedNoCache = 0;
  let skippedNoHid = 0;

  for (const row of rows) {
    const cacheFile = detailCachePath(row.city, row.provider_hotel_id);
    const detail = await readCache(cacheFile);
    if (!detail) {
      console.log(`[스킵: 캐시 없음] ${row.city} "${row.name}" (${cacheFile})`);
      skippedNoCache++;
      continue;
    }

    const hid = extractAgodaHid(detail);
    if (!hid) {
      console.log(`[스킵: hid 못찾음] ${row.city} "${row.name}" — 이 날짜엔 아고다 가격이 없었을 수 있음`);
      skippedNoHid++;
      continue;
    }

    const { error: updateError } = await supabase.from("hotels").update({ agoda_hid: hid }).eq("id", row.id);
    if (updateError) {
      console.warn(`[업데이트 실패] ${row.city} "${row.name}":`, updateError);
      continue;
    }
    console.log(`[완료] ${row.city} "${row.name}" -> hid=${hid}`);
    updated++;
  }

  console.log(
    `\n총 ${rows.length}개 중 ${updated}개 갱신, 캐시 없음 ${skippedNoCache}개, hid 없음 ${skippedNoHid}개. (실제 API 호출 0회)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
