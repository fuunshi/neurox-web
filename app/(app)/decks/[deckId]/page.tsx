import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import type { CursorPage, Deck, FlashCard, GenerationJob } from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import { getDeck, listCards, listGenerationJobs } from "@/lib/server/queries";
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
}> {
  try {
    const [deck, cards, jobs] = await Promise.all([
      getDeck(deckId),
      listCards(deckId, { limit: 50 }),
      listGenerationJobs({ deckId, limit: 3 }),
    ]);

    return { deck, cards, jobs };
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
  const { deck, cards, jobs } = await loadDeck(deckId);

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
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Always offered, even when nothing is active yet: the study screen
              explains that only accepted cards can be studied and links back to
              the drafts, which is more useful than a link that appears and
              disappears. */}
          <Link href={`/decks/${deck.id}/study`} className={buttonStyles()}>
            Study
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
    </div>
  );
}
