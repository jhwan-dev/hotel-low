import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "./env";

/**
 * Server Component / Server Action client — still just the anon key, but
 * reads the caller's session from cookies so RLS sees the real signed-in
 * user (auth.uid()). This is what tracked_hotels/price_alerts reads and
 * writes go through; it can never bypass RLS, so it's safe even though it
 * runs with "the current user's" identity.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase isn't configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing). " +
        "Check isSupabaseConfigured() before calling createClient().",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where cookies are
          // read-only. Session refresh still happens via middleware.ts.
        }
      },
    },
  });
}
