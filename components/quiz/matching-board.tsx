"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { QuizQuestion } from "@/lib/api-types";

/**
 * Pair every prompt with its answer from one shared pool.
 *
 * **Click-to-pair rather than drag.** Dragging is the obvious gesture here and
 * it is the wrong one: it cannot be done from a keyboard, it needs a fallback
 * anyway for touch and for anyone using a screen reader, and that fallback
 * would be this. So this is the whole interaction — select a prompt, then
 * select an answer — and dragging is left out rather than duplicated.
 *
 * The board is submitted in one go rather than per pair, because a pair is not
 * a question on its own: which answer belongs to which prompt is only settled
 * once the whole set is placed, and grading halfway through would judge a
 * board that is still being arranged.
 */
export function MatchingBoard({
  questions,
  answered,
  busy,
  onSubmit,
}: {
  questions: QuizQuestion[];
  /** True once the board has been graded. */
  answered: boolean;
  busy: boolean;
  onSubmit: (pairings: Record<number, string>) => void;
}) {
  const [pairings, setPairings] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);

  const pool = questions[0]?.options ?? [];
  const takenAnswers = new Set(Object.values(pairings));
  const placed = Object.keys(pairings).length;

  function choosePrompt(position: number) {
    if (answered) return;
    // Clicking the prompt you just selected unselects it, so a misclick is one
    // click to undo rather than a state you have to work around.
    setSelected((current) => (current === position ? null : position));
  }

  function chooseAnswer(option: string) {
    if (answered || selected === null) return;

    setPairings((current) => ({ ...current, [selected]: option }));
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-muted">
        {answered
          ? "Every pair is marked below."
          : selected === null
            ? "Choose a prompt on the left, then its answer on the right."
            : "Now choose its answer."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="flex flex-col gap-2">
          {questions.map((question) => {
            const chosen = pairings[question.position];
            const isRight = answered && question.correct === chosen;

            return (
              <li key={question.position}>
                <button
                  type="button"
                  disabled={answered || busy}
                  aria-pressed={selected === question.position}
                  onClick={() => choosePrompt(question.position)}
                  className={cn(
                    "w-full cursor-pointer rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors",
                    !answered && "border-line-strong bg-surface hover:border-accent",
                    selected === question.position &&
                      "border-accent bg-accent-soft",
                    answered && isRight && "border-success bg-success-soft",
                    answered && !isRight && "border-danger bg-danger-soft",
                    (answered || busy) && "cursor-default",
                  )}
                >
                  <span className="block">{question.prompt}</span>
                  {chosen ? (
                    <span
                      className={cn(
                        "mt-1 block text-xs",
                        answered && isRight
                          ? "text-success"
                          : answered
                            ? "text-danger-fg"
                            : "text-ink-subtle",
                      )}
                    >
                      {answered && !isRight
                        ? `You paired this with “${chosen}”. Correct: “${question.correct}”.`
                        : `Paired with “${chosen}”.`}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <ul className="flex flex-col gap-2">
          {pool.map((option) => {
            const used = takenAnswers.has(option);

            return (
              <li key={option}>
                <button
                  type="button"
                  disabled={answered || busy || used || selected === null}
                  onClick={() => chooseAnswer(option)}
                  className={cn(
                    "w-full rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors",
                    selected === null
                      ? "cursor-default border-line text-ink-subtle"
                      : "cursor-pointer border-line-strong bg-surface hover:border-accent hover:bg-accent-soft",
                    used && "border-line bg-surface-2 text-ink-subtle",
                    (answered || busy) && "cursor-default",
                  )}
                >
                  {option}
                  {used ? <span className="sr-only"> — already paired</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {answered ? null : (
        <button
          type="button"
          disabled={busy || placed < questions.length}
          onClick={() => onSubmit(pairings)}
          className={cn(
            "inline-flex h-10 items-center justify-center self-start rounded-md px-4 font-medium transition-colors",
            placed < questions.length
              ? "cursor-not-allowed bg-surface-2 text-ink-subtle"
              : "cursor-pointer bg-accent text-accent-ink hover:bg-accent-hover",
          )}
        >
          {placed < questions.length
            ? `Pair all ${questions.length} to check (${placed} done)`
            : "Check answers"}
        </button>
      )}
    </div>
  );
}
