import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MockNotificationRepository } from "./mockRepository";
import type { NotificationRepository } from "./repository";
import { InAppNotificationService } from "./service";
import type { NotificationService } from "./service";
import { SupabaseNotificationRepository } from "./supabaseRepository";

// Swap point 1/2: Mock vs Supabase persistence — same pattern as
// src/lib/tracking/index.ts.
export const notificationRepository: NotificationRepository = isSupabaseConfigured()
  ? new SupabaseNotificationRepository()
  : new MockNotificationRepository();

// Swap point 2/2: delivery channel. Replace this line with a
// WebPushNotificationService(notificationRepository, ...) once push is
// wired up — every caller only ever imports `notificationService`.
export const notificationService: NotificationService = new InAppNotificationService(
  notificationRepository,
);
