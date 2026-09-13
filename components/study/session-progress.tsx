"use client";

import { StatTile } from "@/components/stats/stat-tile";
import { Panel, PanelBody } from "@/components/ui/panel";

export interface SessionProgressProps {
  done: number;
  remaining: number;
  againCount: number;
}

/**
 * Where this sitting has got to.
 *
 * Two figures rather than a fraction, and that is deliberate. The queue only
 * holds what has been *loaded* — the pool arrives a page at a time — so a
 * denominator would visibly jump from 18 to 68 the moment the next page landed,
 * and a progress bar over it would move backwards. "Graded" and "still in the
 * queue" both mean exactly what they say.
 *
 * "Came back round" is the one figure that is unambiguous either way, which is
 * why it gets a sentence rather than a place in a list.
 */
export function SessionProgress({
  done,
  remaining,
  againCount,
}: SessionProgressProps) {
  return (
    <Panel>
      <PanelBody className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-medium text-ink-muted">This sitting</h2>

        <div className="flex flex-col gap-4">
          <StatTile value={done} label="Graded" />
          <StatTile value={remaining} label="Still in the queue" />
        </div>

        {againCount > 0 ? (
          <p className="text-sm text-ink-subtle">
            {againCount === 1
              ? "One card came back round."
              : `${againCount} cards came back round.`}
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
