/**
 * Central place that reads Supabase env vars, so nothing else in the app
 * touches `process.env` directly. `isSupabaseConfigured()` is the single
 * switch every Mock/Supabase repository pair checks — leave .env.local blank
 * and the app runs entirely on mock data, fill it in and it doesn't.
 */

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** Server-only. Callers must already guard with `import "server-only"`. */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This code path must never run in the browser.",
    );
  }
  return key;
}
