import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { DeviceToken, DeviceTokenRepository } from "./repository";

/**
 * Every operation here goes through the admin client, not the session
 * client src/lib/notifications/supabaseRepository.ts uses for user-facing
 * reads — for two different reasons:
 *
 *  - upsert() re-points a device to whoever just signed in on it. `fcm_token`
 *    is globally unique (see supabase/migrations/0011_push_device_tokens.sql)
 *    specifically so a reused/resold device can change owners; RLS's update
 *    policy checks `auth.uid() = user_id` against the *existing* row, which
 *    would block exactly that handoff. Ownership is enforced one layer up
 *    instead — ./actions.ts only ever calls this with the caller's own
 *    getCurrentUser() id — the same shape as ensureHotelRow in
 *    src/lib/tracking/supabaseRepository.ts bypassing RLS for a write it
 *    deliberately blocks for everyone else.
 *  - listForUser()/remove() are called from the price-check cron
 *    (src/lib/notifications/push/fcmSender.ts), which has no signed-in
 *    session at all — same as price_alerts' hasAlertToday.
 */
export class SupabaseDeviceTokenRepository implements DeviceTokenRepository {
  async upsert(input: DeviceToken): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin
      .from("device_tokens")
      .upsert(
        {
          user_id: input.userId,
          fcm_token: input.token,
          platform: input.platform,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "fcm_token" },
      );
    if (error) throw error;
  }

  async listForUser(userId: string): Promise<string[]> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("device_tokens")
      .select("fcm_token")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((row) => row.fcm_token as string);
  }

  async remove(token: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("device_tokens").delete().eq("fcm_token", token);
    if (error) throw error;
  }
}
