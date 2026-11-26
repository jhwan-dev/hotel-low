import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/layout";
import { AgodaLinkImportForm, HomeSearchBar } from "@/components/search";
import { PriceDropCard, LowAvailabilityCard, HotelDealCard } from "@/components/hotel";
import { Card, CardBody, CardMedia, CardRibbon, PriceChangeBadge } from "@/components/ui";
import { shrinkHotelImage } from "@/lib/hotels/imageUrl";
import { PopularDestinations } from "@/components/home/PopularDestinations";
import { StayQueryProvider } from "@/components/search/StayQueryContext";
import { getRecentPriceDrops } from "@/lib/hotels/recent-drops";
import { getLowAvailabilityHotels } from "@/lib/hotels/low-availability";
import { getMyTrackedHotels } from "@/lib/tracking/queries";
import { resolveTrackingDashboard } from "@/lib/tracking/resolveTrackingDashboard";
import { formatPrice } from "@/lib/format";
import { stayQueryToSearchParams } from "@/lib/search/stay-query";

// All three curated sections are computed relative to today (or read the
// signed-in user's tracked list); without this the page would statically
// prerender at build time and freeze on that snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HOTELow — 호텔 가격이 내려가면 알려드려요",
  description:
    "여행 날짜와 호텔을 선택하면 가격 변화를 계속 추적하고, 가격이 내려갔을 때 알려드립니다.",
};

/** Unwraps a Promise.allSettled result to its value, logging and falling back to `fallback` on rejection — one failed section (e.g. a Supabase hiccup) degrades that section instead of crashing the whole page. */
function settledOr<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`Home: ${label} failed`, result.reason);
  return fallback;
}

export default async function Home() {
  const [trackedListResult, dropsResult, lowAvailabilityResult] = await Promise.allSettled([
    getMyTrackedHotels(),
    getRecentPriceDrops(4),
    getLowAvailabilityHotels(4),
  ]);
  const trackedList = settledOr(trackedListResult, "getMyTrackedHotels", []);
  const drops = settledOr(dropsResult, "getRecentPriceDrops", []);
  const lowAvailability = settledOr(lowAvailabilityResult, "getLowAvailabilityHotels", []);

  let tracked: Awaited<ReturnType<typeof resolveTrackingDashboard>> = [];
  try {
    tracked = await resolveTrackingDashboard(trackedList);
  } catch (err) {
    console.error("Home: resolveTrackingDashboard failed", err);
  }

  return (
    <Container className="flex flex-col gap-8 py-6">
      <StayQueryProvider>
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-ink">
            호텔 가격이 내려갈 때,
            <br />
            호텔로우가 알려드릴게요.
          </h1>
          <p className="text-body text-ink-muted">
            여행 날짜와 호텔을 선택하면
            <br />
            가격 변화를 계속 추적합니다.
          </p>
        </div>

        <HomeSearchBar />
        <AgodaLinkImportForm />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-ink">가격 추적 중인 호텔</h2>
          {tracked.length > 0 && (
            <Link href="/tracking" className="text-small font-medium text-primary">
              전체보기
            </Link>
          )}
        </div>
        {tracked.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {tracked.map((item) => {
              const { settings, hotel } = item;
              if (!item.price) {
                // Pending — no price confirmed yet, nothing for HotelDealCard
                // to show. A minimal card still surfaces that it exists.
                return (
                  <Card key={`${settings.hotelId}-${settings.checkIn}-${settings.checkOut}`} className="overflow-hidden">
                    <CardMedia className="aspect-square">
                      <Image
                        src={shrinkHotelImage(hotel.images[0], 400)}
                        alt={hotel.name}
                        fill
                        unoptimized
                        sizes="(min-width: 640px) 25vw, 50vw"
                        className="object-cover"
                      />
                      <CardRibbon label="대기 중" tone="tracking" />
                    </CardMedia>
                    <CardBody className="gap-0.5 p-3">
                      <h3 className="truncate text-small font-semibold text-ink">{hotel.name}</h3>
                      <p className="text-caption text-ink-muted">내일 오전 중 첫 가격을 확인해요</p>
                    </CardBody>
                  </Card>
                );
              }
              const { price, changePercent, previousTotalPrice } = item;
              const isDrop = changePercent !== null && changePercent < 0;
              const amountChanged =
                previousTotalPrice !== null
                  ? Math.abs(previousTotalPrice - price.totalPrice)
                  : null;
              const detailHref = `/hotels/${hotel.id}?${stayQueryToSearchParams({
                checkIn: settings.checkIn,
                checkOut: settings.checkOut,
                adults: settings.adults,
                children: settings.children,
                rooms: settings.rooms,
                childrenAges: [],
              }).toString()}`;
              return (
                <HotelDealCard
                  key={`${settings.hotelId}-${settings.checkIn}-${settings.checkOut}`}
                  hotel={hotel}
                  price={price}
                  detailHref={detailHref}
                  approximate={false}
                  ribbon={{ label: "추적 중", tone: "tracking" }}
                  trailing={
                    changePercent !== null && changePercent !== 0 ? (
                      <PriceChangeBadge trend={isDrop ? "down" : "up"} percent={Math.abs(changePercent)} />
                    ) : null
                  }
                  secondaryLine={
                    amountChanged !== null && amountChanged !== 0 ? (
                      <p
                        className={`text-caption font-semibold ${isDrop ? "text-price-down" : "text-price-up"}`}
                      >
                        {formatPrice(amountChanged, price.currency)} {isDrop ? "하락" : "상승"}
                      </p>
                    ) : null
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-border p-6 text-center text-small text-ink-muted">
            아직 추적 중인 호텔이 없어요.
          </div>
        )}
      </section>

      {drops.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">최근 가격이 내려간 호텔</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {drops.map((drop) => (
              <PriceDropCard key={drop.hotel.id} {...drop} />
            ))}
          </div>
        </section>
      )}

      {lowAvailability.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">객실이 얼마 남지 않은 호텔</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {lowAvailability.map((deal) => (
              <LowAvailabilityCard key={deal.hotel.id} {...deal} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-ink">인기 여행지</h2>
        <PopularDestinations />
      </section>
      </StayQueryProvider>
    </Container>
  );
}
