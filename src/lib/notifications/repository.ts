import type { NewPriceNotification, NotificationType, PriceNotification } from "@/types/notification";

/**
 * Swap point for price_alerts: MockNotificationRepository (in-memory) today,
 * SupabaseNotificationRepository (RLS-scoped reads, admin-scoped writes)
 * once a project is connected — same shape either way.
 */
export interface NotificationRepository {
  insert(input: NewPriceNotification): Promise<PriceNotification>;

  /** Every notification for this user, most recent first — the "내 알림" page. */
  listForUser(userId: string): Promise<PriceNotification[]>;

  markAsRead(id: string, userId: string): Promise<void>;

  markAllAsRead(userId: string): Promise<void>;

  countUnread(userId: string): Promise<number>;

  /**
   * Idempotency guard for the price-check job: has this exact
   * (trackedHotelId, type) already fired today? Without this, re-running the
   * check (e.g. a retried cron tick) would spam duplicate alerts.
   */
  hasAlertToday(trackedHotelId: string, type: NotificationType, todayISO: string): Promise<boolean>;
}
