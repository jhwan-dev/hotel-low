/**
 * Standalone check (not part of the Next.js app): does SerpApi's
 * engine=google_hotels response actually carry an Agoda price anywhere, and
 * if so, in the list search response or only in the per-property detail
 * response (property_token)? Run with `npm run verify:serpapi`.
 *
 * Deliberately does not assume SerpApi's exact field names — it dumps both
 * raw responses to scripts/.output/ and recursively scans them for any
 * string containing "agoda" and any key named like "source", so the answer
 * comes from the real response shape, not a guess.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", ".output");

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function requireApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    console.error(
      "SERPAPI_API_KEY is not set. Run via `npm run verify:serpapi` so .env.local is loaded.",
    );
    process.exit(1);
  }
  return key;
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchJson(params: Record<string, string>): Promise<JsonValue> {
  const url = new URL("https://serpapi.com/search.json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return fetchUrl(url.toString());
}

async function fetchUrl(url: string): Promise<JsonValue> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SerpApi request failed: ${res.status} ${res.statusText}\n${await res.text()}`);
  }
  return (await res.json()) as JsonValue;
}

/** Collects dotted JSON paths of every string value that contains "agoda" (case-insensitive). */
function collectAgodaMentions(value: JsonValue, pathParts: string[], hits: string[]): void {
  if (typeof value === "string") {
    if (value.toLowerCase().includes("agoda")) hits.push(pathParts.join(".") || "(root)");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectAgodaMentions(v, [...pathParts, String(i)], hits));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) collectAgodaMentions(v, [...pathParts, key], hits);
  }
}

/** Collects every string value found under a key whose name contains "source". */
function collectSourceValues(value: JsonValue, values: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((v) => collectSourceValues(v, values));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (key.toLowerCase().includes("source") && typeof v === "string") values.add(v);
      collectSourceValues(v, values);
    }
  }
}

function summarize(label: string, data: JsonValue): { hasAgoda: boolean } {
  const agodaHits: string[] = [];
  collectAgodaMentions(data, [], agodaHits);
  const sourceValues = new Set<string>();
  collectSourceValues(data, sourceValues);

  console.log(`\n--- ${label} ---`);
  console.log(`agoda mentioned: ${agodaHits.length > 0 ? "YES" : "no"}`);
  if (agodaHits.length > 0) {
    const shown = agodaHits.slice(0, 10).join(", ");
    const more = agodaHits.length > 10 ? ` (+${agodaHits.length - 10} more)` : "";
    console.log(`  paths: ${shown}${more}`);
  }
  console.log(
    `source values found: ${sourceValues.size > 0 ? [...sourceValues].join(", ") : "(none)"}`,
  );

  return { hasAgoda: agodaHits.length > 0 };
}

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main() {
  const apiKey = requireApiKey();
  await mkdir(OUTPUT_DIR, { recursive: true });

  const checkIn = addDaysISO(1);
  const checkOut = addDaysISO(2);

  console.log(`Searching Google Hotels (check_in=${checkIn}, check_out=${checkOut})...`);
  const searchResponse = await fetchJson({
    engine: "google_hotels",
    q: "Seoul Hotels",
    gl: "kr",
    hl: "ko",
    currency: "KRW",
    check_in_date: checkIn,
    check_out_date: checkOut,
    adults: "2",
    api_key: apiKey,
  });
  await writeFile(
    path.join(OUTPUT_DIR, "search-response.json"),
    JSON.stringify(searchResponse, null, 2),
  );

  const properties = isRecord(searchResponse) && Array.isArray(searchResponse.properties)
    ? searchResponse.properties
    : [];
  const withToken = properties.find(
    (p): p is { [key: string]: JsonValue } => isRecord(p) && typeof p.property_token === "string",
  );

  const listSummary = summarize("search-response.json (목록)", searchResponse);

  if (!withToken) {
    console.warn(
      "\n목록 응답에서 property_token을 가진 호텔을 찾지 못해 상세 조회는 건너뜁니다.",
    );
    console.log(`\n=== 결론: 아고다 가격/표기는 ${listSummary.hasAgoda ? "목록 응답에서만" : "둘 다 없음"} ===`);
    return;
  }

  console.log(
    `\nFetching detail for property_token=${withToken.property_token} (${withToken.name ?? "이름 없음"})...`,
  );
  // SerpApi includes the exact URL for the detail request (serpapi_property_details_link)
  // on each list entry — using it verbatim avoids guessing which params it needs (it
  // turns out `q` is required there too, which isn't obvious from the docs alone).
  const detailsLink = typeof withToken.serpapi_property_details_link === "string"
    ? withToken.serpapi_property_details_link
    : null;
  const detailResponse = await (detailsLink
    ? fetchUrl(`${detailsLink}&api_key=${apiKey}`)
    : fetchJson({
        engine: "google_hotels",
        q: "Seoul Hotels",
        property_token: String(withToken.property_token),
        gl: "kr",
        hl: "ko",
        currency: "KRW",
        check_in_date: checkIn,
        check_out_date: checkOut,
        adults: "2",
        api_key: apiKey,
      }));
  await writeFile(
    path.join(OUTPUT_DIR, "detail-response.json"),
    JSON.stringify(detailResponse, null, 2),
  );

  const detailSummary = summarize("detail-response.json (상세)", detailResponse);

  let conclusion: string;
  if (listSummary.hasAgoda && detailSummary.hasAgoda) conclusion = "둘 다 (목록 + 상세)";
  else if (listSummary.hasAgoda) conclusion = "목록 응답에서만";
  else if (detailSummary.hasAgoda) conclusion = "상세 응답에서만";
  else conclusion = "둘 다 없음";

  console.log(`\n=== 결론: 아고다 가격/표기는 ${conclusion} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
