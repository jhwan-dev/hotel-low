"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { deviceTokenRepository } from "./index";
import type { DevicePlatform } from "./repository";

/**
 * Called by the native push bridge (src/components/push/PushBridge.tsx,
 * Phase B) right after PushNotifications.register() hands back a token.
 * Silently no-ops when nobody's signed in yet — the bridge calls this again
 * on the next Supabase auth state change once they do, so a token grabbed
 * before login is never lost, just not persisted until there's a user to
 * attach it to.
 */
export async function registerDeviceToken(token: string, platform: DevicePlatform): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await deviceTokenRepository.upsert({ userId: user.id, token, platform });
}
