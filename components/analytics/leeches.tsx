import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import type { ReviewAnalytics } from "@/lib/api-types";
import { formatCount } from "@/lib/format";

/**
 * The cards that keep coming back.
 *
 * Ranked by how often they were failed in the window, with the card's own lapse
 * count as the tie-break — that count outlives the window, so it is the same
 * fact over a longer history rather than a second opinion.
 *
 * The bar is relative to the worst card rather than to the number of reviews, so
 * the list reads as a ranking. What it deliberately does not do is call these
 * cards *bad*: a card failed repeatedly is usually written badly rather than
 * being hard, which is why the copy points at the rewrite rather than at more
 * repetition.
 */
export function Leeches({ analytics }: { analytics: ReviewAnalytics }) {
  const { leeches } = analytics;

  if (leeches.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-muted">
        Nothing is stuck. No card has been failed twice in the last{" "}
        {analytics.windowDays} days.
      </p>
    );
  }

  const worst = Math.max(1, ...leeches.map((card) => card.count));

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-ink-muted">
        Failed at least twice in the last {analytics.windowDays} days. A card you
        keep forgetting is usually written badly rather than being hard — the
        card&rsquo;s own page has a rewrite action that says why.
      </p>

      <ul className="flex flex-col gap-4">
        {leeches.map((card) => (
          <li key={card.cardId} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="min-w-0 flex-1">{card.front}</span>
              <span className="text-sm text-ink-muted whitespace-nowrap">
                {formatCount(card.count, "failure")}
                {card.lapses > card.count
                  ? ` · ${formatCount(card.lapses, "lapse")} in all`
                  : ""}
              </span>
            </div>

            <Meter
              value={card.count}
              max={worst}
              size="sm"
              tone={card.count >= worst ? "due" : "accent"}
              label={`${card.front}: ${formatCount(card.count, "failure")} in the last ${analytics.windowDays} days`}
            />

            <Link
              href={`/decks/${card.deckId}`}
              className="self-start text-sm text-accent hover:underline"
            >
              {card.deckTitle}
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/decks" className={buttonStyles({ variant: "secondary" })}>
        Go to your decks
      </Link>
    </div>
  );
}
