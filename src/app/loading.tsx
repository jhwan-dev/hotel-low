import { Container } from "@/components/layout";
import { Skeleton } from "@/components/ui";

/** Shape mirrors src/app/page.tsx's sections — search bar, tracked-hotels grid, two curated rows, destinations row. */
export default function Loading() {
  return (
    <Container className="flex flex-col gap-8 py-6">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-44 w-full" />
      </section>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-36" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-44" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </section>
    </Container>
  );
}
