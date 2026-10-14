import "server-only";

import { hotelCatalog } from "@/lib/hotels";
import { CATALOG_CITIES, CATALOG_CITY_COUNTRY } from "@/lib/hotels/destinations";
import { searchHotels } from "@/lib/hotels/serpapi/client";
import { getSerpApiDailyLimit, isSerpApiConfigured } from "@/lib/hotels/serpapi/env";
import type { SerpApiListProperty, SerpApiSearchResponse } from "@/lib/hotels/serpapi/types";
import { tryConsumeDailyCall } from "@/lib/serpapi/callBudget";
import { tryConsumeAgodaImportDaily } from "@/lib/supabase/agodaImportLog";
import { createAdminClient } from "@/lib/supabase/admin";
import { fillAgodaDetailPathIfEmpty, insertHotelFromAgodaMatch } from "@/lib/supabase/hotelsTable";
import type { StayQuery } from "@/lib/search/stay-query";
import { cityGuessFromCityCode, deslugifyHotelName } from "./slug";
import { weightedTokenScore } from "./similarity";

/**
 * Calibrated against two zero/near-zero-cost datasets (scripts/calibrate-
 * agoda-match.ts): the 22 hand-filled catalog hotels' slugs scored at most
 * 0.504 against each other same-city, and a real production failure case
 * (a Toyoko Inn branch missing from its own search response — see
 * scripts/.output/coverage/debug-toyoko-sakuranomiya.json) put the
 * highest-scoring WRONG sibling branch at 0.452. Both constants sit
 * comfortably above that ceiling.
 *
 * This replaced a plain character-bigram Dice score (diceCoefficient),
 * which scored that same wrong Toyoko Inn branch at 0.703 — high enough
 * to risk auto-matching it — because chain-hotel names are mostly shared
 * boilerplate ("Toyoko Inn Osaka ... Eki Nishiguchi") with only one or two
 * words actually distinguishing one branch from another. weightedTokenScore
 * downweights whatever word every candidate in the pool shares and
 * upweights whatever word only a few do, which is exactly what
 * disambiguates branches of the same chain.
 */
const HIGH_THRESHOLD = 0.7;
const MARGIN = 0.15;
const MAX_CANDIDATES = 8;

