import { cn } from "@/lib/utils/cn";

/**
 * Placeholder for content whose shape is known. `aria-hidden` because the
 * surrounding region should carry `aria-busy` and a real status message —
 * a screen reader has nothing to gain from the skeleton itself.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-2", className)}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          // Last line short, the way a real paragraph ends.
          className={cn("h-4", index === lines - 1 ? "w-2/5" : "w-full")}
        />
      ))}
    </div>
  );
}
