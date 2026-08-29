import type { Metadata } from "next";
import { EmailMagicLinkForm } from "@/components/auth/EmailMagicLinkForm";
import { KakaoSignInButton } from "@/components/auth/KakaoSignInButton";
import { Container } from "@/components/layout";
import { Button } from "@/components/ui";
import { NotificationListItem } from "@/components/notifications/NotificationListItem";
import { signOut } from "@/lib/auth/actions";
import { isKakaoLoginEnabled } from "@/lib/auth/featureFlags";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { notificationService } from "@/lib/notifications";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

export const metadata: Metadata = {
  title: "알림",
};

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="text-h1 text-ink">알림</h1>
        <p className="text-body text-ink-muted">로그인하면 가격 알림을 볼 수 있어요.</p>
        <div className="flex w-full max-w-xs flex-col items-center gap-4 pt-2">
          {isKakaoLoginEnabled() && (
            <>
              <KakaoSignInButton next="/alerts" fullWidth />
              <div className="flex w-full items-center gap-3 text-caption text-ink-muted">
                <span className="h-px flex-1 bg-border" />
                또는
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <EmailMagicLinkForm next="/alerts" />
        </div>
      </Container>
    );
  }

  const notifications = await notificationService.listForUser(user.id);
  const hasUnread = notifications.some((n) => n.status === "unread");

  return (
    <Container className="flex flex-col gap-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-ink">알림</h1>
        <div className="flex items-center gap-1">
          {hasUnread && (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="ghost" size="sm">
                전체 읽음
              </Button>
            </form>
          )}
          {!user.isMock && (
            <form action={signOut.bind(null, "/")}>
              <Button type="submit" variant="ghost" size="sm">
                로그아웃
              </Button>
            </form>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border p-10 text-center">
          <p className="text-body text-ink-muted">아직 알림이 없어요.</p>
          <p className="text-small text-ink-muted">
            추적 중인 호텔의 가격이 내려가면 여기서 알려드려요.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notification) => (
            <NotificationListItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </Container>
  );
}
