/**
 * One-off reproduction of a real matching failure: a pasted Agoda link for
 * "Toyoko Inn Osaka Sakuranomiya Eki Nishi-guchi" came back with 5 OTHER
 * Toyoko Inn branches as candidates, missing the actual shared hotel.
 * Makes exactly ONE real SerpApi call (same query construction as
 * src/lib/hotels/agodaLink/match.ts) and caches the raw response under
 * scripts/.output/ so this is reproducible without spending another call.
 * Run with `npm run debug:agoda-match`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { searchHotels } from "@/lib/hotels/serpapi/client";
import type { SerpApiListProperty, SerpApiSearchResponse } from "@/lib/hotels/serpapi/types";
import { cityGuessFromCityCode, deslugifyHotelName } from "@/lib/hotels/agodaLink/slug";
import { diceCoefficient } from "@/lib/hotels/agodaLink/similarity";

const OUTPUT_FILE = path.join(process.cwd(), "scripts", ".output", "coverage", "debug-toyoko-sakuranomiya.json");

const SLUG = "toyoko-inn-osaka-sakuranomiya-eki-nishi-guchi";
const CITYCODE = "osaka-jp";
const CHECK_IN = "2026-10-20";
const CHECK_OUT = "2026-10-21";

async function main() {
  const name = deslugifyHotelName(SLUG);
  const cityGuess = cityGuessFromCityCode(CITYCODE);
  const q = `${name} ${cityGuess}`;
  console.log("slug:", SLUG);
  console.log("deslugified name:", name);
  console.log("cityGuess:", cityGuess);
  console.log("SerpApi q:", q);

  const raw: SerpApiSearchResponse = await searchHotels({
    q,
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    adults: 2,
    children: 0,
    hl: "en",
  });

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(raw, null, 2));
  console.log(`\n원본 응답 캐시: ${OUTPUT_FILE}`);

  const properties: SerpApiListProperty[] = raw.properties ?? [];
  console.log(`\n응답 properties 개수: ${properties.length}`);

  const qualifying = properties.filter(
    (p) => p.type === "hotel" && typeof p.property_token === "string" && p.property_token.length > 0,
  );
  console.log(`qualifying(type=hotel && property_token 있음) 개수: ${qualifying.length}\n`);

  const scored = qualifying
    .map((p) => ({ name: p.name, token: p.property_token, score: diceCoefficient(name, p.name) }))
    .sort((a, b) => b.score - a.score);

  for (const [i, s] of scored.entries()) {
    console.log(`${i + 1}. [${s.score.toFixed(3)}] ${s.name}  (token=${s.token})`);
  }

  const exactMatch = scored.find((s) => s.name.toLowerCase().includes("sakuranomiya"));
  console.log(
    exactMatch
      ? `\n"sakuranomiya" 포함 후보: 순위 ${scored.indexOf(exactMatch) + 1}위, 점수 ${exactMatch.score.toFixed(3)}`
      : `\n"sakuranomiya" 포함 후보: 응답에 전혀 없음`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
