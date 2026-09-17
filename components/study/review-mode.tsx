"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { FlashCard, ReviewRating } from "@/lib/api-types";
import { REVIEW_GRADES } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { CardSurface } from "./card-surface";

export interface ReviewModeProps {
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
   * arrives from the window keyboard listener — and a card that only answered
   * the buttons would go silent for anyone grading with keys.
   */
  pendingRating: ReviewRating | null;
}

/**
 * How far each grade sends the card, and how much it leans on the way.
 *
 * Again and Easy travel furthest; Hard and Good half as far toward the same
 * side. Hard leaning *left* is not decoration — it is the grade that sits next
 * to Again in the 1–4 order, and most reviews land somewhere on that axis. So
 * the keyboard route is graded in the same language as the buttons rather than
 * a quieter one.
 */
const EXIT: Record<ReviewRating, { x: string; rotate: string }> = {
  AGAIN: { x: "-110%", rotate: "-6deg" },
  HARD: { x: "-52%", rotate: "-3deg" },
  GOOD: { x: "52%", rotate: "3deg" },
  EASY: { x: "110%", rotate: "6deg" },
};

/** The grades that get a control. The set is described once in `lib/format.ts`;
 *  this only asks which of them earn a button. */
const BUTTON_GRADES = REVIEW_GRADES.filter((grade) => grade.button);

/**
 * One card at a time: reveal, then grade.
 *
 * ## Two actions, not a gesture
 *
 * This used to be graded by dragging the card left or right. The gesture is
 * gone, and the reason is the one this codebase already gives about its own quiz
 * board (`components/quiz/matching-board.tsx`): dragging cannot be done from a
 * keyboard, needs a fallback for touch and for anyone using a screen reader, and
 * that fallback is what you should have written. Here the drag also duplicated
 * the buttons exactly, so it added risk without adding a capability — and it
 * carried three bugs that only a pointer can have: a fast flick read a stale
 * offset and silently recorded nothing, `pointercancel` committed a grade the
 * reader never made, and a drag before the reveal did nothing at all with no
 * explanation.
 *
 * What is left is two large controls that say what they do. Every route in —
 * click, key, arrow — ends in the same call.
 *
 * ## Still gated on the reveal
 *
 * A card cannot be graded before its answer is showing — grading something you
 * have not checked is guessing at your own memory, and the schedule would learn
 * from noise. The controls simply are not there until then, which is a plainer
 * way of saying it than accepting a drag and ignoring it.
 *
 * ## Answering the grade
 *
 * A grade is saved the moment it is given. The card leaves in the direction of
 * the grade while the request is in flight, and the next one rises into place.
 * The movement is `no-preference` only (see `styles/motion.css`) — for a reader
 * who asked for less motion the card is simply replaced — and the colour wash is
 * unconditional, because that is the part carrying the meaning.
 */
export function ReviewMode({
  card,
  revealed,
  onReveal,
  onGrade,
  onSkip,
  busy,
  done,
  total,
  pendingRating,
}: ReviewModeProps) {
  if (!card) return null;

  const progress = total > 0 ? (done / total) * 100 : 0;
  const exit = pendingRating ? EXIT[pendingRating] : null;

  // Again is the only grade that means the card was not recalled; Hard, Good and
  // Easy all mean it was, and differ in *when* the card comes back rather than
  // in whether it was known. So the colour is binary and the travel is
  // graduated — which is also why amber is absent: it means "needs your
  // attention" everywhere in this product, and a card just answered is not
  // asking for anything.
  const wash =
    pendingRating === "AGAIN"
      ? "border-danger/60 bg-danger-soft"
      : pendingRating
        ? "border-success/60 bg-success-soft"
        : "cursor-pointer border-line hover:border-line-strong";

  return (
    <div className="flex flex-col gap-5 animate-card-in">
      <button
        type="button"
        onClick={onReveal}
        aria-label={revealed ? "Hide the answer" : "Show the answer"}
        style={
          exit
            ? ({
                "--nx-exit-x": exit.x,
                "--nx-exit-rotate": exit.rotate,
              } as CSSProperties)
            : undefined
        }
        className={cn(
          "relative flex min-h-[18rem] w-full flex-col rounded-lg border bg-surface p-6 text-left shadow-card sm:min-h-[22rem] sm:p-10",
          wash,
          exit ? "cursor-default animate-card-exit" : "transition-colors",
        )}
      >
        <CardSurface card={card} side={revealed ? "back" : "front"} />

        {/* What the grade was, stamped on the card as it leaves — so it rides
            out with it rather than hanging over the page. Shown for every
            grade, not only the two with buttons: a reader pressing 2 or 4 needs
            to see which one they pressed just as much. */}
        {pendingRating ? (
          <span
            aria-hidden
            className={cn(
              "absolute bottom-5 left-1/2 -translate-x-1/2 rounded-md border px-3 py-1.5 text-sm animate-stamp",
              pendingRating === "AGAIN"
                ? "border-danger/40 bg-danger-soft text-danger-fg"
                : "border-success/40 bg-success-soft text-success",
            )}
          >
            {
              REVIEW_GRADES.find((grade) => grade.rating === pendingRating)
                ?.label
            }
          </span>
        ) : null}
      </button>

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
            {/* Two halves of the width, so the size of the target says how much
                of the decision each one is. */}
            <div className="grid grid-cols-2 gap-3">
              {BUTTON_GRADES.map((grade) => (
                <Button
                  key={grade.rating}
                  size="lg"
                  variant={grade.rating === "GOOD" ? "primary" : "secondary"}
                  disabled={busy}
                  onClick={() => onGrade(grade.rating)}
                  title={grade.hint}
                  aria-keyshortcuts={grade.key}
                >
                  {grade.label}
                  <span aria-hidden className="ml-1 text-xs opacity-70">
                    {grade.rating === "AGAIN" ? "1 or ←" : "3 or →"}
                  </span>
                </Button>
              ))}
            </div>

            {/* Below the pair rather than beside them: with two large controls, a
                third in the same row competes for the same glance. */}
            <div className="flex justify-center">
              <Button variant="ghost" onClick={onSkip} disabled={busy}>
                Skip
              </Button>
            </div>

            <p className="text-center text-sm text-ink-subtle">
              Keys 1–4 grade, with Hard and Easy on 2 and 4; space hides the
              answer.
            </p>
          </>
        ) : (
          <>
            <Button size="lg" onClick={onReveal}>
              Show answer
            </Button>

            <div className="flex justify-center">
              <Button variant="ghost" onClick={onSkip}>
                Skip
              </Button>
            </div>

            <p className="text-center text-sm text-ink-subtle">
              {done} of {total} graded. Reveal the answer to grade this card —
              space does it too.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
