import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout";
import { HotelSearchForm } from "@/components/search";
import { HotelResultsGrid } from "@/components/hotel";
import { Badge } from "@/components/ui";
import { hotelProvider, supportedDestinations } from "@/lib/hotels";
import { addDaysISO, todayISO } from "@/lib/date";

export const metadata: Metadata = {
  title: "호텔 검색",
  description: "서울, 도쿄, 오사카, 방콕 호텔 가격을 비교하고 추적을 시작해보세요.",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toIntList(value: string | string[] | undefined): number[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(Number).filter((n) => Number.isFinite(n));
}

export default async function SearchPage(props: PageProps<"/search">) {
  const sp = await props.searchParams;
  const destination = firstParam(sp.destination) ?? "";
  const checkIn = firstParam(sp.checkIn) ?? todayISO();
  const checkOut = firstParam(sp.checkOut) ?? addDaysISO(checkIn, 1);
  const rooms = Number(firstParam(sp.rooms) ?? 1) || 1;
  const adults = Number(firstParam(sp.adults) ?? 2) || 2;
  const children = Number(firstParam(sp.children) ?? 0) || 0;
  const childrenAges = toIntList(sp.childrenAges);

  const hasQuery = destination.trim().length > 0;
  const response = hasQuery
    ? await hotelProvider.search({ destination, checkIn, checkOut, rooms, adults, children, childrenAges })
    : null;

  return (
    <Container className="flex flex-col gap-6 py-6">
      <div>
        <h1 className="text-h1 text-ink">호텔 검색</h1>
        <p className="text-body text-ink-muted">
          여행 날짜와 목적지를 입력하면 가격을 비교하고 추적할 수 있어요.
        </p>
      </div>

      <HotelSearchForm
        defaultDestination={destination}
        defaultStay={{ checkIn, checkOut, rooms, adults, children, childrenAges }}
      />

      {!hasQuery && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small text-ink-muted">인기 여행지</span>
          {supportedDestinations.map((city) => (
            <Link
              key={city}
              href={`/search?destination=${encodeURIComponent(city)}&checkIn=${checkIn}&checkOut=${checkOut}`}
            >
              <Badge variant="outline" className="hover:bg-surface-muted">
                {city}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {response && (
        <>
          <p className="text-small text-ink-muted">
            <span className="font-semibold text-ink">{destination}</span> 검색 결과{" "}
            {response.totalCount}개
          </p>
          {response.results.length > 0 ? (
            <HotelResultsGrid results={response.results} />
          ) : (
            <div className="rounded-card border border-dashed border-border p-8 text-center text-body text-ink-muted">
              &quot;{destination}&quot;에 대한 검색 결과가 없어요. 다른 도시로 검색해보세요.
            </div>
          )}
        </>
      )}
    </Container>
  );
}
