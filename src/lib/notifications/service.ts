import type { NewPriceNotification, PriceNotification } from "@/types/notification";
import type { NotificationRepository } from "./repository";
import { sendPushToUser } from "./push/fcmSender";

/**
 * Delivery-channel abstraction. Everything that fires a notification (the
 * price-check job) or reads them (the /alerts page, the header bell) only
 * ever talks to this interface — never to a repository directly.
 * InAppNotificationService's "delivering" a notification just means the row
 * exists, so it shows up next time the signed-in user opens the app.
 * PushNotificationService wraps it and additionally fans the same event out
 * to FCM — see src/lib/notifications/index.ts for which one callers actually
 * get.
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

/**
 * Wraps InAppNotificationService — every read/markRead/countUnread call is
 * delegated unchanged, since the in-app 알림함 stays the one source of truth
 * for both web and app users. notify() additionally sends an FCM push after
 * the in-app row lands.
 */
export class PushNotificationService implements NotificationService {
  constructor(private readonly inApp: InAppNotificationService) {}

  async notify(input: NewPriceNotification): Promise<PriceNotification> {
    const notification = await this.inApp.notify(input);
    try {
      await sendPushToUser(input.userId, {
        title: "HOTELow",
        body: input.message,
        data: {
          hotelId: input.hotelId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          type: input.type,
        },
      });
    } catch (err) {
      // A push-delivery failure must never undo the in-app notification that
      // already succeeded above — the user still sees it in 알림함 either
      // way, this only loses the native tray popup for this one event.
      console.error(`PushNotificationService: push failed for user ${input.userId}`, err);
    }
    return notification;
  }

  async listForUser(userId: string): Promise<PriceNotification[]> {
    return this.inApp.listForUser(userId);
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    return this.inApp.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.inApp.markAllAsRead(userId);
  }

  async countUnread(userId: string): Promise<number> {
    return this.inApp.countUnread(userId);
  }
}
