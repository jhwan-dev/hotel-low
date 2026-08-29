import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/types/hotel";
import type {
  NewPriceNotification,
  NotificationStatus,
  NotificationType,
  PriceNotification,
} from "@/types/notification";
import type { NotificationRepository } from "./repository";

interface PriceAlertRow {
  id: string;
  user_id: string;
  tracked_hotel_id: string;
  alert_type: NotificationType;
  previous_price: number | string | null;
  current_price: number | string;
  price_difference: number | string | null;
  currency: string;
  message: string | null;
  is_read: boolean;
  sent_at: string;
}

function toStatus(isRead: boolean): NotificationStatus {
  return isRead ? "read" : "unread";
}

function toNotification(row: PriceAlertRow): PriceNotification {
  return {
    id: row.id,
    userId: row.user_id,
    trackedHotelId: row.tracked_hotel_id,
    type: row.alert_type,
    previousPrice: row.previous_price === null ? null : Number(row.previous_price),
    currentPrice: Number(row.current_price),
    priceDifference: row.price_difference === null ? null : Number(row.price_difference),
    currency: row.currency as Currency,
    message: row.message ?? "",
    status: toStatus(row.is_read),
    sentAt: row.sent_at,
  };
}

const SELECT_COLUMNS =
  "id, user_id, tracked_hotel_id, alert_type, previous_price, current_price, price_difference, currency, message, is_read, sent_at";

/**
 * Reads go through the session client — RLS ("users can view/update own
 * price alerts") is the only thing scoping them to the signed-in user.
 * Inserts and the price-check job's idempotency lookup go through the admin
 * client instead: there is deliberately no INSERT policy on price_alerts
 * (see supabase/migrations/0001_init.sql), and hasAlertToday is called from
 * the system price-check job, which has no signed-in user/session at all.
 */
export class SupabaseNotificationRepository implements NotificationRepository {
  async insert(input: NewPriceNotification): Promise<PriceNotification> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("price_alerts")
      .insert({
        user_id: input.userId,
        tracked_hotel_id: input.trackedHotelId,
        alert_type: input.type,
        previous_price: input.previousPrice,
        current_price: input.currentPrice,
        currency: input.currency,
        message: input.message,
      })
      .select(SELECT_COLUMNS)
      .single();
    if (error) throw error;
    return toNotification(data);
  }

  async listForUser(userId: string): Promise<PriceNotification[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_alerts")
      .select(SELECT_COLUMNS)
      .eq("user_id", userId)
      .order("sent_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toNotification);
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("price_alerts")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  }

  async countUnread(userId: string): Promise<number> {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("price_alerts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
    return count ?? 0;
  }

  async hasAlertToday(
    trackedHotelId: string,
    type: NotificationType,
    todayISO: string,
  ): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("price_alerts")
      .select("id")
      .eq("tracked_hotel_id", trackedHotelId)
      .eq("alert_type", type)
      .gte("sent_at", `${todayISO}T00:00:00Z`)
      .lt("sent_at", `${todayISO}T23:59:59.999Z`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }
}
