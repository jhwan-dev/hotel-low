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
 *
 * Also calibrated for the Korean-name path (hl=ko, used when the share
 * text's own name is available) against all 400+ catalog hotels' real
 * hl=ko names directly (no proxy needed — every hotel already has one):
 * different hotels in the same city scored up to 0.454 (excluding ties
 * where a query name is a strict word-subset of a sibling's longer name,
 * e.g. "인터컨티넨탈 도쿄" vs "인터컨티넨탈 도쿄 베이" — those legitimately
 * tie at 1.0 under this directional scoring and fall through to the
 * candidate picker via the MARGIN check below, which is the correct,
 * safe outcome for a genuinely ambiguous short query). Same constants
 * work for both languages — the algorithm only reasons about whole
 * tokens and corpus frequency, not about what script they're written in.
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
  /** True when `candidate.name` came from an hl=en query (English) and still needs swapping for the real hl=ko name later — see resolveProvisionalName. False when it's already a real Korean name (hl=ko match, or the user's own share-text). */
  nameIsProvisional: boolean,
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
    nameIsProvisional,
  });
}

/**
 * Resolves a pasted/parsed Agoda link to an app hotel id — either directly
 * (already-catalogued fast path, or confidently auto-matched) or by
 * returning candidates for the user to pick from. `citycode` is the raw
 * value from the URL (e.g. "osaka-jp") — this derives both the SerpApi
 * query's city term and, on insert, the catalog row's city/country.
 *
 * `koreanName`, when given, is the hotel name pulled from the share
 * sentence's own text (see parse.ts's extractHotelNameFromText) — a real
 * display name, not a guess, and in the same language (hl=ko) the
 * catalog's other 400 hotels were seeded in. When present this entirely
 * replaces the English-slug approach: query *and* score in Korean, so
 * there's no cross-language mismatch to fight (that mismatch is exactly
 * why the slug path needs hl=en in the first place — see below). Falls
 * back to the slug whenever there's no usable name text, so a bare pasted
 * link keeps working exactly as before.
 */
export async function matchAgodaLink(
  detailPath: string,
  slug: string,
  citycode: string,
  stay: StayQuery,
  userId: string,
  koreanName?: string | null,
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
  // hl=ko + the real Korean name when we have one; hl=en + the de-slugified
  // English name otherwise. Either way `queryName` is what gets both sent
  // to SerpApi and compared against the candidates it returns — same
  // language on both sides of that comparison, every time.
  const hl = koreanName ? "ko" : "en";
  const queryName = koreanName ?? deslugifyHotelName(slug);
  const nameIsProvisional = !koreanName;
  // Skip appending cityGuess when queryName already contains it (true for
  // most English slugs, which bake the city into their own name) — a
  // repeated word doesn't help Google disambiguate and risks diluting
  // relevance (see the real failure case this was found from:
  // scripts/.output/coverage/debug-toyoko-sakuranomiya.json). Korean names
  // never textually contain the English cityGuess, so this only ever
  // short-circuits on the slug path.
  const queryTerms = queryName.toLowerCase().includes(cityGuess.toLowerCase())
    ? queryName
    : `${queryName} ${cityGuess}`;

  let raw: SerpApiSearchResponse;
  try {
    raw = await searchHotels({
      q: queryTerms,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: stay.adults,
      children: stay.children,
      hl,
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
    const appHotelId = await resolveOrInsertCatalogEntry(
      toCandidate(candidates[0]),
      detailPath,
      cityGuess,
      nameIsProvisional,
    );
    return { kind: "resolved", appHotelId };
  }

  // corpus = every candidate name in *this* response — weightedTokenScore
  // uses it to figure out which words are chain-wide boilerplate (shared
  // by most/all of them, downweighted) vs. actually distinguishing. Works
  // the same way regardless of language — it only ever looks at whole
  // tokens and how many candidates share each one.
  const corpus = candidates.map((p) => p.name);
  const scored = candidates
    .map((p) => ({ property: p, score: weightedTokenScore(queryName, p.name, corpus) }))
    .sort((a, b) => b.score - a.score);
  const [top, second] = scored;

  if (top.score >= HIGH_THRESHOLD && (!second || top.score - second.score >= MARGIN)) {
    const appHotelId = await resolveOrInsertCatalogEntry(
      toCandidate(top.property),
      detailPath,
      cityGuess,
      nameIsProvisional,
    );
    return { kind: "resolved", appHotelId };
  }

  return {
    kind: "candidates",
    candidates: scored.slice(0, MAX_CANDIDATES).map((s) => toCandidate(s.property)),
  };
}
