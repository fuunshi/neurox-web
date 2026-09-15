"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { FormBanner } from "@/components/auth/form-banner";
import { Button, buttonStyles } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api/client";
import type {
  FlashCard,
  ReviewRating,
  ReviewResult,
  StudyPool,
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
import { KeyboardLegend } from "./keyboard-legend";
import { ModeSwitcher } from "./mode-switcher";
import { ReadMode } from "./read-mode";
import { SessionProgress } from "./session-progress";
import { ReviewMode } from "./review-mode";

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
  pool,
  include,
  initialMode = DEFAULT_STUDY_MODE,
  rail,
}: {
  deckId: string;
  deckTitle: string;
  pool: StudyPool;
  /** Which pool this is, so a continued page asks for the same one. */
  include: "due" | "all";
  initialMode?: StudyModeId;
  /**
   * Server-rendered content for the right-hand column, below the session's own
   * progress. A slot rather than props, so the facts the page already fetched
   * stay on the server instead of being handed to this component to pass on.
   */
  rail?: ReactNode;
}) {
  const cards = pool.data;
  const [mode, setMode] = useState<StudyModeId>(initialMode);
  const [queue, setQueue] = useState(cards);
  /**
   * Where the next page of the pool is.
   *
   * The API caps a page, so a deck bigger than one page would otherwise end its
   * session early and silently — the reader would finish "everything due" while
   * cards were still waiting. Instead the session continues into the next page
   * when the queue runs out, and only finishes when the cursor does.
   */
  const [cursor, setCursor] = useState(pool.pagination.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
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
  /**
   * The grade currently being saved.
   *
   * Lives here rather than in `ReviewMode` because grading reaches `grade()` from
   * four places — the drag, the buttons, keys 1–4 on the window listener, and
   * Skip — and the keyboard is the one most readers use. A card that only
   * acknowledged the gesture would go silent for them.
   */
  const [pendingRating, setPendingRating] = useState<ReviewRating | null>(null);

  const current = queue[0];
  /**
   * The session is over only when the queue is empty *and* there is nothing
   * left to pull in. A cursor still in hand means another page exists, so a
   * deck larger than one page cannot finish early without saying so.
   */
  const finished = queue.length === 0 && cursor === null;
  const total = done + queue.length;
  const sequential = studyMode(mode).sequential;

  const chooseMode = useCallback((next: StudyModeId) => {
    setMode(next);
    document.cookie = `${STUDY_MODE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
  }, []);

  /**
   * Pulls the next page of the pool and appends it to the queue.
   *
   * Driven by the grade that drained the queue rather than by an effect on
   * `queue.length`: this is a consequence of something the reader did, and an
   * effect that set state on mount would render twice for nothing. The guard
   * also means a failing API is asked once, not once per render.
   */
  const loadNextPage = useCallback(async () => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const query = new URLSearchParams({ limit: "50", include, cursor });
      const page = await apiFetch<StudyPool>(
        `decks/${deckId}/study?${query.toString()}`,
      );

      setQueue((q) => [...q, ...page.data]);
      // An empty page alongside a cursor would mean no progress; treat it as
      // the end rather than asking again for the same rows.
      setCursor(page.data.length > 0 ? page.pagination.nextCursor : null);
    } catch (thrown) {
      setError(
        thrown instanceof ApiError
          ? thrown
          : new ApiError({
              kind: "unknown",
              messages: ["The rest of this deck could not be loaded."],
            }),
      );
      // Give up rather than retrying forever. The reader is told why, and the
      // session ends at the card it actually reached.
      setCursor(null);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, include, deckId]);

  /**
   * The pagination handle, handed to the modes that never grade.
   *
   * `loadNextPage` is otherwise driven by the grade that drained the queue —
   * which works for Swipe and leaves Grid stuck on the first page of any deck
   * larger than one. Grid and Read both need to ask for more themselves.
   *
   * Declared after `loadNextPage` rather than beside the other derived values:
   * it closes over that callback, and reading it before its declaration is what
   * the React compiler refuses to memoize around.
   */
  const loadMoreProps = {
    hasMore: cursor !== null,
    loadingMore,
    onLoadMore: () => void loadNextPage(),
  };

  /** Records a grade and advances the queue. */
  const grade = useCallback(
    async (rating: ReviewRating) => {
      if (!current || busy) return;

      setBusy(true);
      setError(null);
      // Set before the request, cleared in `finally`: the card answers the
      // grade immediately rather than after the network, which is the whole
      // difference between a card that feels heard and one that feels ignored.
      setPendingRating(rating);

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
          const rest = queue.slice(1);
          setQueue(rest);
          setDone((n) => n + 1);

          // The queue is drained but the pool may not be. Without this the
          // session would end early on any deck larger than one page, and say
          // it was finished — the one thing a study session must not do.
          if (rest.length === 0 && cursor) await loadNextPage();
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
        setPendingRating(null);
      }
    },
    [current, busy, queue, cursor, loadNextPage],
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
   * Space reveals; 1–4 grade once the answer is showing, and the arrows grade
   * the two that have buttons.
   *
   * Bound at the window so the keys work without hunting for a focus target.
   * Number keys are why the grades are labelled with them — grading a card
   * should not need the mouse. The arrows were documented in the keyboard
   * legend long before anything implemented them; they are here now, and gated
   * on `!onControl` below so the mode switcher keeps its own ArrowLeft/Right
   * when it holds focus.
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

      if (!revealed || busy) return;

      // The arrows grade — ← is Again and → is Good, the direction the buttons
      // sit in, which is also the direction the card leaves in.
      //
      // Refused only inside the mode switcher, which is a radiogroup and owns
      // ArrowLeft/Right while it has focus. Deliberately not gated on *any*
      // control: clicking "Show answer" leaves focus on that button, and the
      // arrows have to work from there — that is the ordinary way through this
      // screen, not an edge case.
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (target?.closest('[role="radiogroup"]')) return;
        event.preventDefault();
        void grade(event.key === "ArrowLeft" ? "AGAIN" : "GOOD");
        return;
      }

      // Deliberately *not* gated on `onControl`: after clicking "Show answer"
      // the focus is on that button, and the number keys are the main way
      // through this screen — they have to work from there.
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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sequential, revealed, busy, grade]);

  // The queue is drained but the pool is not: another page is on its way. Shown
  // rather than the summary, and without the session chrome, because there is
  // no card to present yet.
  if (queue.length === 0 && loadingMore) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-6">
        <Spinner className="size-5 text-accent" />
        <p className="text-ink-muted">Bringing in the next cards…</p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col gap-6">
        {/*
          Grading the last card is what ends the session, so this banner has to
          survive into the summary — otherwise ending the session is what makes
          the final grade the one that cannot be taken back. Undoing here puts
          the card back at the head of the queue, and the session resumes.
        */}
        <LastGradeBanner last={last} onUndo={undo} busy={busy} />
        <FormBanner error={error} />

        <SessionSummary
          deckId={deckId}
          deckTitle={deckTitle}
          done={done}
          againCount={againCount}
        />
      </div>
    );
  }

  return (
    /*
     * Two columns from `lg` up. `lg` rather than `md` because the card is the
     * thing being studied: at 48rem a 17rem rail would leave it under 30rem,
     * which is a worse session in exchange for a tidier gutter. Below `lg` this
     * is a plain column and the rail simply follows the card, which is the
     * right order on a phone — the DOM order is already main-then-aside, so no
     * `order` utilities are needed.
     */
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl">Study</h1>
            {/* Just the deck. The counts that used to sit here are in the rail
                now, and the same number in two places two centimetres apart
                reads as a mistake rather than as emphasis. */}
            <p className="mt-1 text-ink-muted">
              <Link
                href={`/decks/${deckId}`}
                className="text-accent hover:underline"
              >
                {deckTitle}
              </Link>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ModeSwitcher value={mode} onChange={chooseMode} />
            <Button variant="secondary" size="sm" onClick={shuffle}>
              Shuffle
            </Button>
          </div>
        </div>

        <LastGradeBanner last={last} onUndo={undo} busy={busy} />

        <FormBanner error={error} />

        {renderMode()}
      </div>

      {/* Sticky, because Read's column scrolls far past the rail and a sidebar
          that has scrolled away is not a sidebar. */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        <SessionProgress
          done={done}
          remaining={queue.length}
          againCount={againCount}
        />
        {rail}
        <KeyboardLegend mode={mode} revealed={revealed} />
      </aside>
    </div>
  );

  /**
   * Which presentation the chosen mode gets.
   *
   * An exhaustive switch with a `never` guard rather than a ternary, so
   * `lib/study/modes.ts`'s promise — that a new mode is an entry there and a
   * component — is enforced by the compiler. A missing arm is a typecheck
   * failure instead of a mode that silently renders nothing.
   */
  function renderMode() {
    switch (mode) {
      case "swipe":
        return (
          <ReviewMode
            // Keyed by the card, so the next one arrives as a fresh mount: the
            // drag offset resets and the entrance animation replays without an
            // effect to reset state on every change.
            key={current?.id ?? "empty"}
            card={current}
            revealed={revealed}
            onReveal={() => setRevealed((r) => !r)}
            onGrade={grade}
            onSkip={skip}
            busy={busy}
            done={done}
            total={total}
            pendingRating={pendingRating}
          />
        );
      case "grid":
        return <GridMode cards={queue} {...loadMoreProps} />;
      case "read":
        return <ReadMode cards={queue} {...loadMoreProps} />;
      default: {
        const unhandled: never = mode;
        throw new Error(
          `No component for study mode "${String(unhandled)}". Add an arm to renderMode().`,
        );
      }
    }
  }
}

/**
 * What the last grade did, and the way back out of it.
 *
 * Shown so the schedule is legible rather than magic: "Good" quietly meaning
 * "see you in three days" teaches nothing. It carries the undo because a
 * mis-click is not a review that happened, and it is rendered by both the
 * running session and the summary — the summary included on purpose, since
 * grading the last card is what ends the session.
 */
function LastGradeBanner({
  last,
  onUndo,
  busy,
}: {
  last: { result: ReviewResult; card: FlashCard } | null;
  onUndo: () => void;
  busy: boolean;
}) {
  if (!last) return null;

  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3.5 py-2"
    >
      <p className="text-sm text-ink-muted">
        {last.result.rating === "AGAIN"
          ? "Coming back before the end of this session."
          : `Next review ${formatInterval(last.result.scheduling.intervalDays)}.`}
      </p>
      <Button variant="ghost" size="sm" onClick={onUndo} disabled={busy}>
        Undo
      </Button>
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
