import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { streakAtRisk } from "@/lib/gamification";
import { getStudyOverview } from "@/lib/server/queries";
import { cn } from "@/lib/utils/cn";

/**
 * The streak, in the header.
 *
 * Server-rendered rather than fetched by the shell, and that is the whole design
 * decision. A client fetch is not available — the BFF's allow-list does not
 * cover the `study` route — and awaiting this in `app/(app)/layout.tsx` would
 * make `/map`, `/settings` and `/activity` wait on data they never show. So the
 * layout renders this as a slot inside a `Suspense` boundary: the header paints
 * immediately and the number streams in, the same trade the notification bell
 * makes by loading its list over REST.
 *
 * It renders nothing at all when there is no streak. "0 day streak" is not a
 * fact about the reader, it is a zero standing where a fact would be.
 */
export async function StreakChip() {
  const { streak, daily } = await getStudyOverview();

  if (streak.current === 0) return null;

  // The API returns a continuous run of days ending today, measured in the
  // reader's own timezone — the only clock that agrees with the streak itself.
  const reviewedToday = daily.at(-1)?.reviews ?? 0;
  const atRisk = streakAtRisk(streak.current, reviewedToday);

  return (
    <Link
      href="/stats"
      title={
        atRisk
          ? `Your ${streak.current}-day streak has not been added to today`
          : `Longest streak: ${streak.longest}`
      }
      className={cn(
        "hidden items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm transition-colors sm:inline-flex",
        // Amber for a streak about to lapse, and only then. Amber means "needs
        // your attention" everywhere in this product; a healthy streak is not
        // asking for anything, so it stays quiet.
        atRisk
          ? "border-due/40 bg-due-soft text-due-fg"
          : "border-line bg-surface text-ink-muted hover:bg-surface-2",
      )}
    >
      <FlameIcon className={cn("size-4", atRisk ? "text-due" : "text-accent")} />
      <span className="font-medium">{streak.current}</span>
    </Link>
  );
}

/** Holds the chip's width while it streams, so the header does not reflow. */
export function StreakChipSkeleton() {
  return <Skeleton className="hidden h-8 w-12 rounded-md sm:block" />;
}

/**
 * A flame, drawn rather than imported.
 *
 * File-local, following `BellIcon` in `notification-bell.tsx`: the section icons
 * are keyed to *sections* and a streak is not one. Geometric rather than
 * pictorial, for the same reason those are — at 16px a literal flame turns to
 * mush, so this is a shape that reads as a silhouette.
 */
function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 21a5 5 0 0 0 5-5c0-4-5-8-5-13 0 5-5 9-5 13a5 5 0 0 0 5 5Z" />
    </svg>
  );
}
