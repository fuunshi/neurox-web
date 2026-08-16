"use client";

import { cn } from "@/lib/utils/cn";
import type { QuizQuestion } from "@/lib/api-types";

/**
 * One question, four options, pick one.
 *
 * Serves both multiple choice and cloze, because they genuinely are the same
 * interaction: cloze differs only in that its prompt is a sentence with a gap
 * rather than a question. Two components that differed only in a string would
 * be two places for the keyboard handling to drift apart.
 *
 * Options are real `<button>`s in a list, so arrow keys, Enter and Space work
 * without any handling of our own, and a screen reader announces how many
 * there are. A `<div role="radio">` grid would need all of that reimplemented,
 * and the study session's keyboard rules are the only precedent worth copying.
 */
export function OptionQuestion({
  question,
  busy,
  onChoose,
}: {
  question: QuizQuestion;
  busy: boolean;
  onChoose: (chosen: string) => void;
}) {
  const answered = question.correct !== undefined;

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-xl leading-snug text-balance">
        {question.prompt}
      </p>

      <ul className="flex flex-col gap-2">
        {question.options.map((option) => {
          const isChosen = answered && question.chosen === option;
          const isAnswer = answered && question.correct === option;

          return (
            <li key={option}>
              <button
                type="button"
                disabled={answered || busy}
                onClick={() => onChoose(option)}
                className={cn(
                  "w-full cursor-pointer rounded-md border px-4 py-3 text-left text-sm transition-colors",
                  // Once answered, the options stop being controls and become a
                  // record of what happened: the right answer is marked, and so
                  // is the wrong one you picked, if they differ.
                  !answered &&
                    "border-line-strong bg-surface hover:border-accent hover:bg-accent-soft",
                  isAnswer && "border-success bg-success-soft text-ink",
                  isChosen &&
                    !isAnswer &&
                    "border-danger bg-danger-soft text-ink",
                  answered && !isAnswer && !isChosen && "border-line text-ink-subtle",
                  (answered || busy) && "cursor-default",
                )}
              >
                {option}
                {isAnswer ? (
                  <span className="sr-only"> — the correct answer</span>
                ) : null}
                {isChosen && !isAnswer ? (
                  <span className="sr-only"> — your answer, which was wrong</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
