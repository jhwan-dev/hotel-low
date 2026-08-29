import { HotelCard } from "./HotelCard";
import type { HotelSearchResult } from "@/types/hotel";
import type { StayQuery } from "@/lib/search/stay-query";

export interface HotelResultsGridProps {
  results: HotelSearchResult[];
  /** The search's full stay conditions — carried into each card's detail link so the hotel page never has to ask again. */
  stay: StayQuery;
}

export function HotelResultsGrid({ results, stay }: HotelResultsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((result) => (
        <HotelCard key={result.hotel.id} result={result} stay={stay} />
      ))}
    </div>
  );
}
