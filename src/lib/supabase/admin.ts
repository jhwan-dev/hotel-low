import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl, isSupabaseConfigured } from "./env";

/**
 * Service-role client — bypasses RLS entirely. The `import "server-only"`
 * above makes any accidental import from a client component a build error,
 * not just a lint warning: this file, and its service role key, can never
 * end up in a browser bundle.
 *
 * Only use this for the narrow set of writes RLS deliberately blocks for
 * everyone else — e.g. upserting the shared `hotels` catalog row a
 * tracked_hotels insert needs to point at (see
 * src/lib/tracking/supabaseRepository.ts). Never use it to read or write a
 * specific user's data; use src/lib/supabase/server.ts for that so RLS stays
 * the one source of truth for access control.
 */
export function createAdminClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase isn't configured (NEXT_PUBLIC_SUPABASE_URL missing). " +
        "Check isSupabaseConfigured() before calling createAdminClient().",
    );
  }
  return createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
