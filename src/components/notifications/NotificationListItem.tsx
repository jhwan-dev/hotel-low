"use client";

import { useState, useTransition } from "react";
import { Badge, Card, CardBody } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRelativeDays } from "@/lib/date";
import { formatPrice } from "@/lib/format";
import { notificationTypeLabel } from "@/lib/notifications/labels";
import { markNotificationRead } from "@/lib/notifications/actions";
import type { BadgeVariant } from "@/components/ui";
import type { PriceNotification } from "@/types/notification";

const badgeVariant: Record<PriceNotification["type"], BadgeVariant> = {
  price_drop: "priceDown",
  new_low: "priceDown",
  target_reached: "primary",
};

export interface NotificationListItemProps {
  notification: PriceNotification;
}

export function NotificationListItem({ notification }: NotificationListItemProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(notification.status);
  const unread = status === "unread";

  function markRead() {
    if (!unread) return;
    startTransition(async () => {
      const result = await markNotificationRead(notification.id);
      if (!("error" in result)) setStatus("read");
    });
  }

  return (
    <button type="button" onClick={markRead} disabled={isPending} className="w-full text-left">
      <Card className={cn(unread && "border-l-4 border-l-primary")}>
        <CardBody className="gap-1.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={badgeVariant[notification.type]}>
              {notificationTypeLabel[notification.type]}
            </Badge>
            <span className="text-caption text-ink-muted">
              {formatRelativeDays(notification.sentAt.slice(0, 10))}
            </span>
          </div>

          <p className="text-small text-ink">{notification.message}</p>

          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-price-sm font-bold tabular-nums text-ink">
              {formatPrice(notification.currentPrice, notification.currency)}
            </span>
            {notification.previousPrice !== null && (
              <span className="text-caption text-ink-muted line-through decoration-ink-muted/50">
                {formatPrice(notification.previousPrice, notification.currency)}
              </span>
            )}
          </div>
        </CardBody>
      </Card>
    </button>
  );
}
