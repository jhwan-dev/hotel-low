import { addDaysISO, nightsBetween } from "@/lib/date";

/** FNV-1a 32-bit — turns a string id into a stable seed. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Well-mixed 0..1 value from (seed, dayIndex). A plain string hash of
 * "id-2026-08-27" vs "id-2026-08-28" only differs in its last character, and
 * a naive polynomial hash barely moves between them — the result would be a
 * smooth ramp, not something that looks like a price chart. Mixing the day
 * index in as an integer with a full avalanche step (murmur3-style) fixes
 * that: consecutive days land far apart, like real daily price noise.
 */
export function seededUnit(seed: number, dayIndex: number): number {
  let h = (seed ^ Math.imul(dayIndex, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

export function dayIndexOf(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

/** Nightly rate for one calendar date — captures weekday/seasonal pattern, independent of when it's booked. */
export function nightlyRateForDate(seedKey: string, basePrice: number, date: string): number {
  const seed = hashString(seedKey);
  const dayIndex = dayIndexOf(date);

  const noise = seededUnit(seed, dayIndex) * 2 - 1; // [-1, 1], night-to-night jitter
  const period = 12 + (seed % 20); // 12–31 day seasonal cycle, per hotel
  const phase = ((seed >>> 8) % 1000) / 1000;
  const wave = Math.sin(dayIndex / period + phase * Math.PI * 2);

  const fluctuation = 1 + noise * 0.08 + wave * 0.07;
  return Math.round((basePrice * fluctuation) / 100) * 100;
}

export function nightlyRatesForStay(
  seedKey: string,
  basePrice: number,
  checkIn: string,
  checkOut: string,
): number[] {
  const nights = nightsBetween(checkIn, checkOut);
  return Array.from({ length: nights }, (_, i) =>
    nightlyRateForDate(seedKey, basePrice, addDaysISO(checkIn, i)),
  );
}

/**
 * What a provider would quote for this exact (checkIn, checkOut) stay had it
 * been polled on `checkedAt` — this is what varies in hotel_price_history,
 * since the stay itself never changes once a user starts tracking it. Built
 * from the stay's baseline seasonal rate plus a second, independent
 * day-to-day fluctuation seeded by checkedAt, simulating ordinary
 * demand-based quote volatility as observed over the tracking window.
 */
export function priceCheckedOn(
  seedKey: string,
  basePrice: number,
  checkIn: string,
  checkOut: string,
  checkedAt: string,
): number {
  const rates = nightlyRatesForStay(seedKey, basePrice, checkIn, checkOut);
  const baseline = rates.reduce((sum, p) => sum + p, 0) / rates.length;

  const staySeed = hashString(`${seedKey}-${checkIn}-${checkOut}`);
  const dayIndex = dayIndexOf(checkedAt);

  const noise = seededUnit(staySeed, dayIndex) * 2 - 1;
  const period = 8 + (staySeed % 15); // shorter cycle: day-to-day quote noise, not seasonality
  const phase = ((staySeed >>> 8) % 1000) / 1000;
  const wave = Math.sin(dayIndex / period + phase * Math.PI * 2);

  const fluctuation = 1 + noise * 0.05 + wave * 0.06;
  return Math.round((baseline * fluctuation) / 100) * 100;
}
