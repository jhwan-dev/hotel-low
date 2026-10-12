import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MockNotificationRepository } from "./mockRepository";
import { isFcmConfigured } from "./push/env";
import type { NotificationRepository } from "./repository";
import { InAppNotificationService, PushNotificationService } from "./service";
import type { NotificationService } from "./service";
import { SupabaseNotificationRepository } from "./supabaseRepository";

// Swap point 1/2: Mock vs Supabase persistence — same pattern as
// src/lib/tracking/index.ts.
export const notificationRepository: NotificationRepository = isSupabaseConfigured()
  ? new SupabaseNotificationRepository()
  : new MockNotificationRepository();

const inAppNotificationService = new InAppNotificationService(notificationRepository);

// Swap point 2/2: delivery channel. Falls back to in-app-only until the FCM
// service-account env vars (src/lib/notifications/push/env.ts) are set, so
// this takes effect the moment Vercel's env vars are filled in — no code
// change needed at that point.
export const notificationService: NotificationService = isFcmConfigured()
  ? new PushNotificationService(inAppNotificationService)
  : inAppNotificationService;