export interface AgodaCandidate {
  propertyToken: string;
  name: string;
  rating: number;
  reviewCount: number;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type MatchResult =
  | { kind: "resolved"; appHotelId: string }
  | { kind: "candidates"; candidates: AgodaCandidate[] }
  | { kind: "error"; message: string };

function toCandidate(p: SerpApiListProperty): AgodaCandidate {
  return {
    propertyToken: p.property_token ?? "",
    name: p.name,
    rating: p.overall_rating ?? 0,
    reviewCount: p.reviews ?? 0,
    image: p.images?.[0]?.original_image ?? p.images?.[0]?.thumbnail ?? null,
    latitude: p.gps_coordinates?.latitude ?? null,
    longitude: p.gps_coordinates?.longitude ?? null,
  };
}

/**
 * SerpApi's google_hotels list endpoint normally returns `{ properties: [...] }`,
 * but when the query matches one property closely enough it may respond
 * with that property's own detail-shaped object at the top level instead
 * (no `properties` array at all) — defensive handling, not confirmed
 * against a real response yet; see the plan's verification notes. Treated
 * as a single-item candidate list either way.
 */
function normalizeSearchResponse(raw: SerpApiSearchResponse): SerpApiListProperty[] {
  if (raw.properties && raw.properties.length > 0) return raw.properties;

  const maybeDetail = raw as unknown as {
    property_token?: string;
    name?: string;
    gps_coordinates?: SerpApiListProperty["gps_coordinates"];
    overall_rating?: number;
    reviews?: number;
    images?: SerpApiListProperty["images"];
  };
  if (typeof maybeDetail.property_token === "string" && maybeDetail.property_token.length > 0) {
    return [
      {
        type: "hotel",
        name: maybeDetail.name ?? "",
        property_token: maybeDetail.property_token,
        gps_coordinates: maybeDetail.gps_coordinates,
        overall_rating: maybeDetail.overall_rating,
        reviews: maybeDetail.reviews,
        images: maybeDetail.images,
      },
    ];
  }
  return [];
}

function qualifyingCandidates(raw: SerpApiSearchResponse): SerpApiListProperty[] {
  return normalizeSearchResponse(raw).filter(
    (p) => p.type === "hotel" && typeof p.property_token === "string" && p.property_token.length > 0,
  );
}

function resolveCityCountry(cityGuess: string): { city: string; country: string } {
  const match = CATALOG_CITIES.find((c) => c.toLowerCase() === cityGuess.toLowerCase());
  if (match) return { city: match, country: CATALOG_CITY_COUNTRY[match] };
  return { city: cityGuess, country: "" };
}

/**
 * Checks for an existing catalog row under this `property_token` before
 * ever inserting a new one — most of the 400+ seeded hotels have no
 * `agoda_detail_path` yet, so a paste-import match usually lands here
 * instead of creating a duplicate. Called by both the auto-match branch
 * below and confirmAgodaCandidate (actions.ts) — one shared code path, so
 * "never duplicate a property_token" holds regardless of which route
 * picked the candidate.
 */
export async function resolveOrInsertCatalogEntry(
  candidate: AgodaCandidate,
  detailPath: string,
  cityGuess: string,
): Promise<string> {
  const existing = await hotelCatalog.findByProviderHotelId(candidate.propertyToken);
  const admin = createAdminClient();

  if (existing) {
    if (!existing.agodaDetailPath) {
      await fillAgodaDetailPathIfEmpty(admin, existing.appHotelId, detailPath);
    }
    return existing.appHotelId;
  }

  const { city, country } = resolveCityCountry(cityGuess);
  return insertHotelFromAgodaMatch(admin, {
    provider: "agoda",
    providerHotelId: candidate.propertyToken,
    name: candidate.name,
    city,
    country,
    address: "",
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    images: candidate.image ? [candidate.image] : [],
    amenities: [],
    agodaDetailPath: detailPath,
  });
}

/**
 * Resolves a pasted/parsed Agoda link to an app hotel id — either directly
 * (already-catalogued fast path, or confidently auto-matched) or by
 * returning candidates for the user to pick from. `citycode` is the raw
 * value from the URL (e.g. "osaka-jp") — this derives both the SerpApi
 * query's city term and, on insert, the catalog row's city/country.
 */
export async function matchAgodaLink(
  detailPath: string,
  slug: string,
  citycode: string,
  stay: StayQuery,
  userId: string,
): Promise<MatchResult> {
  const existing = await hotelCatalog.findByAgodaDetailPath(detailPath);
  if (existing) return { kind: "resolved", appHotelId: existing.appHotelId };

  if (!isSerpApiConfigured()) {
    return { kind: "error", message: "지금은 이 기능을 사용할 수 없어요." };
  }

  const userAllowed = await tryConsumeAgodaImportDaily(userId);
  if (!userAllowed) {
    return { kind: "error", message: "오늘 아고다 링크로 추가할 수 있는 횟수를 다 썼어요. 내일 다시 시도해주세요." };
  }
  const globalAllowed = await tryConsumeDailyCall(getSerpApiDailyLimit());
  if (!globalAllowed) {
    return { kind: "error", message: "잠시 후 다시 시도해주세요." };
  }

  const cityGuess = cityGuessFromCityCode(citycode);
  const name = deslugifyHotelName(slug);
  // Skip appending cityGuess when the de-slugified name already contains
  // it (true for most hotel slugs, which bake the city into their own
  // name) — a repeated word in the query doesn't help Google disambiguate
  // and risks diluting relevance. See the real failure case this was
  // found from: scripts/.output/coverage/debug-toyoko-sakuranomiya.json.
  const queryTerms = name.toLowerCase().includes(cityGuess.toLowerCase()) ? name : `${name} ${cityGuess}`;

  let raw: SerpApiSearchResponse;
  try {
    raw = await searchHotels({
      q: queryTerms,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: stay.adults,
      children: stay.children,
      hl: "en",
    });
  } catch (err) {
    console.error("matchAgodaLink: SerpApi search failed", err);
    return { kind: "error", message: "잠시 후 다시 시도해주세요." };
  }

  const candidates = qualifyingCandidates(raw);
  if (candidates.length === 0) {
    return { kind: "error", message: "이 링크의 호텔을 찾지 못했어요." };
  }

  if (candidates.length === 1) {
    const appHotelId = await resolveOrInsertCatalogEntry(toCandidate(candidates[0]), detailPath, cityGuess);
    return { kind: "resolved", appHotelId };
  }

  // corpus = every candidate name in *this* response — weightedTokenScore
  // uses it to figure out which words are chain-wide boilerplate (shared
  // by most/all of them, downweighted) vs. actually distinguishing.
  const corpus = candidates.map((p) => p.name);
  const scored = candidates
    .map((p) => ({ property: p, score: weightedTokenScore(name, p.name, corpus) }))
    .sort((a, b) => b.score - a.score);
  const [top, second] = scored;

  if (top.score >= HIGH_THRESHOLD && (!second || top.score - second.score >= MARGIN)) {
    const appHotelId = await resolveOrInsertCatalogEntry(toCandidate(top.property), detailPath, cityGuess);
    return { kind: "resolved", appHotelId };
  }

  return {
    kind: "candidates",
    candidates: scored.slice(0, MAX_CANDIDATES).map((s) => toCandidate(s.property)),
  };
}
