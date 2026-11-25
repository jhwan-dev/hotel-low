export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** The Asia/Seoul calendar day (YYYY-MM-DD) an instant falls on. */
function seoulDayOf(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

/** "Today" as a plain YYYY-MM-DD in Asia/Seoul specifically, not wherever the server process happens to run (todayISO() uses the server's own TZ, which on Vercel is UTC) — for day-boundary decisions that should follow the Korean calendar day regardless of host. */
export function todayISOInSeoul(): string {
  return seoulDayOf(new Date());
}

/**
 * Leading YYYY-MM-DD of a bare date or a full ISO timestamp, or null when the
 * value isn't a date we can read. Postgres hands timestamptz columns back as
 * "2026-11-26T01:23:45.123+00:00", not "2026-11-26", and every formatter below
 * that appends "T00:00:00Z" to build a UTC day would otherwise land on an
 * Invalid Date and render NaN.
 */
export function dateOnlyISO(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(value.trim());
  if (!match) return null;
  const day = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isNaN(new Date(`${day}T00:00:00Z`).getTime()) ? null : day;
}

/** Calendar day (Asia/Seoul) a `checkedAt`-style value falls on — a bare date is its own day, a full timestamp is converted to Seoul time first. Null when unreadable. */
function seoulDayOfValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : seoulDayOf(instant);
}

export function addDaysISO(iso: string, days: number): string {
  const day = dateOnlyISO(iso);
  if (!day) throw new RangeError(`addDaysISO: unreadable date "${iso}"`);
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/** Plain day count from `fromISO` to `toISO` — positive when `toISO` is later. Accepts bare dates or full timestamps; 0 when either is unreadable. */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = dateOnlyISO(fromISO);
  const to = dateOnlyISO(toISO);
  if (!from || !to) return 0;
  const fromTime = new Date(`${from}T00:00:00Z`).getTime();
  const toTime = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24));
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = dateOnlyISO(checkIn);
  const end = dateOnlyISO(checkOut);
  if (!start || !end) return 1;
  const nights = daysBetween(start, end);
  return Math.max(1, nights);
}

export function formatDateLabel(iso: string): string {
  const day = dateOnlyISO(iso);
  if (!day) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** Short "M/D" label for compact UI (calendar triggers, chart axes). Empty when `iso` isn't a readable date. */
export function formatShortDate(iso: string): string {
  const day = dateOnlyISO(iso);
  if (!day) return "";
  const [, month, date] = day.split("-");
  return `${Number(month)}/${Number(date)}`;
}

/**
 * "오늘 확인" / "어제 확인" / "N일 전 확인" — for a price point's checkedAt.
 * Returns null when `iso` is missing or unreadable, so callers can leave the
 * label out entirely instead of rendering "NaN일 전 확인".
 *
 * Days are counted on the Korean calendar day (Asia/Seoul) rather than the
 * host's own timezone (UTC on Vercel): a price checked at 01:00 KST is
 * today's check for the user, even though its UTC date is still yesterday.
 */
export function formatRelativeDays(iso: string | null | undefined): string | null {
  const day = seoulDayOfValue(iso);
  if (!day) return null;
  const diffDays = daysBetween(day, todayISOInSeoul());
  if (diffDays <= 0) return "오늘 확인";
  if (diffDays === 1) return "어제 확인";
  return `${diffDays}일 전 확인`;
}

/** First day of the month `monthsFromToday` months after today, as YYYY-MM-01. */
export function startOfMonthISO(monthsFromToday: number): string {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsFromToday, 1));
  return toISODate(first);
}

export function addMonthsISO(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  return toISODate(shifted);
}

export function formatMonthLabel(iso: string): string {
  const day = dateOnlyISO(iso);
  if (!day) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * A 7-wide grid of the given month for calendar UIs: `null` for the padding
 * cells before day 1 / after the last day, an ISO date string otherwise.
 * `monthStartIso` must be the first of the month (see startOfMonthISO).
 */
export function getMonthGrid(monthStartIso: string): (string | null)[] {
  const [year, month] = monthStartIso.split("-").map(Number);
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (string | null)[] = Array.from({ length: startWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toISODate(new Date(Date.UTC(year, month - 1, day))));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
