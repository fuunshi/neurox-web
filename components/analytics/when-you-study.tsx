"use client";

import { useState } from "react";
import type { ReviewAnalytics, ReviewSlot } from "@/lib/api-types";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Hours are labelled the way someone says them, not as a 24-hour index. */
function hourLabel(hour: number): string {
  if (hour === 0) return "midnight";
  if (hour === 12) return "noon";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

interface Strip {
  /** What each bar is, for the readout and the accessible name. */
  label: (index: number) => string;
  /** A short form for the axis under the strip. */
  axis: (index: number) => string | null;
  buckets: ReviewSlot[];
}

/**
 * When the reader studies, by weekday and by hour.
 *
 * Two strips over the same quantity rather than one grid: with a few hundred
 * reviews behind it, a weekday-by-hour heatmap is mostly empty cells, and a
 * mostly-empty grid reads as broken rather than as "you study in the evening".
 * Seven bars and twenty-four bars both say something at this sample size.
 *
 * The hover figure sits in a fixed readout line above the strip instead of in a
 * box floating over the bar. A twenty-four bar strip has no room beside its end
 * bars, and a tooltip that can leave the figure is worse than one that never
 * moves. Every bar is also focusable and named, so the same figures are
 * reachable from the keyboard, and the table below carries them all.
 */
export function WhenYouStudy({ analytics }: { analytics: ReviewAnalytics }) {
  const total = analytics.weekdays.reduce((sum, day) => sum + day.reviews, 0);

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-muted">
        No reviews yet. This fills in once you have graded a few cards — it takes
        the days and hours from every review, in the timezone on your profile.
      </p>
    );
  }

  return (
    <figure className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <figcaption className="text-sm text-ink-muted">
          {total.toLocaleString()} reviews in {analytics.windowDays} days, in{" "}
          {analytics.timezone.replace(/_/g, " ")}
        </figcaption>

        <div className="flex items-center gap-4 text-sm">
          <LegendKey colour="var(--chart-1)" label="Recalled" />
          <LegendKey colour="var(--chart-2)" label="Forgot" />
        </div>
      </div>

      <BarStrip
        title="By weekday"
        strip={{
          label: (index) => WEEKDAYS[index],
          // Only the ends and the middle: seven labels fit, but the shape is
          // what the strip is for.
          axis: (index) =>
            index === 0 || index === 3 || index === 6
              ? WEEKDAYS[index].slice(0, 3)
              : null,
          buckets: analytics.weekdays,
        }}
      />

      <BarStrip
        title="By hour"
        strip={{
          label: hourLabel,
          axis: (index) =>
            index % 6 === 0 ? (index === 0 ? "12am" : hourLabel(index)) : null,
          buckets: analytics.hours,
        }}
      />

      <TableView analytics={analytics} />
    </figure>
  );
}

function BarStrip({
  title,
  strip,
}: {
  title: string;
  strip: Strip;
}) {
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(1, ...strip.buckets.map((bucket) => bucket.reviews));
  const shown = active === null ? null : strip.buckets[active];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">{title}</h3>

        {/* Reserved whether or not anything is hovered, so the strip does not
            jump as the pointer moves across it. */}
        <p className="text-sm text-ink-muted" aria-live="polite">
          {shown && active !== null ? (
            <>
              <span className="font-medium text-ink">{strip.label(active)}</span>{" "}
              · {shown.reviews} review{shown.reviews === 1 ? "" : "s"} ·{" "}
              {shown.correct} recalled ·{" "}
              {Math.max(0, shown.reviews - shown.correct)} forgot
            </>
          ) : (
            <span className="text-ink-subtle">Hover or tab a bar</span>
          )}
        </p>
      </div>

      <div className="flex h-24 items-end gap-[2px] border-b border-line">
        {strip.buckets.map((bucket, index) => {
          const recalled = bucket.correct;
          const forgot = Math.max(0, bucket.reviews - bucket.correct);

          return (
            <div
              key={index}
              className="flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              tabIndex={bucket.reviews > 0 ? 0 : -1}
              role="img"
              aria-label={`${strip.label(index)}: ${bucket.reviews} reviews, ${recalled} recalled, ${forgot} forgotten`}
            >
              {forgot > 0 ? (
                <div
                  className="w-full rounded-t-[4px] bg-chart-2"
                  style={{ height: `${(forgot / max) * 100}%` }}
                />
              ) : null}
              {recalled > 0 ? (
                <div
                  className={cn(
                    "w-full bg-chart-1",
                    forgot === 0 && "rounded-t-[4px]",
                    forgot > 0 && "mt-[2px]",
                  )}
                  style={{ height: `${(recalled / max) * 100}%` }}
                />
              ) : null}

              {/* A bar too short to see still needs a mark, and an empty slot
                  needs one too, or "never" looks the same as "not drawn". */}
              {bucket.reviews === 0 ? (
                <div className="h-[2px] w-full rounded-full bg-line" />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* The axis labels sit in their own row so a long name cannot widen a bar. */}
      <div className="flex gap-[2px] text-xs text-ink-subtle">
        {strip.buckets.map((_, index) => (
          <span key={index} className="flex-1 text-center">
            {strip.axis(index)}
          </span>
        ))}
      </div>
    </div>
  );
}

function LegendKey({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-muted">
      <span
        aria-hidden
        className="size-2.5 rounded-[2px]"
        style={{ backgroundColor: colour }}
      />
      {label}
    </span>
  );
}

/**
 * The same numbers as a table.
 *
 * Only the slots with reviews: twenty-four hours listed with twenty-two of them
 * at zero buries the two that happened.
 */
function TableView({ analytics }: { analytics: ReviewAnalytics }) {
  const rows = [
    ...analytics.weekdays
      .filter((day) => day.reviews > 0)
      .map((day) => ({ when: WEEKDAYS[day.weekday], ...day })),
    ...analytics.hours
      .filter((hour) => hour.reviews > 0)
      .map((hour) => ({ when: hourLabel(hour.hour), ...hour })),
  ];

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-accent">View as a table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Reviews by weekday and by hour, split into recalled and forgotten.
          </caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="py-2 pr-4 font-medium">
                When
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Reviews
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Recalled
              </th>
              <th scope="col" className="py-2 font-medium">
                Forgot
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.when} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-normal">
                  {row.when}
                </th>
                <td className="py-2 pr-4 tabular-nums">{row.reviews}</td>
                <td className="py-2 pr-4 tabular-nums">{row.correct}</td>
                <td className="py-2 tabular-nums">
                  {Math.max(0, row.reviews - row.correct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
