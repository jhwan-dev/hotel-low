import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Per-user daily cap on the Agoda-link paste-import flow
 * (src/lib/hotels/agodaLink/match.ts) — separate from, and consumed
 * alongside, the global tryConsumeDailyCall budget in
 * src/lib/serpapi/callBudget.ts. That one has no user_id, so without this
 * a single user could exhaust the whole day's shared SerpApi budget just
 * by pasting misses. See supabase/migrations/0012_agoda_import_log.sql.
 */
export async function tryConsumeAgodaImportDaily(userId: string, limitCount = 5): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("try_increment_agoda_import_log", {
    p_user_id: userId,
    limit_count: limitCount,
  });
  if (error) throw error;
  return Boolean(data);
}
