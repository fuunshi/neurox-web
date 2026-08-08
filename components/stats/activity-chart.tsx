"use client";

import { useState } from "react";
import type { ReviewDay } from "@/lib/api-types";
import { cn } from "@/lib/utils/cn";

/**
 * Reviews per day, split into what was recalled and what was not.
 *
 * Stacked rather than two bars because the two parts are one quantity — the work
 * done that day — and the split is what varies. Recalled sits at the bottom so
 * the baseline is the same on every bar, which is what makes the columns
 * comparable at a glance; a stack whose segments swap places cannot be scanned.
 *
 * Built in plain HTML rather than with a chart library. The whole thing is
 * rectangles on a shared scale, and a library would arrive with its own colour
 * handling — which is exactly the part that has to stay in the design system's
 * tokens to work across three schemes.
 *
 * The colours are `--chart-1` and `--chart-2`, which were checked with a
 * contrast/CVD validator per theme rather than picked by eye. Identity is also
 * carried by a legend, a tooltip, a fixed stack order and a table view, so
 * nothing here depends on telling two hues apart.
 */
export function ActivityChart({ days }: { days: ReviewDay[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const max = Math.max(1, ...days.map((day) => day.reviews));
  const total = days.reduce((sum, day) => sum + day.reviews, 0);

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-muted">
        No reviews in the last {days.length} days yet. Study a deck and this fills
        in.
      </p>
    );
  }

  // Label only the ends and the middle: thirty dates would collide, and the
  // shape is what the chart is for, not the individual x values.
  const labelAt = new Set([0, Math.floor(days.length / 2), days.length - 1]);

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <figcaption className="text-sm text-ink-muted">
          {total.toLocaleString()} reviews in {days.length} days
        </figcaption>

        <div className="flex items-center gap-4 text-sm">
          <LegendKey colour="var(--chart-1)" label="Recalled" />
          <LegendKey colour="var(--chart-2)" label="Forgot" />
        </div>
      </div>

      {/* The plot. A single recessive baseline, no gridlines — the bars carry
          the magnitude and a grid would only compete with them. `pt-6` keeps
          room for the hover tooltip inside the figure rather than over the
          caption. */}
      <div className="relative flex h-44 items-end gap-[2px] border-b border-line pt-6">
        {days.map((day) => {
          const recalled = day.correct;
          const forgot = Math.max(0, day.reviews - day.correct);
          const isHovered = hovered === day.day;

          return (
            <div
              key={day.day}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(day.day)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(day.day)}
              onBlur={() => setHovered(null)}
              tabIndex={day.reviews > 0 ? 0 : -1}
              role="img"
              aria-label={`${day.day}: ${day.reviews} reviews, ${recalled} recalled, ${forgot} forgotten`}
            >
              {/* Forgot on top, recalled beneath it. A 2px gap separates the
                  segments so the boundary is legible without a stroke. */}
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

              {/* A mark too small to see still needs a hit target, or the days
                  that matter most are the ones you cannot inspect. */}
              {day.reviews === 0 ? (
                <div className="h-[2px] w-full rounded-full bg-line" />
              ) : null}

              {isHovered ? (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop">
                  <p className="font-medium text-ink">{day.day}</p>
                  <p className="text-ink-muted">
                    {day.reviews} review{day.reviews === 1 ? "" : "s"}
                  </p>
                  <p className="text-ink-muted">
                    {recalled} recalled · {forgot} forgot
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Only the ends and the middle, in text tokens rather than the series
          colour — the bars carry the identity, not the labels. */}
      <div className="flex justify-between text-xs text-ink-subtle">
        {days.map((day, index) =>
          labelAt.has(index) ? (
            <span key={day.day}>
              {new Date(`${day.day}T00:00:00Z`).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })}
            </span>
          ) : null,
        )}
      </div>

      <TableView days={days} />
    </figure>
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
 * Not a nicety: a stacked bar is unreadable to a screen reader without one, and
 * it is also how anyone checks an exact figure rather than a shape.
 */
function TableView({ days }: { days: ReviewDay[] }) {
  const withReviews = days.filter((day) => day.reviews > 0);

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-accent">View as a table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Reviews per day, split into recalled and forgotten.
          </caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="py-2 pr-4 font-medium">
                Day
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
            {withReviews.map((day) => (
              <tr key={day.day} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-normal">
                  {day.day}
                </th>
                <td className="py-2 pr-4 tabular-nums">{day.reviews}</td>
                <td className="py-2 pr-4 tabular-nums">{day.correct}</td>
                <td className="py-2 tabular-nums">
                  {day.reviews - day.correct}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
