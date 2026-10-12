export type DevicePlatform = "android" | "ios";

export interface DeviceToken {
  userId: string;
  token: string;
  platform: DevicePlatform;
}

/**
 * Swap point for device_tokens: MockDeviceTokenRepository (in-memory) today,
 * SupabaseDeviceTokenRepository once a project is connected — same pattern as
 * src/lib/notifications/repository.ts. Consumed by ./actions.ts (registration,
 * has a signed-in user) and src/lib/notifications/push/fcmSender.ts (the
 * price-check job, has none — see SupabaseDeviceTokenRepository for why both
 * paths go through the admin client either way).
 */
export interface DeviceTokenRepository {
  /** Registers a device for push, or re-points it to `userId` if it was already registered under a different account (reused/resold device). */
  upsert(input: DeviceToken): Promise<void>;

  /** Every token currently registered for this user — fcmSender fans a send out to all of them. */
  listForUser(userId: string): Promise<string[]>;

  /** Drops a token FCM reports as no longer registered (app uninstalled, notifications revoked, etc). */
  remove(token: string): Promise<void>;
}
