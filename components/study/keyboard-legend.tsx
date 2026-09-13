"use client";

import { Panel, PanelBody } from "@/components/ui/panel";
import { REVIEW_GRADES } from "@/lib/format";
import type { StudyModeId } from "@/lib/study/modes";

/**
 * What the keyboard does here, for the mode that is open.
 *
 * The keys are not discoverable otherwise: the card's own hint line names them
 * once and then it is gone, and a reader who never found the swipe would have no
 * way to know Hard and Easy exist — they have no buttons of their own.
 *
 * Switched on the mode id rather than the `sequential` flag, which now covers
 * two modes that behave differently: Grid and Read both decline to grade, but
 * only one of them has anything to reveal.
 */
export function KeyboardLegend({
  mode,
  revealed,
}: {
  mode: StudyModeId;
  revealed: boolean;
}) {
  const rows: { keys: string; does: string }[] =
    mode === "swipe"
      ? [
          {
            keys: "space",
            does: revealed ? "hide the answer" : "show the answer",
          },
          { keys: "← →", does: "again / good" },
          // Named individually because these two have no buttons: the legend is
          // the only place a reader learns they are there at all.
          {
            keys: "1–4",
            does: REVIEW_GRADES.map((grade) => grade.label.toLowerCase()).join(
              " · ",
            ),
          },
        ]
      : [
          {
            keys: "—",
            does: "this mode does not grade",
          },
        ];

  return (
    <Panel>
      <PanelBody className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-medium text-ink-muted">Keys</h2>

        <dl className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.keys}
              className="flex items-baseline justify-between gap-3"
            >
              <dt>
                <kbd className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 text-xs text-ink-muted">
                  {row.keys}
                </kbd>
              </dt>
              <dd className="text-right text-sm text-ink-subtle">{row.does}</dd>
            </div>
          ))}
        </dl>
      </PanelBody>
    </Panel>
  );
}
