import { StatTile } from "@/components/stats/stat-tile";
import { Meter } from "@/components/ui/meter";
import type { GenerationAnalytics } from "@/lib/api-types";
import { formatCount, formatPercent } from "@/lib/format";

/**
 * A duration as someone would say it.
 *
 * Coarse on purpose: the difference between 41 and 43 seconds is noise from a
 * queue, not information, and a generator that takes 40 seconds is described
 * better as "about a minute" than as a figure that moves every run.
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "not yet";
  if (seconds < 1) return "under a second";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;

  return `${(seconds / 3600).toFixed(1)} hours`;
}

/**
 * What the reader's material actually produced.
 *
 * The one figure here that is not about the reader: a source that yields
 * nothing, or fails every time, is a fact about the material, and it belongs
 * next to the material rather than on a progress page about studying.
 *
 * The bar per source is relative to the best source rather than to some target,
 * because there is no target — "this chapter produced more than that one" is
 * the whole comparison being made.
 */
export function SourceYield({ analytics }: { analytics: GenerationAnalytics }) {
  const { totals, bySource, byProvider } = analytics;

  if (totals.jobs === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-muted">
        No cards drafted yet. Add material above and generate from it — this
        then says which of your sources actually produced cards.
      </p>
    );
  }

  const best = Math.max(1, ...bySource.map((source) => source.cardsCreated));
  const heuristic = byProvider.some((entry) => entry.provider === "heuristic");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
        <StatTile
          value={totals.cardsCreated}
          label="cards drafted"
          detail={formatCount(totals.jobs, "run")}
        />

        <StatTile
          value={formatDuration(totals.averageSeconds)}
          label="per run"
          detail="Averages the runs that finished"
        />

        {totals.failed > 0 ? (
          <StatTile
            value={totals.failed}
            label={totals.failed === 1 ? "run failed" : "runs failed"}
            detail={`${formatPercent(
              totals.succeeded / Math.max(1, totals.jobs),
            )} of runs succeeded`}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-ink">Cards per source</h3>

        <ul className="flex flex-col gap-4">
          {bySource.map((source) => (
            <li key={source.sourceId} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="min-w-0 flex-1 truncate">{source.title}</span>
                <span className="text-sm text-ink-muted whitespace-nowrap">
                  {formatCount(source.cardsCreated, "card")} from{" "}
                  {formatCount(source.jobs, "run")}
                  {source.failed > 0 ? (
                    // Amber is this app's "needs attention", so a failure wears
                    // it and carries the word too — never the colour alone.
                    <span className="ml-2 text-due-fg">
                      {formatCount(source.failed, "failure")}
                    </span>
                  ) : null}
                </span>
              </div>

              <Meter
                value={source.cardsCreated}
                max={best}
                size="sm"
                label={`${source.title}: ${formatCount(source.cardsCreated, "card")} drafted`}
              />
            </li>
          ))}
        </ul>
      </div>

      {heuristic ? (
        <p className="max-w-prose text-sm text-ink-subtle">
          Cards were drafted by the built-in extractor, which reads definitions
          and headings. Setting a Gemini key switches to the model, which can
          follow a definition spread across several sentences.
        </p>
      ) : null}
    </div>
  );
}
