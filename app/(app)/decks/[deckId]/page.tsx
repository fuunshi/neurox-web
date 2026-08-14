import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import type {
  CursorPage,
  Deck,
  DeckStats,
  FlashCard,
  GenerationJob,
} from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import {
  getDeck,
  getDeckStats,
  listCards,
  listGenerationJobs,
} from "@/lib/server/queries";
import { CardReview } from "./card-review";

/**
 * Loads the deck, its cards and its recent jobs.
 *
 * The fetch is the only thing inside `try` — JSX is built after it. A
 * `try`/`catch` around JSX looks like it guards rendering, but React renders
 * later and elsewhere, so it catches nothing; only the awaited calls can throw
 * here, and only they are guarded.
 */
async function loadDeck(deckId: string): Promise<{
  deck: Deck;
  cards: CursorPage<FlashCard>;
  jobs: CursorPage<GenerationJob>;
  stats: DeckStats;
}> {
  try {
    const [deck, cards, jobs, stats] = await Promise.all([
      getDeck(deckId),
      listCards(deckId, { limit: 50 }),
      listGenerationJobs({ deckId, limit: 3 }),
      getDeckStats(deckId),
    ]);

    return { deck, cards, jobs, stats };
  } catch (error) {
    // A deck that does not exist and one belonging to someone else both answer
    // 404 from the API, so both become this page's not-found.
    if (error instanceof ApiError && error.kind === "not_found") notFound();
    throw error;
  }
}

export default async function DeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const { deck, cards, jobs, stats } = await loadDeck(deckId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl">{deck.title}</h1>
          {deck.description ? (
            <p className="mt-1 max-w-prose text-ink-muted">
              {deck.description}
            </p>
          ) : null}

          {/* The schedule, stated as counts. "Due" is the number the study
              screen will actually offer, so the button and the list agree. */}
          {stats.active > 0 ? (
            <p className="mt-2 text-sm text-ink-subtle">
              {formatCount(stats.active, "active card")}
              {stats.due > 0 ? ` · ${stats.due} due` : " · nothing due"}
              {stats.newCards > 0 ? ` · ${stats.newCards} new` : ""}
              {stats.learning > 0 ? ` · ${stats.learning} relearning` : ""}
              {stats.reviewedInLastDay > 0
                ? ` · ${stats.reviewedInLastDay} reviewed today`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Always offered, even when nothing is active or due: the study
              screen explains which of those it is and links back, which is more
              useful than a button that appears and disappears. */}
          <Link href={`/decks/${deck.id}/study`} className={buttonStyles()}>
            {stats.due > 0 ? `Study ${stats.due} due` : "Study"}
          </Link>
          <Link
            href={`/generate?deck=${deck.id}`}
            className={buttonStyles({ variant: "secondary" })}
          >
            Draft more cards
          </Link>
          <Link href="/decks" className={buttonStyles({ variant: "quiet" })}>
            All decks
          </Link>
        </div>
      </div>

      <CardReview
        deckId={deck.id}
        initialCards={cards.data}
        initialHasMore={cards.pagination.hasMore}
        lastJob={jobs.data[0] ?? null}
      />

      {/* Placed at the end rather than in the header: exporting is something you
          do when you are done with a deck, not while working in it, and the
          header already carries three actions. */}
      <section className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 className="text-sm font-medium">Take this deck elsewhere</h2>
        <p className="max-w-prose text-sm text-ink-muted">
          <a
            href={`/api/decks/${deck.id}/export?format=csv`}
            className="text-accent hover:underline"
            download
          >
            Export as CSV
          </a>{" "}
          for a spreadsheet, or{" "}
          <a
            href={`/api/decks/${deck.id}/export?format=tsv`}
            className="text-accent hover:underline"
            download
          >
            as TSV
          </a>{" "}
          for Anki, which prefers tabs because card text often contains commas.
          Every card is included — questions, answers, hints, and where each one
          is in its schedule.
        </p>
      </section>
    </div>
  );
}
