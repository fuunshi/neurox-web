"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadMore } from "@/components/ui/load-more";
import type { CursorPage, Deck } from "@/lib/api-types";
import { useCursorList } from "@/lib/hooks/use-cursor-list";
import { NewDeck } from "./new-deck";

/**
 * The deck list, which keeps loading.
 *
 * The page itself stays a server component and fetches the first page, so the
 * grid is complete on first paint; this owns only what happens after that.
 *
 * Creating a deck is applied here rather than by refreshing the route. A refresh
 * would re-render the page with a fresh first page while this component holds
 * every page loaded so far — so the reader would add a deck and lose the ones
 * they had just scrolled to.
 */
export function DecksView({ initialDecks }: { initialDecks: CursorPage<Deck> }) {
  const {
    items: decks,
    setItems: setDecks,
    hasMore,
    loading,
    loadMore,
  } = useCursorList<Deck>(initialDecks, "decks?limit=24");

  /** Newest first, which is the order the API returns a list in. */
  function addDeck(deck: Deck) {
    setDecks((current) => [deck, ...current]);
  }

  const withCards = decks.filter((deck) => deck.cardCount > 0).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Decks</h1>
          <p className="mt-1 text-ink-muted">
            Each deck holds the cards for one subject.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/generate"
            className={buttonStyles({ variant: "secondary" })}
          >
            Draft from a source
          </Link>
          <NewDeck onCreated={addDeck} />
        </div>
      </div>

      {decks.length === 0 ? (
        <EmptyState
          title="No decks yet"
          description="Bring a PDF, a Word document or a page of notes and neurox will draft cards from it. You keep the ones worth keeping."
          action={
            <Link href="/sources" className={buttonStyles()}>
              Add your first source
            </Link>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {decks.map((deck) => (
              <li key={deck.id}>
                <Link
                  href={`/decks/${deck.id}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <span className="font-display text-lg">{deck.title}</span>
                  {deck.description ? (
                    <span className="line-clamp-2 text-sm text-ink-muted">
                      {deck.description}
                    </span>
                  ) : null}
                  <span className="mt-auto pt-2">
                    <Chip tone={deck.cardCount === 0 ? "due" : "neutral"}>
                      {deck.cardCount === 0
                        ? "No cards yet"
                        : `${deck.cardCount} card${deck.cardCount === 1 ? "" : "s"}`}
                    </Chip>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <LoadMore
            shown={decks.length}
            hasMore={hasMore}
            loading={loading}
            onLoadMore={loadMore}
            noun="deck"
          />

          {withCards > 0 ? (
            <p className="text-sm text-ink-subtle">
              Generated cards stay drafts until you keep them, so a deck is
              worth opening even when nothing is due.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
