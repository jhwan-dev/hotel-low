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
