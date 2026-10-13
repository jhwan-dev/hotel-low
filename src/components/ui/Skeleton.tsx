import { cn } from "@/lib/cn";

/** Plain pulsing block — compose into page-shaped loading.tsx skeletons by matching each real section's size/aspect ratio, so content never visibly jumps when it swaps in. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-surface-muted", className)} />;
}
