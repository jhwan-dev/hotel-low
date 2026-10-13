"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./getCurrentUser";
import { safeNextPath } from "./safeNextPath";

export async function signOut(next?: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(safeNextPath(next));
}

/**
 * Deletes the signed-in user's account entirely. Every personal-data table
 * (trips, tracked_hotels, price_alerts, device_tokens) references
 * public.users(id) on delete cascade, and public.users itself references
 * auth.users(id) on delete cascade (supabase/migrations/0001_init.sql,
 * 0011_push_device_tokens.sql) — deleting the auth user is the one write
 * that removes all of it. hotels and hotel_price_history are untouched:
 * shared catalog/price data, not tied to this user.
 */
export async function deleteAccount(): Promise<{ error: string } | void> {
  const user = await getCurrentUser();
  if (!user || user.isMock) {
    return { error: "로그인 후 다시 시도해주세요." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return { error: "계정을 삭제하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?accountDeleted=1");
}
