import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, StarIcon } from "@/components/icons";
import { Container } from "@/components/layout";
import { Badge, LinkButton } from "@/components/ui";
import { PriceHistoryChart, TrackHotelButton } from "@/components/hotel";
import { hotelProvider } from "@/lib/hotels";
import { computePriceStatus } from "@/lib/hotels/price-history";
import { addDaysISO, formatDateLabel, todayISO } from "@/lib/date";
import { cn } from "@/lib/cn";
import { formatPrice, formatRating } from "@/lib/format";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(
  props: PageProps<"/hotels/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const checkIn = todayISO();
  const result = await hotelProvider.getHotelById(id, {
    destination: "",
    checkIn,
    checkOut: addDaysISO(checkIn, 1),
  });

  if (!result) return { title: "호텔을 찾을 수 없어요" };

  return {
    title: result.hotel.name,
    description: result.hotel.description,
  };
}

const statusStyles = {
  down: "bg-price-down-bg text-price-down",
  up: "bg-price-up-bg text-price-up",
  neutral: "bg-price-neutral-bg text-price-neutral",
};

export default async function HotelDetailPage(props: PageProps<"/hotels/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const checkIn = firstParam(sp.checkIn) ?? todayISO();
  const checkOut = firstParam(sp.checkOut) ?? addDaysISO(checkIn, 1);

  const [result, history] = await Promise.all([
    hotelProvider.getHotelById(id, { destination: "", checkIn, checkOut }),
    hotelProvider.getPriceHistory(id, 90),
  ]);

  if (!result || !history) notFound();

  const { hotel, price } = result;
  const last30 = history.points.slice(-30);
  const status = computePriceStatus(price.nightlyPrice, last30, price.currency);

  return (
    <Container className="flex flex-col gap-5 py-4">
      <Link
        href="/search"
        className="inline-flex w-fit items-center gap-1 text-small font-medium text-ink-muted"
      >
        <ChevronLeftIcon width={18} height={18} />
        검색으로 돌아가기
      </Link>

      <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-card sm:grid-cols-4">
        {hotel.images.slice(0, 4).map((src, i) => (
          <div
            key={src}
            className={cn(
              "relative aspect-square",
              i === 0 && "col-span-2 row-span-2 sm:col-span-2 sm:row-span-2",
            )}
          >
            <Image
              src={src}
              alt={`${hotel.name} 사진 ${i + 1}`}
              fill
              sizes="(min-width: 640px) 25vw, 50vw"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-h1 text-ink">{hotel.name}</h1>
          <span className="flex shrink-0 items-center gap-1 text-body font-semibold text-ink">
            <StarIcon width={16} height={16} className="text-primary-light-2" />
            {formatRating(hotel.rating)}
            <span className="text-small font-normal text-ink-muted">
              ({hotel.reviewCount})
            </span>
          </span>
        </div>
        <p className="text-small text-ink-muted">
          {hotel.location.city}, {hotel.location.country} · {hotel.location.address}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-control bg-surface-muted px-4 py-3 text-small">
        <span className="font-medium text-ink">
          {formatDateLabel(checkIn)} – {formatDateLabel(checkOut)}
        </span>
        <span className="text-ink-muted">{price.nights}박</span>
      </div>

      {/* Price — the single most important number on this screen */}
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <span className="text-small text-ink-muted">현재 가격</span>
        <div className="flex items-baseline gap-2">
          <span className="text-display tabular-nums text-ink">
            {formatPrice(price.totalPrice, price.currency)}
          </span>
        </div>
        <p className="text-price-sm tabular-nums text-ink-muted">
          1박 {formatPrice(price.nightlyPrice, price.currency)}
        </p>

        <div
          className={cn(
            "flex items-center gap-1.5 rounded-control px-3 py-2 text-small font-semibold",
            statusStyles[status.trend],
          )}
        >
          {status.trend === "down" && <ArrowDownIcon width={16} height={16} />}
          {status.trend === "up" && <ArrowUpIcon width={16} height={16} />}
          {status.message}
        </div>
      </div>

      {/* Price history — swap `history.points` for a real Agoda/Booking feed later; PriceHistoryChart itself only needs PricePoint[]. */}
      <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-5">
        <h2 className="text-h3 text-ink">가격 변화 추이</h2>
        <PriceHistoryChart points={history.points} currency={price.currency} className="pt-3" />
      </div>

      <div className="flex flex-col gap-3">
        <TrackHotelButton label="가격 추적 시작" size="lg" fullWidth />
        {price.deepLink && (
          <>
            <LinkButton
              href={price.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="lg"
              fullWidth
            >
              예약하러 가기
            </LinkButton>
            <p className="text-center text-caption text-ink-muted">
              Agoda · Booking.com 실제 연동 전 mock 링크입니다.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {hotel.amenities.map((amenity) => (
          <Badge key={amenity} variant="primary">
            {amenity}
          </Badge>
        ))}
      </div>

      <p className="text-body text-ink">{hotel.description}</p>
    </Container>
  );
}
