"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "./env";

/**
 * Browser-side client — anon key only. Safe to import from client
 * components; access to data is entirely governed by the RLS policies in
 * supabase/migrations/0001_init.sql, not by keeping this key secret.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase isn't configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing). " +
        "Check isSupabaseConfigured() before calling createClient().",
    );
  }
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
