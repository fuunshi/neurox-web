import { StatTile } from "@/components/stats/stat-tile";
import { Panel, PanelBody } from "@/components/ui/panel";
import type { DeckStats } from "@/lib/api-types";

/**
 * Where the deck stands, beside the card being studied.
 *
 * Rendered on the server and handed to the session as a slot, the same way the
 * app shell takes `children`: the counts come from the pool the page already
 * fetched, so putting them in the session would mean the client holding data it
 * has no use for.
 *
 * Zero counts are left out rather than shown as zero. "0 new" is not a fact
 * about the deck, it is noise standing where a fact would be, and `StatTile`
 * exists to keep a figure next to the thing that qualifies it.
 */
export function StudyFacts({ stats }: { stats: DeckStats }) {
  const facts = [
    { value: stats.due, label: "Due now" },
    { value: stats.newCards, label: "Never reviewed" },
    { value: stats.learning, label: "Relearning" },
  ].filter((fact) => fact.value > 0);

  if (facts.length === 0) return null;

  return (
    <Panel>
      <PanelBody className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-medium text-ink-muted">This deck</h2>

        <div className="flex flex-col gap-4">
          {facts.map((fact) => (
            <StatTile
              key={fact.label}
              value={fact.value}
              label={fact.label}
            />
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}
