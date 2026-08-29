export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}

export function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

/** Short "M/D" label for compact UI (calendar triggers, chart axes). */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** "오늘 확인" / "어제 확인" / "N일 전 확인" — for a price point's checkedAt date. */
export function formatRelativeDays(iso: string): string {
  const diffDays = Math.round(
    (new Date(`${todayISO()}T00:00:00Z`).getTime() - new Date(`${iso}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24),
  );
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
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
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
