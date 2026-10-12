import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Atomically checks-and-spends one call against today's shared SerpApi
 * budget (supabase/migrations/0008_serpapi_call_log.sql). Returns `false`
 * without having spent anything if `limitCount` is already reached.
 *
 * `limitCount` is provided by the caller, not read from env here, so the
 * same counter can be checked against two different ceilings: cron passes
 * `dailyLimit - cronReserve` (see src/lib/notifications/checkPriceAlerts.ts),
 * tracking-start passes the full `dailyLimit` (see
 * src/lib/tracking/supabaseRepository.ts) — the reserve is headroom cron
 * must never spend into, not a separate budget.
 */
export async function tryConsumeDailyCall(limitCount: number): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("try_increment_serpapi_call_log", {
    limit_count: limitCount,
  });
  if (error) throw error;
  return Boolean(data);
}
