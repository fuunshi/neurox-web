import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * One number, one label, and whatever qualifies it.
 *
 * A single headline is not a chart — a one-bar bar chart is worse than the
 * number. What matters is that the figure is never alone: "73%" means nothing
 * without "of reviews recalled", and "12" means nothing without "day streak".
 *
 * No icon and no accent colour. A row of tinted tiles with glyphs reads as
 * decoration and makes four unrelated measures look like four of the same thing;
 * the qualifier is what carries the meaning.
 */
export function StatTile({
  value,
  label,
  detail,
  className,
}: {
  value: ReactNode;
  label: string;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="font-display text-3xl leading-none text-ink">{value}</p>
      <p className="text-sm font-medium text-ink">{label}</p>
      {detail ? (
        <p className="text-sm text-ink-subtle">{detail}</p>
      ) : null}
    </div>
  );
}
