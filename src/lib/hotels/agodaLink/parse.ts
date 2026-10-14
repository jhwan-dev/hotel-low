import "server-only";

import { addDaysISO } from "@/lib/date";
import { defaultStayQuery, type StayQuery } from "@/lib/search/stay-query";
import { extractDetailPath } from "./detailPath";

export interface ParsedAgodaLink {
  detailPath: string;
  /** Hyphenated hotel-name slug, e.g. "rihga-royal-hotel-osaka" — not yet de-slugified. */
  slug: string;
  /** Agoda's city code, e.g. "osaka-jp" — not yet turned into a city guess. */
  citycode: string;
  stay: StayQuery;
  /** False when the link had no `checkin`/`checkIn` at all and `stay` is purely defaultStayQuery() filler — not something the pasted link actually said. Callers use this to decide whether to carry `stay` into the redirect at all (see actions.ts) rather than presenting a fabricated date as if the user had chosen it. */
  stayExplicit: boolean;
}

const DETAIL_PATH_PATTERN = /^([^/]+)\/hotel\/([^/]+)\.html$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseNonNegativeInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseStayFromQuery(sp: URLSearchParams): { stay: StayQuery; explicit: boolean } {
  const checkInRaw = sp.get("checkin") ?? sp.get("checkIn");
  if (!checkInRaw || !ISO_DATE_PATTERN.test(checkInRaw)) {
    return { stay: defaultStayQuery(), explicit: false };
  }
  const checkIn = checkInRaw;

  const checkOutRaw = sp.get("checkOut") ?? sp.get("checkout");
  const losRaw = sp.get("los");
  const los = losRaw !== null ? Math.max(1, Number.parseInt(losRaw, 10) || 1) : null;
  const checkOut =
    checkOutRaw && ISO_DATE_PATTERN.test(checkOutRaw)
      ? checkOutRaw
      : addDaysISO(checkIn, los ?? 1);

  const adults = parsePositiveInt(sp.get("adults"), 2);
  const rooms = parsePositiveInt(sp.get("rooms"), 1);
  const children = parseNonNegativeInt(sp.get("childs") ?? sp.get("children"), 0);
  const childrenAgesRaw = sp.get("childages") ?? sp.get("childAges");
  const childrenAges = childrenAgesRaw
    ? childrenAgesRaw
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n >= 0)
    : [];

  return { stay: { checkIn, checkOut, rooms, adults, children, childrenAges }, explicit: true };
}

/** Parses an Agoda detail-page URL's path + stay query params. Returns null when the path isn't the `<slug>/hotel/<citycode>.html` shape (e.g. a search page, a still-unresolved short link). */
export function parseAgodaDetailUrl(url: URL): ParsedAgodaLink | null {
  const detailPath = extractDetailPath(url.pathname);
  if (!detailPath) return null;
  const match = DETAIL_PATH_PATTERN.exec(detailPath);
  if (!match) return null;
  const [, slug, citycode] = match;
  const { stay, explicit } = parseStayFromQuery(url.searchParams);
  return { detailPath, slug, citycode, stay, stayExplicit: explicit };
}

// ---------------------------------------------------------------------------
// Short-link resolution — see the plan's SSRF-safety writeup for why this
// only ever talks to a small allowed-host list, checked at every hop.
// ---------------------------------------------------------------------------

/**
 * Confirmed by directly tracing a real iPhone Agoda app share link
 * (`https://www.agoda.com/sh-app/<id>`): it 302s to `agoda.onelink.me`
 * (AppsFlyer OneLink) with the real destination already embedded in the
 * Location header's own `af_web_dp` query param — see resolveFinalUrl.
 * `agoda.sng.link` (Singular, a similar attribution-link provider) was
 * never actually observed and is deliberately left out; add it back if a
 * real link through it ever shows up.
 */
const ALLOWED_HOSTS = ["agoda.com", "www.agoda.com", "agoda.onelink.me"];

function isAllowedAgodaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function isAllowedAgodaUrl(url: URL): boolean {
  return url.protocol === "https:" && isAllowedAgodaHost(url.hostname);
}

const MAX_REDIRECT_HOPS = 3;
const FETCH_TIMEOUT_MS = 5000;

function log(stage: string, detail: Record<string, unknown>): void {
  console.log("[agodaLink.resolve]", { stage, ...detail });
}

async function fetchLocationHeader(url: URL): Promise<URL | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "manual", signal: controller.signal });
    log("fetch", { host: url.hostname, status: res.status });
    const location = res.headers.get("location");
    if (!location) return null;
    try {
      return new URL(location, url);
    } catch {
      return null;
    }
  } catch (err) {
    log("fetch-error", { host: url.hostname, error: String(err) });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** AppsFlyer OneLink's standard "web fallback" query param — holds the real destination URL, still URL-encoded. Confirmed present on the real share-link redirect traced above. */
function extractAfWebDp(url: URL): URL | null {
  const raw = url.searchParams.get("af_web_dp");
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Resolves a pasted Agoda link (possibly a short app-share link) down to
 * its real `agoda.com` detail-page URL. Never fetches anything outside
 * `ALLOWED_HOSTS`, over anything but https, at any hop — including the
 * very first URL. Returns null (not a thrown error) on any failure; the
 * caller decides the user-facing message.
 */
export async function resolveFinalUrl(input: URL): Promise<URL | null> {
  if (input.protocol === "https:" && parseAgodaDetailUrl(input)) return input;

  let current = input;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    if (!isAllowedAgodaUrl(current)) {
      log("blocked-host", { host: current.hostname, protocol: current.protocol });
      return null;
    }

    const location = await fetchLocationHeader(current);
    if (!location) return null;

    const afWebDp = extractAfWebDp(location);
    const next = afWebDp ?? location;

    if (!isAllowedAgodaUrl(next)) {
      log("blocked-host", { host: next.hostname, protocol: next.protocol });
      return null;
    }

    if (parseAgodaDetailUrl(next)) {
      log("resolved", { host: next.hostname });
      return next;
    }
    current = next;
  }

  log("exhausted-hops", {});
  return null;
}
