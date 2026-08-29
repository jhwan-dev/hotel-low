import type { NewPriceNotification, PriceNotification } from "@/types/notification";
import type { NotificationRepository } from "./repository";

/**
 * Delivery-channel abstraction. Everything that fires a notification (the
 * price-check job) or reads them (the /alerts page, the header bell) only
 * ever talks to this interface — never to a repository directly. Today
 * InAppNotificationService is the only implementation: "delivering" a
 * notification just means the row exists, so it shows up next time the
 * signed-in user opens the app. A later WebPushNotificationService (or
 * mobile push) would implement the same interface, wrap the same
 * repository for listForUser/markAsRead/countUnread, and additionally call
 * a push provider inside notify() — nothing that calls this interface today
 * would need to change.
 */
export interface NotificationService {
  /** Persists + "delivers" one notification through this channel. */
  notify(input: NewPriceNotification): Promise<PriceNotification>;

  listForUser(userId: string): Promise<PriceNotification[]>;
  markAsRead(id: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  countUnread(userId: string): Promise<number>;
}

export class InAppNotificationService implements NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  async notify(input: NewPriceNotification): Promise<PriceNotification> {
    return this.repo.insert(input);
  }

  async listForUser(userId: string): Promise<PriceNotification[]> {
    return this.repo.listForUser(userId);
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    return this.repo.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.repo.markAllAsRead(userId);
  }

  async countUnread(userId: string): Promise<number> {
    return this.repo.countUnread(userId);
  }
}
