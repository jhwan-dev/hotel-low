/**
 * Calibrates HIGH_THRESHOLD/MARGIN for src/lib/hotels/agodaLink/match.ts —
 * zero SerpApi calls. Real SerpApi candidate names for an hl=en query
 * aren't available offline (the only cached responses under
 * scripts/.output/coverage/ are hl=ko, and a Korean name vs an English
 * slug collapses to ~0 similarity for every candidate alike — language
 * mismatch poisons the whole signal, not just its scale, so that cache is
 * useless for this specific calibration).
 *
 * Instead this uses the one real-data signal available offline: every
 * catalog hotel that already has `agoda_detail_path` filled in (by hand,
 * via scripts/export-agoda-url-template.ts + import-agoda-detail-urls.ts)
 * has a real Agoda slug — and Agoda slugs are near-verbatim lowercased
 * hotel names, so de-slugify(own slug) vs that same hotel's own `name` is
 * a good proxy for "self" similarity, while de-slugify(own slug) vs every
 * *other* hotel's `name` in the same city is a good proxy for "wrong
 * candidate" similarity (same pool shape a real hl=en SerpApi search for
 * that city would plausibly return). Run with `npm run calibrate:agoda`.
 */
import { createClient } from "@supabase/supabase-js";
import { deslugifyHotelName } from "@/lib/hotels/agodaLink/slug";
import { diceCoefficient, weightedTokenScore } from "@/lib/hotels/agodaLink/similarity";

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

interface Row {
  id: string;
  name: string;
  city: string;
  agoda_detail_path: string;
}

function slugFromDetailPath(path: string): string | null {
  const match = /^([^/]+)\/hotel\//i.exec(path);
  return match ? match[1] : null;
}

async function main() {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data, error } = await supabase
    .from("hotels")
    .select("id, name, city, agoda_detail_path")
    .not("agoda_detail_path", "is", null);
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  console.log(`agoda_detail_path가 채워진 호텔: ${rows.length}개\n`);

  const byCity = new Map<string, Row[]>();
  for (const row of rows) {
    if (!byCity.has(row.city)) byCity.set(row.city, []);
    byCity.get(row.city)!.push(row);
  }

  // row.name is Korean (seeded with hl=ko) for virtually every row here —
  // comparing it against the English de-slugified name would collapse to
  // ~0 for every hotel alike (the exact language-mismatch problem hl=en
  // fixes for the real matching call), so it's not usable as a "self"
  // signal. The one offline-available, language-consistent signal is
  // slug-vs-slug: how distinct are two *different* hotels' real Agoda
  // slugs from each other in the same city — a lower-bound proxy for how
  // separable "wrong" candidates are from the correct one.
  const sameHotelSlugVsSelf: number[] = []; // sanity check: always ~1.0
  const differentHotelSlugVsSlug: number[] = [];
  const differentHotelWeighted: number[] = [];

  for (const [city, cityRows] of byCity) {
    const deslugified = cityRows
      .map((row) => ({ row, slug: slugFromDetailPath(row.agoda_detail_path) }))
      .filter((x): x is { row: Row; slug: string } => x.slug !== null)
      .map((x) => ({ ...x, name: deslugifyHotelName(x.slug) }));
    const corpus = deslugified.map((x) => x.name);

    for (const a of deslugified) {
      sameHotelSlugVsSelf.push(diceCoefficient(a.name, a.name));
      for (const b of deslugified) {
        if (a.row.id === b.row.id) continue;
        differentHotelSlugVsSlug.push(diceCoefficient(a.name, b.name));
        differentHotelWeighted.push(weightedTokenScore(a.name, b.name, corpus));
      }
    }
    console.log(`[${city}] ${cityRows.length}개 (슬러그 있음: ${deslugified.length}개)`);
  }

  function stats(label: string, values: number[]) {
    if (values.length === 0) {
      console.log(`${label}: 데이터 없음`);
      return;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    console.log(
      `${label}: n=${values.length} min=${sorted[0].toFixed(3)} p50=${pct(0.5).toFixed(3)} p90=${pct(0.9).toFixed(3)} p99=${pct(0.99).toFixed(3)} max=${sorted[sorted.length - 1].toFixed(3)}`,
    );
  }

  console.log("\n--- sanity: 슬러그 vs 자기 자신(항상 1.0이어야 함) ---");
  stats("self", sameHotelSlugVsSelf);
  console.log("\n--- [dice] 슬러그 vs 같은 도시의 '다른' 호텔 슬러그 (틀린 후보 시뮬레이션) ---");
  stats("different-hotel (dice)", differentHotelSlugVsSlug);
  console.log("\n--- [weighted] 슬러그 vs 같은 도시의 '다른' 호텔 슬러그 ---");
  stats("different-hotel (weighted)", differentHotelWeighted);

  function ceiling(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      p99: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
    };
  }
  const diceCeil = ceiling(differentHotelSlugVsSlug);
  const weightedCeil = ceiling(differentHotelWeighted);
  console.log(
    `\n다른 호텔 간 유사도 상한선 — dice: p99=${diceCeil.p99.toFixed(3)} max=${diceCeil.max.toFixed(3)} / weighted: p99=${weightedCeil.p99.toFixed(3)} max=${weightedCeil.max.toFixed(3)}.`,
  );
  console.log(
    "실제 체인 호텔 오매칭 사례(scripts/.output/coverage/debug-toyoko-sakuranomiya.json, 토요코인 18개 후보)에서는 weighted 최고점이 0.452, dice 최고점은 0.703이었음 — weighted가 '같은 체인 내 다른 지점'을 훨씬 더 낮게 평가함을 실데이터로 확인.",
  );

  // ---------------------------------------------------------------------
  // Korean-name path (match.ts's hl=ko branch, used when the share text's
  // own hotel name is available). Unlike the slug-vs-slug proxy above,
  // this needs no proxy at all — every one of the 400 catalog hotels
  // already has a real hl=ko `name` (how they were all seeded), so "wrong
  // candidate" can be simulated directly: real Korean name vs every real
  // Korean name of an actually-different hotel in the same city.
  // ---------------------------------------------------------------------
  const { data: allHotels, error: allError } = await supabase.from("hotels").select("id, name, city");
  if (allError) throw allError;

  const byCityAll = new Map<string, { id: string; name: string }[]>();
  for (const row of (allHotels ?? []) as { id: string; name: string; city: string }[]) {
    if (!byCityAll.has(row.city)) byCityAll.set(row.city, []);
    byCityAll.get(row.city)!.push(row);
  }

  const koreanDifferentHotelWeighted: number[] = [];
  for (const [, cityRows] of byCityAll) {
    const corpus = cityRows.map((r) => r.name);
    for (const a of cityRows) {
      for (const b of cityRows) {
        if (a.id === b.id) continue;
        koreanDifferentHotelWeighted.push(weightedTokenScore(a.name, b.name, corpus));
      }
    }
  }
  console.log(`\n--- [한국어 이름, weighted] 카탈로그 전체 ${allHotels?.length ?? 0}개 호텔, 실제 이름 vs 같은 도시의 '다른' 실제 이름 ---`);
  stats("different-hotel (ko weighted)", koreanDifferentHotelWeighted);
  const koreanCeil = ceiling(koreanDifferentHotelWeighted);
  console.log(`한국어 경로 상한선: p99=${koreanCeil.p99.toFixed(3)} max=${koreanCeil.max.toFixed(3)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
