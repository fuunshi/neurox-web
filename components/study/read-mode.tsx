"use client";

import { useState } from "react";
import { LoadMore } from "@/components/ui/load-more";
import type { FlashCard } from "@/lib/api-types";
import { CardSurface } from "./card-surface";

/** How many cards are in the DOM at once. A deck of five hundred rendered at
 *  once is a document nobody scrolls; this is a reading pace, not a page size. */
const WINDOW = 20;

export interface ReadModeProps {
  cards: FlashCard[];
  /** Whether the pool has another page the session could pull in. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * Every card, both sides, as a page.
 *
 * The third trade. Swipe asks you to recall before it will show you anything;
 * Grid shows everything but hides each answer behind its own tap. Read shows
 * the question and the answer together, in order, and does not ask you
 * anything — which is what you want when the material is new, when you are
 * checking a deck is coherent, or when you simply want to read it.
 *
 * **It does not grade, and says so on the screen.** Same rule as Grid, and for
 * the same reason: nothing here asks "how well did you know that?", so nothing
 * here may record an answer to it. A reader who spent an hour here and found
 * that no review was recorded would be right to be annoyed, so the sentence is
 * visible rather than only in this comment.
 *
 * Hints are deliberately absent: `CardSurface`'s `Back` renders front and back
 * only, and a hint is a nudge toward recall — which is the exercise this mode
 * has already given up on.
 */
export function ReadMode({
  cards,
  hasMore,
  loadingMore,
  onLoadMore,
}: ReadModeProps) {
  // Windowing is local and separate from the pool's cursor: the first twenty
  // cards are already in hand, so revealing them costs no request. Only when the
  // window has caught up with what is loaded does this reach for the network.
  const [shown, setShown] = useState(WINDOW);

  const visible = cards.slice(0, shown);
  const moreInHand = shown < cards.length;

  function loadMore() {
    if (moreInHand) setShown((current) => current + WINDOW);
    else onLoadMore();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-subtle">
        Every answer is showing. Reading here does not grade anything — switch
        to Swipe to record a review.
      </p>

      <ul className="flex flex-col gap-3">
        {visible.map((card) => (
          <li
            key={card.id}
            className="rounded-lg border border-line bg-surface p-5 sm:p-6"
          >
            <CardSurface card={card} side="both" />
          </li>
        ))}
      </ul>

      <LoadMore
        shown={visible.length}
        hasMore={moreInHand || hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        noun="card"
      />
    </div>
  );
}
