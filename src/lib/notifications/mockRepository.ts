import type { NewPriceNotification, NotificationType, PriceNotification } from "@/types/notification";
import type { NotificationRepository } from "./repository";

let nextId = 1;

/**
 * In-memory stand-in for price_alerts. Lives for the lifetime of the server
 * process — good enough for a mock, and (like MockTrackedHotelsRepository)
 * ignores the real/mock distinction on userId since there's only ever the
 * one mock user until Supabase is connected.
 */
export class MockNotificationRepository implements NotificationRepository {
  private rows: PriceNotification[] = [];

  async insert(input: NewPriceNotification): Promise<PriceNotification> {
    const row: PriceNotification = {
      ...input,
      id: String(nextId++),
      status: "unread",
      sentAt: new Date().toISOString(),
      priceDifference:
        input.previousPrice !== null ? input.previousPrice - input.currentPrice : null,
    };
    this.rows.push(row);
    return row;
  }

  async listForUser(userId: string): Promise<PriceNotification[]> {
    return this.rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    const row = this.rows.find((r) => r.id === id && r.userId === userId);
    if (row) row.status = "read";
  }

  async countUnread(userId: string): Promise<number> {
    return this.rows.filter((r) => r.userId === userId && r.status === "unread").length;
  }

  async hasAlertToday(
    trackedHotelId: string,
    type: NotificationType,
    todayISO: string,
  ): Promise<boolean> {
    return this.rows.some(
      (r) =>
        r.trackedHotelId === trackedHotelId &&
        r.type === type &&
        r.sentAt.slice(0, 10) === todayISO,
    );
  }
}
