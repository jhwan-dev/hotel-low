import { Container } from "@/components/layout";
import { Skeleton } from "@/components/ui";

/** Shape mirrors src/app/hotels/[id]/page.tsx — back link, 2x2 image grid, title/rating, price block, CTA. */
export default function Loading() {
  return (
    <Container className="flex flex-col gap-5 py-4">
      <Skeleton className="h-5 w-28" />

      <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-card sm:grid-cols-4">
        <Skeleton className="col-span-2 row-span-2 aspect-square sm:col-span-2 sm:row-span-2" />
        <Skeleton className="aspect-square" />
        <Skeleton className="aspect-square" />
        <Skeleton className="aspect-square" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      <Skeleton className="h-16 w-full" />

      <Skeleton className="h-40 w-full" />

      <Skeleton className="h-14 w-full" />
    </Container>
  );
}
