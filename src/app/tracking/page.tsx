import Link from "next/link";
import type { Metadata } from "next";
import { EmailMagicLinkForm } from "@/components/auth/EmailMagicLinkForm";
import { KakaoSignInButton } from "@/components/auth/KakaoSignInButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { Container } from "@/components/layout";
import { Button, LinkButton } from "@/components/ui";
import { TrackedHotelCard } from "@/components/hotel";
import { signOut } from "@/lib/auth/actions";
import { isKakaoLoginEnabled } from "@/lib/auth/featureFlags";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getMyTrackedHotels } from "@/lib/tracking/queries";
import { resolveTrackingDashboard } from "@/lib/tracking/resolveTrackingDashboard";

export const metadata: Metadata = {
  title: "가격 추적 중인 호텔",
};

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="text-h1 text-ink">가격 추적 중인 호텔</h1>
        <p className="text-body text-ink-muted">
          로그인하면 추적 중인 호텔 목록을 볼 수 있어요.
        </p>
        <div className="flex w-full max-w-xs flex-col items-center gap-4 pt-2">
          {isKakaoLoginEnabled() && (
            <>
              <KakaoSignInButton next="/tracking" fullWidth />
              <OrDivider />
            </>
          )}
          <EmailMagicLinkForm next="/tracking" />
        </div>
      </Container>
    );
  }

  const trackedList = await getMyTrackedHotels();
  const items = await resolveTrackingDashboard(trackedList);

  return (
    <Container className="flex flex-col gap-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-ink">가격 추적 중인 호텔</h1>
        {!user.isMock && (
          <form action={signOut.bind(null, "/")}>
            <Button type="submit" variant="ghost" size="sm">
              로그아웃
            </Button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border p-10 text-center">
          <p className="text-body text-ink-muted">아직 추적 중인 호텔이 없어요.</p>
          <LinkButton href="/search">호텔 검색하러 가기</LinkButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <TrackedHotelCard
              key={`${item.settings.hotelId}-${item.settings.checkIn}-${item.settings.checkOut}`}
              hotel={item.result.hotel}
              price={item.result.price}
              settings={item.settings}
              previousTotalPrice={item.previousTotalPrice}
              changePercent={item.changePercent}
              status={item.status}
              lastCheckedAt={item.lastCheckedAt}
            />
          ))}
        </div>
      )}
    </Container>
  );
}
