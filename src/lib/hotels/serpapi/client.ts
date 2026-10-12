import "server-only";

import { getSerpApiKey } from "./env";
import type { SerpApiPropertyDetails, SerpApiSearchParams, SerpApiSearchResponse } from "./types";

const SERPAPI_BASE_URL = "https://serpapi.com/search.json";

async function fetchSerpApi(params: Record<string, string>): Promise<unknown> {
  const url = new URL(SERPAPI_BASE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("api_key", getSerpApiKey());

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SerpApi request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function baseParams(params: SerpApiSearchParams): Record<string, string> {
  const base: Record<string, string> = {
    engine: "google_hotels",
    q: params.q,
    gl: "kr",
    hl: "ko",
    currency: "KRW",
    check_in_date: params.checkIn,
    check_out_date: params.checkOut,
    adults: String(params.adults),
  };
  if (params.children !== undefined) base.children = String(params.children);
  return base;
}

/** One list/search call — returns properties with price+token already merged (no separate content call, unlike Agoda). */
export async function searchHotels(params: SerpApiSearchParams): Promise<SerpApiSearchResponse> {
  return (await fetchSerpApi(baseParams(params))) as SerpApiSearchResponse;
}

/**
 * One property-detail call for a single `property_token`. SerpApi requires
 * `q` on this call too even though the token alone identifies the property
 * (confirmed empirically — a token-only request 400s with "Missing query
 * `q` parameter", see scripts/verify-serpapi-hotels.ts).
 */
export async function getPropertyDetails(
  params: SerpApiSearchParams & { propertyToken: string },
): Promise<SerpApiPropertyDetails> {
  return (await fetchSerpApi({
    ...baseParams(params),
    property_token: params.propertyToken,
  })) as SerpApiPropertyDetails;
}
