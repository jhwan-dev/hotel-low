import type { NotificationType } from "@/types/notification";

export const notificationTypeLabel: Record<NotificationType, string> = {
  price_drop: "가격 하락",
  target_reached: "목표가 도달",
  new_low: "최근 최저가 갱신",
};
