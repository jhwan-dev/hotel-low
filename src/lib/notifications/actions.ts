"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { notificationService } from "./index";

export async function markNotificationRead(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요해요." };

  await notificationService.markAsRead(id, user.id);
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;

  await notificationService.markAllAsRead(user.id);
}
