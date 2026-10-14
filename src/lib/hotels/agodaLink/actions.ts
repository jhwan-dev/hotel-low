"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { stayQueryToSearchParams, type StayQuery } from "@/lib/search/stay-query";
import { parseAgodaDetailUrl, resolveFinalUrl } from "./parse";
import { cityGuessFromCityCode, deslugifyHotelName } from "./slug";
import { matchAgodaLink, resolveOrInsertCatalogEntry, type AgodaCandidate } from "./match";

export interface AgodaImportError {
  error: string;
}

export interface AgodaImportResolved {
  redirectTo: string;
}

export interface AgodaImportCandidates {
  candidates: AgodaCandidate[];
  detailPath: string;
  cityGuess: string;
  stay: StayQuery;
  stayExplicit: boolean;
  /** Pre-filled destination for the "목록에 없어요" escape hatch — links to the normal name-search page (/search?destination=...), which already does a loose ilike match against hotel names, not just cities. */
  fallbackSearchQuery: string;
}

export type AgodaImportResult = AgodaImportResolved | AgodaImportCandidates | AgodaImportError;

/**
 * When the pasted link actually specified dates, jump straight into the
 * tracking-settings sheet pre-filled with them (startTracking=1 — see
 * PriceTrackingCta's autoOpen). When it didn't, `stay` is pure
 * defaultStayQuery() filler, not something the user chose — landing on a
 * bare `/hotels/${id}` instead reuses the existing "arrived without
 * context" path (same as HotelDealCard's plain detail link): the normal
 * today/tomorrow default still shows, but unconfirmed, and tapping "가격
 * 추적 시작" opens the date/guest picker first instead of forcing a
 * fabricated date on the user.
 */
function toRedirectTo(appHotelId: string, stay: StayQuery, stayExplicit: boolean): string {
  if (!stayExplicit) return `/hotels/${appHotelId}`;
  return `/hotels/${appHotelId}?${stayQueryToSearchParams(stay).toString()}&startTracking=1`;
}

const INVALID_LINK_ERROR = "올바른 아고다 링크를 붙여넣어 주세요.";
const NOT_A_HOTEL_LINK_ERROR = "이 링크에서 호텔 정보를 찾을 수 없어요. 호텔 상세 페이지 링크를 붙여넣어 주세요.";

/**
 * Entry point for the "아고다 링크로 추적하기" input (home + search screens).
 * Never throws — every failure (not logged in, bad URL, blocked/unresolved
 * redirect, no match, rate limit) comes back as `{ error }`, same
 * convention as startTracking (see its own comment for why: an uncaught
 * throw across the Server Action boundary doesn't reliably reach the UI).
 */
export async function importFromAgodaLink(rawUrl: string): Promise<AgodaImportResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { error: INVALID_LINK_ERROR };
  }
  if (url.protocol !== "https:") return { error: INVALID_LINK_ERROR };

  let parsed = parseAgodaDetailUrl(url);
  if (!parsed) {
    const resolved = await resolveFinalUrl(url);
    parsed = resolved ? parseAgodaDetailUrl(resolved) : null;
  }
  if (!parsed) return { error: NOT_A_HOTEL_LINK_ERROR };

  try {
    const result = await matchAgodaLink(parsed.detailPath, parsed.slug, parsed.citycode, parsed.stay, user.id);
    if (result.kind === "resolved") {
      return { redirectTo: toRedirectTo(result.appHotelId, parsed.stay, parsed.stayExplicit) };
    }
    if (result.kind === "candidates") {
      return {
        candidates: result.candidates,
        detailPath: parsed.detailPath,
        cityGuess: cityGuessFromCityCode(parsed.citycode),
        stay: parsed.stay,
        stayExplicit: parsed.stayExplicit,
        fallbackSearchQuery: deslugifyHotelName(parsed.slug),
      };
    }
    return { error: result.message };
  } catch (err) {
    console.error("importFromAgodaLink: unexpected error", err);
    return { error: "지금은 추가할 수 없어요. 잠시 후 다시 시도해주세요." };
  }
}

/**
 * Finalizes a user's pick from the candidate-picker screen. Reuses
 * matchAgodaLink's own resolveOrInsertCatalogEntry (not a copy) so a
 * manually-picked candidate is deduplicated against the catalog exactly
 * the same way an auto-matched one is. No SerpApi call — `candidate` is
 * whatever importFromAgodaLink already returned from the one search call
 * it already spent.
 */
export async function confirmAgodaCandidate(
  candidate: AgodaCandidate,
  detailPath: string,
  cityGuess: string,
  stay: StayQuery,
  stayExplicit: boolean,
): Promise<AgodaImportResolved | AgodaImportError> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  try {
    const appHotelId = await resolveOrInsertCatalogEntry(candidate, detailPath, cityGuess);
    return { redirectTo: toRedirectTo(appHotelId, stay, stayExplicit) };
  } catch (err) {
    console.error("confirmAgodaCandidate: unexpected error", err);
    return { error: "지금은 추가할 수 없어요. 잠시 후 다시 시도해주세요." };
  }
}
