/**
 * One-off real-call verification for the Korean-name matching path (hl=ko)
 * added to src/lib/hotels/agodaLink/match.ts — mirrors
 * scripts/debug-agoda-match.ts but for the koreanName branch. Makes
 * exactly ONE real SerpApi call and caches the raw response under
 * scripts/.output/ so it's reproducible without spending another.
 * Run with `npm run debug:agoda-match-ko`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { searchHotels } from "@/lib/hotels/serpapi/client";
import type { SerpApiListProperty, SerpApiSearchResponse } from "@/lib/hotels/serpapi/types";
import { cityGuessFromCityCode } from "@/lib/hotels/agodaLink/slug";
import { weightedTokenScore } from "@/lib/hotels/agodaLink/similarity";

const OUTPUT_FILE = path.join(process.cwd(), "scripts", ".output", "coverage", "debug-sunlite-shinjuku-ko.json");

const KOREAN_NAME = "호텔 선라이트 신주쿠";
const CITYCODE = "tokyo-jp";
const CHECK_IN = "2026-12-09";
const CHECK_OUT = "2026-12-12";

async function main() {
  const cityGuess = cityGuessFromCityCode(CITYCODE);
  const q = KOREAN_NAME.toLowerCase().includes(cityGuess.toLowerCase()) ? KOREAN_NAME : `${KOREAN_NAME} ${cityGuess}`;
  console.log("cityGuess:", cityGuess);
  console.log("SerpApi q:", q, "(hl=ko)");

  const raw: SerpApiSearchResponse = await searchHotels({
    q,
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    adults: 2,
    children: 0,
    hl: "ko",
  });

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(raw, null, 2));
  console.log(`\n원본 응답 캐시: ${OUTPUT_FILE}`);

  const properties: SerpApiListProperty[] = raw.properties ?? [];
  console.log(`응답 properties 개수: ${properties.length}`);

  const qualifying = properties.filter(
    (p) => p.type === "hotel" && typeof p.property_token === "string" && p.property_token.length > 0,
  );
  console.log(`qualifying 개수: ${qualifying.length}\n`);

  const corpus = qualifying.map((p) => p.name);
  const scored = qualifying
    .map((p) => ({ name: p.name, token: p.property_token, score: weightedTokenScore(KOREAN_NAME, p.name, corpus) }))
    .sort((a, b) => b.score - a.score);

  for (const [i, s] of scored.entries()) {
    console.log(`${i + 1}. [${s.score.toFixed(3)}] ${s.name}  (token=${s.token})`);
  }

  const HIGH_THRESHOLD = 0.7;
  const MARGIN = 0.15;
  const [top, second] = scored;
  if (top && top.score >= HIGH_THRESHOLD && (!second || top.score - second.score >= MARGIN)) {
    console.log(`\n=> 자동 매칭: "${top.name}" (property_token=${top.token})`);
  } else {
    console.log(`\n=> 후보 화면 (자동 매칭 임계값 미달 또는 margin 부족)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
