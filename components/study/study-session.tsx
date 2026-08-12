"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FormBanner } from "@/components/auth/form-banner";
import { Button, buttonStyles } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type {
  DeckStats,
  FlashCard,
  ReviewRating,
  ReviewResult,
} from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import { formatCount, formatInterval } from "@/lib/format";
import {
  DEFAULT_STUDY_MODE,
  STUDY_MODE_COOKIE,
  studyMode,
  type StudyModeId,
} from "@/lib/study/modes";
import { GridMode } from "./grid-mode";
import { ModeSwitcher } from "./mode-switcher";
import { SwipeMode } from "./swipe-mode";

/**
 * A study session: the queue, the grading, and where you are.
 *
 * The queue is a plain array where the head is the current card. Grading pops
 * it; `AGAIN` moves it to the back so it returns before the session ends, which
 * is what "forgotten" should mean — the reader meets it again while the context
 * is still fresh, not tomorrow.
 *
 * Progress is `done / (done + remaining)`. A failed card moves within the queue
 * rather than leaving it, so the total does not grow when a card is failed and
 * the reader is not punished with a shrinking bar.
 */
export function StudySession({
  deckId,
  deckTitle,
  cards,
  stats,
  initialMode = DEFAULT_STUDY_MODE,
}: {
  deckId: string;
  deckTitle: string;
  cards: FlashCard[];
  stats: DeckStats;
  initialMode?: StudyModeId;
}) {
  const [mode, setMode] = useState<StudyModeId>(initialMode);
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  /**
   * The last grade, with the card it was applied to.
   *
   * The card is kept because undo has to put it back where it was, and what
   * "back" means depends on the grade: a passed card left the queue, a failed one
   * moved to the end of it.
   */
  const [last, setLast] = useState<{
    result: ReviewResult;
    card: FlashCard;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const current = queue[0];
  const finished = queue.length === 0;
  const total = done + queue.length;
  const sequential = studyMode(mode).sequential;

  const chooseMode = useCallback((next: StudyModeId) => {
    setMode(next);
    document.cookie = `${STUDY_MODE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
  }, []);

  /** Records a grade and advances the queue. */
  const grade = useCallback(
    async (rating: ReviewRating) => {
      if (!current || busy) return;

      setBusy(true);
      setError(null);

      try {
        const result = await apiFetch<ReviewResult>(
          `cards/${current.id}/review`,
          { method: "POST", body: { rating } },
        );

        setLast({ result, card: current });
        setRevealed(false);

        if (rating === "AGAIN") {
          // To the back, not out: the card comes round again this session.
          setQueue((q) => [...q.slice(1), q[0]]);
          setAgainCount((n) => n + 1);
        } else {
          setQueue((q) => q.slice(1));
          setDone((n) => n + 1);
        }
      } catch (thrown) {
        setError(
          thrown instanceof ApiError
            ? thrown
            : new ApiError({
                kind: "unknown",
                messages: ["That review could not be saved."],
              }),
        );
      } finally {
        setBusy(false);
      }
    },
    [current, busy],
  );

  /**
   * Reverses the grade just made.
   *
   * Only ever the last one, which is what the API guarantees — so this restores
   * the card to the front of the queue and steps the counters back. Both grades
   * are handled the same way by removing the card wherever it landed and putting
   * it first.
   */
  const undo = useCallback(async () => {
    if (!last || busy) return;

    setBusy(true);
    setError(null);

    try {
      await apiFetch(`cards/${last.card.id}/review/undo`, { method: "POST" });

      setQueue((q) => [last.card, ...q.filter((c) => c.id !== last.card.id)]);

      // A failed card never counted toward `done`, so it is not stepped back.
      if (last.result.rating !== "AGAIN") setDone((n) => Math.max(0, n - 1));
      else setAgainCount((n) => Math.max(0, n - 1));

      setLast(null);
      setRevealed(false);
    } catch (thrown) {
      setError(
        thrown instanceof ApiError
          ? thrown
          : new ApiError({
              kind: "unknown",
              messages: ["That review could not be undone."],
            }),
      );
    } finally {
      setBusy(false);
    }
  }, [last, busy]);

  /** Pushes the current card back without grading it — for a card you want to
   *  come back to rather than judge now. */
  const skip = useCallback(() => {
    setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
    setRevealed(false);
  }, []);

  const shuffle = useCallback(() => {
    setQueue((q) => {
      const next = [...q];
      // Fisher-Yates, in a handler rather than during render: an order produced
      // in a render pass would change on every re-render.
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    setRevealed(false);
  }, []);

  /**
   * Space reveals; 1–4 grade once the answer is showing.
   *
   * Bound at the window so the keys work without hunting for a focus target.
   * Number keys are why the grades are labelled with them — grading a card
   * should not need the mouse.
   */
  useEffect(() => {
    if (!sequential) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const onControl = target?.closest(
        "button, a, input, select, textarea, [contenteditable]",
      );

      if (event.key === " " && !onControl) {
        event.preventDefault();
        setRevealed((r) => !r);
        return;
      }

      if (revealed && !busy) {
        const grade_for: Record<string, ReviewRating> = {
          "1": "AGAIN",
          "2": "HARD",
          "3": "GOOD",
          "4": "EASY",
        };
        const rating = grade_for[event.key];
        if (rating) {
          event.preventDefault();
          void grade(rating);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sequential, revealed, busy, grade]);

  if (finished) {
    return (
      <SessionSummary
        deckId={deckId}
        deckTitle={deckTitle}
        done={done}
        againCount={againCount}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl">Study</h1>
          <p className="mt-1 text-ink-muted">
            <Link
              href={`/decks/${deckId}`}
              className="text-accent hover:underline"
            >
              {deckTitle}
            </Link>{" "}
            · {formatCount(cards.length, "card")} to get through
            {stats.learning > 0 ? `, ${stats.learning} relearning` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ModeSwitcher value={mode} onChange={chooseMode} />
          <Button variant="secondary" size="sm" onClick={shuffle}>
            Shuffle
          </Button>
        </div>
      </div>

      {/* What the last grade did, so the schedule is legible rather than magic:
          "Good" quietly meaning "see you in three days" teaches nothing. */}
      {last ? (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3.5 py-2"
        >
          <p className="text-sm text-ink-muted">
            {last.result.rating === "AGAIN"
              ? "Coming back before the end of this session."
              : `Next review ${formatInterval(last.result.scheduling.intervalDays)}.`}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={busy}
          >
            Undo
          </Button>
        </div>
      ) : null}

      <FormBanner error={error} />

      {mode === "swipe" ? (
        <SwipeMode
          card={current}
          revealed={revealed}
          onReveal={() => setRevealed((r) => !r)}
          onGrade={grade}
          onSkip={skip}
          busy={busy}
          done={done}
          total={total}
        />
      ) : (
        <GridMode cards={queue} />
      )}
    </div>
  );
}

function SessionSummary({
  deckId,
  deckTitle,
  done,
  againCount,
}: {
  deckId: string;
  deckTitle: string;
  done: number;
  againCount: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">Session finished</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="font-display text-xl">
          {done === 0
            ? "Nothing was graded"
            : `${formatCount(done, "card")} brought forward`}
        </p>

        <p className="max-w-prose text-ink-muted">
          {againCount > 0
            ? `${formatCount(againCount, "card")} came back round after you forgot ${
                againCount === 1 ? "it" : "them"
              }. Those are scheduled sooner than the rest — that is the schedule working, not a failure.`
            : "Every card moved out to a longer interval. They will come back when they are due."}
        </p>

        <p className="text-sm text-ink-subtle">
          Studying {deckTitle}.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href={`/decks/${deckId}`} className={buttonStyles()}>
            Back to the deck
          </Link>
          <Link
            href="/decks"
            className={buttonStyles({ variant: "secondary" })}
          >
            All decks
          </Link>
        </div>
      </div>
    </div>
  );
}
