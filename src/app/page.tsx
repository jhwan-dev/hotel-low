import type { Metadata } from "next";
import { Container } from "@/components/layout";
import { HomeSearchBar } from "@/components/search";
import { PriceDropCard, LowAvailabilityCard } from "@/components/hotel";
import { PopularDestinations } from "@/components/home/PopularDestinations";
import { getRecentPriceDrops } from "@/lib/hotels/recent-drops";
import { getLowAvailabilityHotels } from "@/lib/hotels/low-availability";

// Both curated sections are computed relative to today; without this the
// page would statically prerender at build time and freeze on that date.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HOTELow — 호텔 가격이 내려가면 알려드려요",
  description:
    "여행 날짜와 호텔을 선택하면 가격 변화를 계속 추적하고, 가격이 내려갔을 때 알려드립니다.",
};

export default async function Home() {
  const [drops, lowAvailability] = await Promise.all([
    getRecentPriceDrops(4),
    getLowAvailabilityHotels(4),
  ]);

  return (
    <Container className="flex flex-col gap-8 py-6">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-ink">
            호텔 가격이 내려갈 때,
            <br />
            HOTELow가 알려드릴게요.
          </h1>
          <p className="text-body text-ink-muted">
            여행 날짜와 호텔을 선택하면
            <br />
            가격 변화를 계속 추적합니다.
          </p>
        </div>

        <HomeSearchBar />
      </section>

      {drops.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">최근 가격이 내려간 호텔</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {drops.map((drop) => (
              <PriceDropCard key={drop.result.hotel.id} {...drop} />
            ))}
          </div>
        </section>
      )}

      {lowAvailability.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">객실이 얼마 남지 않은 호텔</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {lowAvailability.map((deal) => (
              <LowAvailabilityCard key={deal.result.hotel.id} {...deal} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-ink">인기 여행지</h2>
        <PopularDestinations />
      </section>
    </Container>
  );
}
