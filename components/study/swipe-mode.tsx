"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { FlashCard, ReviewRating } from "@/lib/api-types";
import { REVIEW_GRADES } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { CardSurface } from "./card-surface";

/** How far a drag must travel before it counts as a swipe. Low enough to feel
 *  responsive, high enough that a shaky tap does not grade a card. */
const SWIPE_THRESHOLD_PX = 70;

/** Movement beyond this is a drag, not a tap, so the release must not flip. */
const TAP_SLOP_PX = 8;

export interface SwipeModeProps {
  card: FlashCard | undefined;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (rating: ReviewRating) => void;
  onSkip: () => void;
  busy: boolean;
  done: number;
  total: number;
  /**
   * The grade currently being saved, or null.
   *
   * Owned by the session rather than this component, because grading also
   * arrives from the window keyboard listener — and a card that only
   * acknowledged the gesture would go silent for anyone grading with keys.
   */
  pendingRating: ReviewRating | null;
}

/** The grades that get a control on the card. The set is described once in
 *  `lib/format.ts`; this only asks which of them earn a button. */
const BUTTON_GRADES = REVIEW_GRADES.filter((grade) => grade.button);

/**
 * One card at a time: reveal, then grade.
 *
 * A card cannot be graded before its answer is showing — grading something you
 * have not checked is guessing at your own memory, and the schedule would learn
 * from noise.
 *
 * Dragging right means Good and left means Again: the two grades that cover
 * almost every review get the gesture, and the same two get the buttons. Hard
 * and Easy stay one keystroke away on 2 and 4, which keeps every route reachable
 * without reading past four controls to find the two anyone actually uses.
 *
 * ## Answering the gesture
 *
 * A grade is saved the moment the card is released — the request is never held
 * behind an animation, because jsdom does not run CSS animations and a reducer
 * waiting on `animationend` would be a test that hangs and a real card that
 * stalls. So the acknowledgement runs alongside the save rather than before it:
 * the card holds where the reader put it, leans further, and takes a colour.
 * The move is what makes the gesture feel heard; the colour is what survives for
 * someone who asked for less motion.
 */
