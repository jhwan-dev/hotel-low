import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MockDeviceTokenRepository } from "./mockRepository";
import type { DeviceTokenRepository } from "./repository";
import { SupabaseDeviceTokenRepository } from "./supabaseRepository";

// Swap point: Mock vs Supabase persistence — same pattern as
// src/lib/notifications/index.ts.
export const deviceTokenRepository: DeviceTokenRepository = isSupabaseConfigured()
  ? new SupabaseDeviceTokenRepository()
  : new MockDeviceTokenRepository();
