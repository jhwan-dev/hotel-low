"use client";

import Link from "next/link";
import { useTransition } from "react";
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
  // Derived straight from the prop, not mirrored into local state: a Server
  // Action mutation (this card's own click, or the page's "전체 읽음"
  // button) refreshes the route and hands this component fresh props —
  // shadowing that in useState would go stale the moment a *different*
  // action changed this row's read status.
  const unread = notification.status === "unread";
  const detailHref = notification.hotelId
    ? `/hotels/${notification.hotelId}?checkIn=${notification.checkIn}&checkOut=${notification.checkOut}`
    : null;

  function markRead() {
    if (!unread) return;
    startTransition(async () => {
      await markNotificationRead(notification.id);
    });
  }

  const content = (
    <>
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
    </>
  );

  return (
    <Card className={cn(unread && "border-l-4 border-l-primary")}>
      <CardBody className="gap-1.5 p-4">
        {detailHref ? (
          <Link href={detailHref} onClick={markRead} className="flex flex-col gap-1.5">
            {content}
          </Link>
        ) : (
          content
        )}

        {unread && (
          <button
            type="button"
            onClick={markRead}
            disabled={isPending}
            className="w-fit pt-1 text-caption font-semibold text-primary"
          >
            읽음으로 표시
          </button>
        )}
      </CardBody>
    </Card>
  );
}
