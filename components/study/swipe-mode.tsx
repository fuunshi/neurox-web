"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FlashCard } from "@/lib/api-types";
import { CardSurface } from "./card-surface";

/** How far a drag must travel before it counts as a swipe. Low enough to feel
 *  responsive, high enough that a shaky tap does not skip a card. */
const SWIPE_THRESHOLD_PX = 70;

/** Movement beyond this is a drag, not a tap, so the release must not flip. */
const TAP_SLOP_PX = 8;

export interface SwipeModeProps {
  cards: FlashCard[];
  index: number;
  onIndexChange: (index: number) => void;
  flipped: boolean;
  onFlippedChange: (flipped: boolean) => void;
}

/**
 * One card at a time.
 *
 * Swiping moves between cards and a tap reveals the answer. Swiping deliberately
 * does **not** mean "I knew it" / "I didn't": that is a review action, and
 * nothing can record one — the API has no review endpoint and no scheduling
 * fields, so a gesture that meant that would be a lie about what was stored.
 *
 * The gesture is never the only way to do anything. Arrows and explicit buttons
 * do the same work, which is what makes this usable with a keyboard, on a
 * desktop, and with a screen reader.
 */
export function SwipeMode({
  cards,
  index,
  onIndexChange,
  flipped,
  onFlippedChange,
}: SwipeModeProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startX = useRef(0);
  const moved = useRef(0);
  const card = cards[index];

  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= cards.length) return;

    onIndexChange(next);
    // A new card always starts on its question. Carrying the flip over would
    // show the answer before the reader has tried to recall it.
    onFlippedChange(false);
    setOffset(0);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Ignore secondary buttons; a right-click is not a swipe.
    if (event.button !== 0) return;

    startX.current = event.clientX;
    moved.current = 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;

    const delta = event.clientX - startX.current;
    moved.current = Math.max(moved.current, Math.abs(delta));

    // Past the ends there is nowhere to go, so the card resists rather than
    // sliding away to nothing.
    const atStart = index === 0 && delta > 0;
    const atEnd = index === cards.length - 1 && delta < 0;

    setOffset(atStart || atEnd ? delta / 3 : delta);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;

    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (Math.abs(offset) > SWIPE_THRESHOLD_PX) {
      go(offset < 0 ? 1 : -1);
      return;
    }

    setOffset(0);
  }

  function onCardActivate() {
    // A drag that ends on the card also fires a click. Without this, releasing a
    // swipe would flip the card it just moved to.
    if (moved.current > TAP_SLOP_PX) {
      moved.current = 0;
      return;
    }
    onFlippedChange(!flipped);
  }

  if (!card) return null;

  const progress = cards.length > 0 ? ((index + 1) / cards.length) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <div
        // The drag surface. `touch-action: pan-y` leaves vertical scrolling to
        // the browser while claiming horizontal drags for the card.
        className="relative touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          onClick={onCardActivate}
          aria-label={
            flipped ? "Hide the answer" : "Show the answer"
          }
          style={{
            transform: `translateX(${offset}px)`,
            // No transition while dragging: the card should track the finger
            // exactly. The global reduced-motion rule flattens the snap-back.
          }}
          className={`flex min-h-[18rem] w-full cursor-pointer flex-col rounded-lg border border-line bg-surface p-6 text-left shadow-card sm:min-h-[22rem] sm:p-10 ${
            dragging ? "" : "transition-transform duration-200"
          }`}
        >
          <CardSurface card={card} side={flipped ? "back" : "front"} />
        </button>

        {/* Where the swipe would land. Shown only mid-drag, so it never becomes
            permanent furniture. */}
        {dragging && Math.abs(offset) > SWIPE_THRESHOLD_PX ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink-muted"
            style={{ [offset > 0 ? "left" : "right"]: "0.75rem" }}
          >
            {offset > 0 ? "Previous" : "Next"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={cards.length}
          aria-valuenow={index + 1}
          aria-label="Cards seen"
        >
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-subtle tabular-nums">
            {index + 1} of {cards.length}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => go(-1)}
              disabled={index === 0}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onFlippedChange(!flipped)}
            >
              {flipped ? "Hide answer" : "Show answer"}
            </Button>
            <Button
              size="sm"
              onClick={() => go(1)}
              disabled={index >= cards.length - 1}
            >
              Next
            </Button>
          </div>
        </div>

        <p className="text-sm text-ink-subtle">
          Drag the card, or use the arrow keys. Space reveals the answer.
        </p>
      </div>
    </div>
  );
}
