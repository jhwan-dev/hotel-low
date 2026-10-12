import type { DeviceToken, DeviceTokenRepository } from "./repository";

/**
 * In-memory stand-in for device_tokens — lets the registration Server Action
 * and fcmSender's lookup path run locally before Supabase is configured.
 * Same process-lifetime caveat as MockTrackedHotelsRepository. Keyed by
 * token so a device re-registering under a different userId still only ever
 * has one row, matching the real table's `unique (fcm_token)`.
 */
export class MockDeviceTokenRepository implements DeviceTokenRepository {
  private tokens = new Map<string, DeviceToken>();

  async upsert(input: DeviceToken): Promise<void> {
    this.tokens.set(input.token, input);
  }

  async listForUser(userId: string): Promise<string[]> {
    return [...this.tokens.values()].filter((t) => t.userId === userId).map((t) => t.token);
  }

  async remove(token: string): Promise<void> {
    this.tokens.delete(token);
  }
}
