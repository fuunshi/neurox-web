import { cn } from "@/lib/utils/cn";

/**
 * A horizontal progress bar.
 *
 * The study session draws its own inline; this is the same idea extracted, so
 * the home page's level and mastery bars are the same shape as the one a reader
 * already sees while studying rather than a second visual language for the same
 * concept.
 *
 * Two things it insists on. The accessible name is required rather than
 * optional — a bare `role="progressbar"` announces a number and nothing about
 * what it measures, which is worse than useless to someone who cannot see it.
 * And `aria-valuenow`/`aria-valuemax` are the raw numbers, not the rounded
 * percentage, so the markup agrees with what is drawn beside it.
 */
export function Meter({
  value,
  max,
  label,
  tone = "accent",
  size = "md",
  className,
}: {
  value: number;
  max: number;
  /** What the bar measures. Announce this, not "progress". */
  label: string;
  tone?: "accent" | "due";
  size?: "sm" | "md";
  className?: string;
}) {
  // A zero max would divide by zero and a negative value would run the fill
  // backwards out of its track.
  const safeMax = Math.max(1, max);
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      className={cn(
        "w-full overflow-hidden rounded-full bg-surface-2",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          // Amber is the app's "needs attention" meaning, so a bar in it is a
          // bar that is asking for something.
          tone === "due" ? "bg-due" : "bg-accent",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
