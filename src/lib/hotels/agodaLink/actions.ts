"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { stayQueryToSearchParams, type StayQuery } from "@/lib/search/stay-query";
import { extractHotelNameFromText, extractUrlFromText, parseAgodaDetailUrl, resolveFinalUrl } from "./parse";
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
  /** Whether a candidate the user picks here still needs its name corrected on first tracking-start — see resolveOrInsertCatalogEntry's `nameIsProvisional` param. Same for every candidate in one response (they all came from the same hl=en/hl=ko call). */
  nameIsProvisional: boolean;
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
 * Takes whatever the user pasted — a bare URL, or a whole share sentence
 * like the iPhone app's native share sheet produces ("호텔 선라이트 신주쿠
 * 확인하기 https://www.agoda.com/sh-app/..."). Never throws — every
 * failure (not logged in, no URL in the text, blocked/unresolved redirect,
 * no match, rate limit) comes back as `{ error }`, same convention as
 * startTracking (see its own comment for why: an uncaught throw across
 * the Server Action boundary doesn't reliably reach the UI).
 */
export async function importFromAgodaLink(rawInput: string): Promise<AgodaImportResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  const found = extractUrlFromText(rawInput);
  if (!found) {
    // Temporary diagnostic — a real user hit this on production with text
    // that looked valid by every local test case tried so far. Logs the
    // exact bytes (char codes, not just the string) so a copy-paste-lost
    // character (smart punctuation, a non-breaking space, a BOM, ...)
    // shows up even if it's invisible in a terminal or chat message.
    console.error("importFromAgodaLink: no URL found in input", {
      length: rawInput.length,
      codes: [...rawInput].map((c) => c.codePointAt(0)).join(","),
      text: rawInput,
    });
    return { error: INVALID_LINK_ERROR };
  }
  const { url, startIndex } = found;
  if (url.protocol !== "https:") {
    console.error("importFromAgodaLink: non-https url found", { url: url.toString() });
    return { error: INVALID_LINK_ERROR };
  }

  // Best-effort — null just means the slug-based (hl=en) matching path
  // below handles it alone, exactly like a bare pasted link always did.
  const koreanName = extractHotelNameFromText(rawInput, startIndex);

  let parsed = parseAgodaDetailUrl(url);
  if (!parsed) {
    const resolved = await resolveFinalUrl(url);
    parsed = resolved ? parseAgodaDetailUrl(resolved) : null;
  }
  if (!parsed) return { error: NOT_A_HOTEL_LINK_ERROR };

  try {
    const result = await matchAgodaLink(
      parsed.detailPath,
      parsed.slug,
      parsed.citycode,
      parsed.stay,
      user.id,
      koreanName,
    );
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
        fallbackSearchQuery: koreanName ?? deslugifyHotelName(parsed.slug),
        nameIsProvisional: !koreanName,
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
  nameIsProvisional: boolean,
): Promise<AgodaImportResolved | AgodaImportError> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  try {
    const appHotelId = await resolveOrInsertCatalogEntry(candidate, detailPath, cityGuess, nameIsProvisional);
    return { redirectTo: toRedirectTo(appHotelId, stay, stayExplicit) };
  } catch (err) {
    console.error("confirmAgodaCandidate: unexpected error", err);
    return { error: "지금은 추가할 수 없어요. 잠시 후 다시 시도해주세요." };
  }
}
