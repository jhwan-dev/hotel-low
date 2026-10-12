/**
 * Suggested first alert threshold: 10% off the confirmed current price,
 * rounded to the nearest ₩1,000. Used both client-side (PriceTrackingSheet's
 * initial input value when the price is already known) and server-side
 * (SupabaseTrackedHotelsRepository.upsert, when the client couldn't compute
 * this itself because the price was still unknown at submit time).
 */
export function defaultTargetPrice(currentPrice: number): number {
  return Math.round((currentPrice * 0.9) / 1000) * 1000;
}
