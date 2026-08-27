import { HotelCard } from "./HotelCard";
import type { HotelSearchResult } from "@/types/hotel";

export interface HotelResultsGridProps {
  results: HotelSearchResult[];
}

export function HotelResultsGrid({ results }: HotelResultsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((result) => (
        <HotelCard key={result.hotel.id} result={result} />
      ))}
    </div>
  );
}
