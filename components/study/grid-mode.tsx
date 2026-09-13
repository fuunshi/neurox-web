"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadMore } from "@/components/ui/load-more";
import type { FlashCard } from "@/lib/api-types";
import { CardSurface } from "./card-surface";

export interface GridModeProps {
  cards: FlashCard[];
  /** Whether the pool has another page the session could pull in. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * Everything at once.
 *
 * The opposite trade to swiping: no focus, but the whole deck is visible, which
 * is what you want when scanning for the cards you keep getting wrong or
 * checking that a deck is coherent.
 *
 * Each tile flips on its own, so answers are checked one at a time rather than
 * all at once — revealing all of them would turn the grid into a wall of text
 * with nothing left to recall.
 *
 * **Browsing does not grade.** A tile has no honest way to ask "how well did you
 * know that?" in the space between two other tiles, and a grid where every click
 * could silently record a review is a grid you stop clicking. Saying so plainly
 * matters more than it sounds: the alternative is a reader studying here for an
 * hour and finding nothing was recorded.
 */
export function GridMode({
  cards,
  hasMore,
  loadingMore,
  onLoadMore,
}: GridModeProps) {
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-subtle">
          Tap a card to check its answer. Checking a card here does not grade it
          — switch to Swipe to record a review.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRevealed(new Set(cards.map((card) => card.id)))}
            disabled={revealed.size === cards.length}
          >
            Reveal all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRevealed(new Set())}
            disabled={revealed.size === 0}
          >
            Hide all
          </Button>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const shown = revealed.has(card.id);

          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => toggle(card.id)}
                aria-expanded={shown}
                className="flex h-full min-h-40 w-full cursor-pointer flex-col rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong"
              >
                <CardSurface
                  card={card}
                  side={shown ? "back" : "front"}
                  className="flex-1"
                />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-ink-subtle">
        Showing {cards.length} card{cards.length === 1 ? "" : "s"}
        {revealed.size > 0
          ? ` · ${revealed.size} answer${revealed.size === 1 ? "" : "s"} revealed`
          : ""}
      </p>

      {/* The grid never grades, and grading was the only thing that pulled the
          next page in — so without this the deck stopped at the first page and
          said nothing about it. */}
      <LoadMore
        shown={cards.length}
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={onLoadMore}
        noun="card"
      />
    </div>
  );
}
