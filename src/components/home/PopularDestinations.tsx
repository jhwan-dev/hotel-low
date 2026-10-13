"use client";

import Image from "next/image";
import Link from "next/link";
import { supportedDestinations } from "@/lib/hotels/destinations";
import { stayQueryToSearchParams } from "@/lib/search/stay-query";
import { useStayQuery } from "@/components/search/StayQueryContext";

/**
 * Display metadata only — which cities actually show is driven by
 * supportedDestinations (src/lib/hotels/destinations.ts), the same list
 * /search's own "인기 여행지" row uses, so this can't drift from the real
 * catalog again the way its old hardcoded 서울/방콕 list did. A city added
 * there with no entry here just doesn't render — add its photo when it's
 * seeded.
 */
const DESTINATION_META: Record<string, { country: string; photoId: string }> = {
  오사카: { country: "일본", photoId: "1575489129683-4f7d23379975" },
  도쿄: { country: "일본", photoId: "1513407030348-c983a97b98d8" },
  다낭: { country: "베트남", photoId: "1747137129095-b693a7ad08d0" },
  후쿠오카: { country: "일본", photoId: "1717224202417-7c4d6e851442" },
};

/**
 * Modeled on Agoda's home-screen destination row, but sized to match
 * PriceDropCard's grid below (same columns, same aspect-square media) so the
 * two sections read as one consistent card system, not two different shapes.
 *
 * Links carry the same checkIn/checkOut/guest counts currently set in
 * HomeSearchBar's picker (shared via StayQueryContext) — otherwise every
 * card would search today/tomorrow/2 adults regardless of what the user
 * already chose above.
 */
export function PopularDestinations() {
  const [stay] = useStayQuery();
  const stayParams = stayQueryToSearchParams(stay);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {supportedDestinations.map((city) => {
        const meta = DESTINATION_META[city];
        if (!meta) return null;

        const params = new URLSearchParams(stayParams);
        params.set("destination", city);

        return (
          <Link
            key={city}
            href={`/search?${params.toString()}`}
            className="relative aspect-square overflow-hidden rounded-card"
          >
            <Image
              src={`https://images.unsplash.com/photo-${meta.photoId}?w=400&h=400&fit=crop&q=80`}
              alt={`${city}, ${meta.country}`}
              fill
              sizes="(min-width: 640px) 25vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
            <div className="absolute inset-x-3 bottom-3">
              <p className="text-body font-bold text-white">{city}</p>
              <p className="text-caption text-white/80">{meta.country}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
