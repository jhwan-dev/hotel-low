import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  /** True for the mock stand-in used while Supabase isn't configured — never a real account. */
  isMock: boolean;
}

const MOCK_USER: CurrentUser = { id: "mock-user", email: "mock@hotelow.dev", isMock: true };

/**
 * The one place that answers "who's using the app right now". Before
 * Supabase is configured this always resolves to a fixed mock user, so
 * tracked_hotels etc. keep working as a single-user demo instead of forcing
 * a login wall before any sign-in UI exists. Once configured, it reflects
 * the real session (or `null` if nobody's signed in).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) {
    return MOCK_USER;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null, isMock: false };
}
