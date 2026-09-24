import Image from "next/image";
import Link from "next/link";

const DESTINATIONS = [
  { city: "서울", country: "대한민국", photoId: "1628308801243-9b8ee051c714" },
  { city: "도쿄", country: "일본", photoId: "1513407030348-c983a97b98d8" },
  { city: "오사카", country: "일본", photoId: "1575489129683-4f7d23379975" },
  { city: "방콕", country: "태국", photoId: "1613672803979-a6edfc5a179b" },
];

/**
 * Modeled on Agoda's home-screen destination row, but sized to match
 * PriceDropCard's grid below (same columns, same aspect-square media) so the
 * two sections read as one consistent card system, not two different shapes.
 */
export function PopularDestinations() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {DESTINATIONS.map((d) => (
        <Link
          key={d.city}
          href={`/search?destination=${encodeURIComponent(d.city)}`}
          className="relative aspect-square overflow-hidden rounded-card"
        >
          <Image
            src={`https://images.unsplash.com/photo-${d.photoId}?w=400&h=400&fit=crop&q=80`}
            alt={`${d.city}, ${d.country}`}
            fill
            sizes="(min-width: 640px) 25vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
          <div className="absolute inset-x-3 bottom-3">
            <p className="text-body font-bold text-white">{d.city}</p>
            <p className="text-caption text-white/80">{d.country}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