export function SwipeMode({
  card,
  revealed,
  onReveal,
  onGrade,
  onSkip,
  busy,
  done,
  total,
  pendingRating,
}: SwipeModeProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** Where the last committed throw ended, for the animation to carry on from.
   *  Captured before `offset` is reset, since the animation outranks the inline
   *  transform and needs the distance itself. */
  const [throwDistance, setThrowDistance] = useState(0);

  const startX = useRef(0);
  const moved = useRef(0);

  if (!card) return null;

  // Grading by drag is only offered once the answer is on screen.
  const gradable = revealed && !busy;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !gradable || pendingRating) return;

    startX.current = event.clientX;
    moved.current = 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;

    const delta = event.clientX - startX.current;
    moved.current = Math.max(moved.current, Math.abs(delta));
    setOffset(delta);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;

    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    // The threshold is the commit point; below it the card springs back and
    // nothing is recorded.
    if (Math.abs(offset) > SWIPE_THRESHOLD_PX) {
      const rating: ReviewRating = offset < 0 ? "AGAIN" : "GOOD";
      // Reset the inline transform, but remember the throw first: the pending
      // animation is what the reader sees from here, and if the save fails the
      // card is simply back at centre with nothing left to unwind.
      setThrowDistance(offset);
      setOffset(0);
      onGrade(rating);
      return;
    }

    setOffset(0);
  }

  function onCardClick() {
    // A drag that ends on the card also fires a click; without this, releasing a
    // swipe would immediately re-reveal the card it just graded.
    if (moved.current > TAP_SLOP_PX) {
      moved.current = 0;
      return;
    }
    onReveal();
  }

  const progress = total > 0 ? (done / total) * 100 : 0;
  const committing = dragging && Math.abs(offset) > SWIPE_THRESHOLD_PX;
  // The grade being saved wins over the drag: after release, the card is
  // answering rather than following a finger.
  const answering = pendingRating ?? null;

  return (
    <div className={cn("flex flex-col gap-5", "animate-card-in")}>
      <div
        // `touch-action: pan-y` leaves vertical scrolling to the browser while
        // claiming horizontal drags for the card.
        className={cn("relative touch-pan-y select-none", !gradable && "cursor-default")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          onClick={onCardClick}
          aria-label={revealed ? "Hide the answer" : "Show the answer"}
          style={
            {
              transform: `translateX(${offset}px)`,
              // Read by the keyframes in styles/motion.css. A custom property
              // rather than a class because the value is the reader's own drag,
              // and `as CSSProperties` because TypeScript does not accept custom
              // properties in a typed style object.
              "--nx-throw": `${throwDistance}px`,
            } as CSSProperties
          }
          className={cn(
            "flex min-h-[18rem] w-full flex-col rounded-lg border bg-surface p-6 text-left shadow-card sm:min-h-[22rem] sm:p-10",
            // The colour is the part that survives reduced motion, so it carries
            // the meaning on its own: green for Good, the danger tone Again
            // already had while dragging. Amber is deliberately absent — it
            // means "needs your attention" everywhere in this product, and a
            // card just graded is the opposite of that.
            answering === "GOOD"
              ? "cursor-default border-success/60 bg-success-soft animate-card-good"
              : answering === "AGAIN"
                ? "cursor-default border-danger/60 bg-danger-soft animate-card-again"
                : committing
                  ? offset < 0
                    ? "cursor-grabbing border-danger/60"
                    : "cursor-grabbing border-accent"
                  : "cursor-pointer border-line",
            // No transition while dragging: the card should track the pointer
            // exactly. None while answering either, or the transition fights the
            // animation for the same property.
            dragging || answering
              ? ""
              : "transition-transform duration-200",
          )}
        >
          <CardSurface card={card} side={revealed ? "back" : "front"} />
        </button>

        {/* Where the swipe would land, and then where it did — shown from the
            moment the threshold is crossed until the save settles, so releasing
            reads as stamped rather than as a label that was always there. */}
        {committing || answering ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-md border px-2.5 py-1 text-sm",
              (answering ?? (offset < 0 ? "AGAIN" : "GOOD")) === "AGAIN"
                ? "left-3 border-danger/40 bg-danger-soft text-danger-fg"
                : "right-3 border-accent/40 bg-accent-soft text-accent",
              answering && "animate-stamp",
            )}
          >
            {(answering ?? (offset < 0 ? "AGAIN" : "GOOD")) === "AGAIN"
              ? "Again"
              : "Good"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="Cards graded"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {revealed ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {BUTTON_GRADES.map((grade) => (
                <Button
                  key={grade.rating}
                  variant={grade.rating === "GOOD" ? "primary" : "secondary"}
                  disabled={busy}
                  onClick={() => onGrade(grade.rating)}
                  title={grade.hint}
                  aria-keyshortcuts={grade.key}
                >
                  {grade.label}
                  <span
                    aria-hidden
                    className="ml-0.5 text-xs text-ink-subtle"
                  >
                    {grade.key}
                  </span>
                </Button>
              ))}

              <Button
                variant="ghost"
                onClick={onSkip}
                disabled={busy}
                className="ml-auto"
              >
                Skip
              </Button>
            </div>

            <p className="text-sm text-ink-subtle">
              Swipe left for Again, right for Good. Keys 1–4 grade, with Hard and
              Easy on 2 and 4; space hides the answer.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onReveal}>Show answer</Button>
              <Button
                variant="ghost"
                onClick={onSkip}
                className="ml-auto"
              >
                Skip
              </Button>
            </div>

            <p className="text-sm text-ink-subtle">
              {done} of {total} graded. Reveal the answer to grade this card —
              space does it too.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
