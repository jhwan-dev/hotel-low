import { addDaysISO, formatShortDate, todayISO } from "@/lib/date";

/** What every search form collects — mirrors AgodaSearchCriteria's checkIn/checkOut/rooms/adults/children/childrenAges. */
export interface StayQuery {
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  childrenAges: number[];
}

export function defaultStayQuery(): StayQuery {
  const checkIn = todayISO();
  return {
    checkIn,
    checkOut: addDaysISO(checkIn, 1),
    rooms: 1,
    adults: 2,
    children: 0,
    childrenAges: [],
  };
}

export function formatDateRangeLabel(checkIn: string, checkOut: string): string {
  return `${formatShortDate(checkIn)} - ${formatShortDate(checkOut)}`;
}

export function formatGuestsLabel(rooms: number, adults: number, children: number): string {
  const parts = [`객실 ${rooms}`, `성인 ${adults}`];
  if (children > 0) parts.push(`아동 ${children}`);
  return parts.join(" · ");
}

/** Next.js searchParams' actual runtime shape — a plain query-string bag. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toIntList(value: string | string[] | undefined): number[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(Number).filter((n) => Number.isFinite(n));
}

/**
 * Parses checkIn/checkOut/rooms/adults/children/childrenAges out of a page's
 * searchParams, defaulting anything missing — shared by /search and
 * /hotels/[id] so both pages read the same query string the same way.
 */
export function parseStayQuery(sp: RawSearchParams): StayQuery {
  const checkIn = firstParam(sp.checkIn) ?? todayISO();
  const checkOut = firstParam(sp.checkOut) ?? addDaysISO(checkIn, 1);
  return {
    checkIn,
    checkOut,
    rooms: Number(firstParam(sp.rooms) ?? 1) || 1,
    adults: Number(firstParam(sp.adults) ?? 2) || 2,
    children: Number(firstParam(sp.children) ?? 0) || 0,
    childrenAges: toIntList(sp.childrenAges),
  };
}

/**
 * True only when the caller's URL itself specified a stay — as opposed to
 * parseStayQuery() having silently filled in today/tomorrow/2 adults. Used
 * to tell "arrived via a real search" (show it, let tracking start
 * immediately) apart from "arrived with no context" (ask before tracking).
 */
export function hasExplicitStay(sp: RawSearchParams): boolean {
  return firstParam(sp.checkIn) !== undefined && firstParam(sp.checkOut) !== undefined;
}

/** Builds a checkIn/checkOut/rooms/adults/children/childrenAges query string from a StayQuery. */
export function stayQueryToSearchParams(stay: StayQuery): URLSearchParams {
  const params = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    rooms: String(stay.rooms),
    adults: String(stay.adults),
    children: String(stay.children),
  });
  for (const age of stay.childrenAges) params.append("childrenAges", String(age));
  return params;
}
