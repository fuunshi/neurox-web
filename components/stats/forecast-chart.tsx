"use client";

import { useState } from "react";
import type { ForecastDay } from "@/lib/api-types";

/**
 * What falls due over the next fortnight.
 *
 * One series, so no legend — the heading names it. A single hue rather than the
 * two-series pair, because there is nothing here to tell apart.
 *
 * The point of this chart is anticipation rather than record: seeing that
 * Thursday is heavy is what lets someone study on Wednesday instead. So the
 * tallest bar is labelled directly rather than every bar.
 */
export function ForecastChart({ days }: { days: ForecastDay[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const max = Math.max(1, ...days.map((day) => day.due));
  const total = days.reduce((sum, day) => sum + day.due, 0);

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-muted">
        Nothing is scheduled for the next {days.length} days. Either everything
        is graded, or there is nothing active to grade.
      </p>
    );
  }

  const busiest = days.reduce((a, b) => (b.due > a.due ? b : a), days[0]);

  const label = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: "UTC",
    });

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-sm text-ink-muted">
        {total.toLocaleString()} cards due in the next {days.length} days
        {busiest.due > 0
          ? `, most on ${label(busiest.day)} (${busiest.due})`
          : ""}
      </figcaption>

      {/* `pt-6` reserves a band above the bars for their own labels. Without it
          the direct label on the busiest bar is drawn over the caption, which
          reads as broken rather than as a label. */}
      <div className="relative flex h-36 items-end gap-1 border-b border-line pt-6">
        {days.map((day) => {
          const isHovered = hovered === day.day;

          return (
            <div
              key={day.day}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(day.day)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(day.day)}
              onBlur={() => setHovered(null)}
              tabIndex={day.due > 0 ? 0 : -1}
              role="img"
              aria-label={`${day.day}: ${day.due} due`}
            >
              {day.due > 0 ? (
                <div
                  className="w-full rounded-t-[4px] bg-chart-1"
                  style={{ height: `${(day.due / max) * 100}%` }}
                />
              ) : (
                <div className="h-[2px] w-full rounded-full bg-line" />
              )}

              {/* One direct label, on the busiest day. Labelling every bar is
                  a number on every point, which is noise. */}
              {day.day === busiest.day && busiest.due > 0 && !isHovered ? (
                <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs text-ink-muted tabular-nums">
                  {day.due}
                </span>
              ) : null}

              {isHovered ? (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop">
                  <p className="font-medium text-ink">{day.day}</p>
                  <p className="text-ink-muted">
                    {day.due} due
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 text-xs text-ink-subtle">
        {days.map((day) => (
          <span key={day.day} className="flex-1 text-center">
            {label(day.day)}
          </span>
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-accent">View as a table</summary>
        <div className="mt-2">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Cards due per day.</caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Day
                </th>
                <th scope="col" className="py-2 font-medium">
                  Due
                </th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((day) => day.due > 0)
                .map((day) => (
                  <tr key={day.day} className="border-b border-line">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      {day.day}
                    </th>
                    <td className="py-2 tabular-nums">{day.due}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
