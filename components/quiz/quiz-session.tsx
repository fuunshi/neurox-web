"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FormBanner } from "@/components/auth/form-banner";
import { Button, buttonStyles } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { MatchingBoard } from "./matching-board";
import { OptionQuestion } from "./option-question";
import { apiFetch } from "@/lib/api/client";
import type { QuizAttempt, QuizProgress } from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import { cn } from "@/lib/utils/cn";

/**
 * A quiz in progress.
 *
 * Owns the attempt and the answering, and hands the drawing to a presenter —
 * the same split the study session uses, and for the same reason: a format is
 * how a question is *shown*, and the thing that decides what is right and what
 * happens next should not be reimplemented per format.
 *
 * The attempt holds every question up front, so there is no polling and no
 * next-page fetch. What it does not hold is the answers: the API withholds
 * `correct` until a question has been answered, which is why "have I answered
 * this" is read off the question rather than tracked separately here.
 */
export function QuizSession({
  deckTitle,
  deckId,
  initialAttempt,
}: {
  deckTitle: string;
  deckId: string;
  initialAttempt: QuizAttempt;
}) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Which question is on screen.
   *
   * Tracked rather than derived from "the first unanswered one", because those
   * are different questions and deriving it makes feedback impossible: the
   * moment an answer lands, the first unanswered question becomes the *next*
   * one, and the reader never sees what they got right. Resuming still works —
   * this starts at the first unanswered question.
   */
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      initialAttempt.questions.findIndex((q) => q.correct === undefined),
    ),
  );

  /** The reader has dismissed the last piece of feedback. */
  const [showSummary, setShowSummary] = useState(false);

  const answeredCount = attempt.questions.filter(
    (question) => question.correct !== undefined,
  ).length;

  const allAnswered = answeredCount >= attempt.questionCount;

  const submit = useCallback(
    async (answers: { position: number; chosen: string | null }[]) => {
      setBusy(true);
      setError(null);

      try {
        const progress = await apiFetch<QuizProgress>(
          `quizzes/attempts/${attempt.id}/answers`,
          { method: "POST", body: { answers } },
        );

        // Merge rather than replace: the response reports only what it graded,
        // and the attempt already holds the prompts, options and positions.
        setAttempt((current) => ({
          ...current,
          status: progress.status,
          correctCount: progress.correctCount,
          questions: current.questions.map((question) => {
            const result = progress.results.find(
              (entry) => entry.position === question.position,
            );

            return result
              ? {
                  ...question,
                  correct: result.correct,
                  chosen: result.chosen,
                  wasCorrect: result.wasCorrect,
                }
              : question;
          }),
        }));
      } catch (thrown) {
        setError(
          thrown instanceof ApiError
            ? thrown
            : new ApiError({
                kind: "unknown",
                messages: ["That answer could not be saved."],
              }),
        );
      } finally {
        setBusy(false);
      }
    },
    [attempt.id],
  );

  if (showSummary) {
    return (
      <QuizSummary attempt={attempt} deckId={deckId} deckTitle={deckTitle} />
    );
  }

  const current = attempt.questions[Math.min(index, attempt.questions.length - 1)];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl">Quiz</h1>
          <p className="text-sm text-ink-muted">
            {deckTitle} · {answeredCount} of {attempt.questionCount} answered
            {attempt.correctCount > 0
              ? ` · ${attempt.correctCount} right`
              : ""}
          </p>
        </div>
        <Meter
          value={answeredCount}
          max={attempt.questionCount}
          size="sm"
          label={`Answered ${answeredCount} of ${attempt.questionCount}`}
        />
      </div>

      <FormBanner error={error} />

      {attempt.format === "MATCHING" ? (
        <MatchingBoard
          questions={attempt.questions}
          answered={allAnswered}
          busy={busy}
          onSubmit={(pairings) =>
            void submit(
              attempt.questions.map((question) => ({
                position: question.position,
                chosen: pairings[question.position] ?? null,
              })),
            )
          }
        />
      ) : (
        <>
          <p className="text-xs text-ink-subtle">
            Question {index + 1} of {attempt.questionCount}
          </p>

          <OptionQuestion
            question={current}
            busy={busy}
            onChoose={(chosen) =>
              void submit([{ position: current.position, chosen }])
            }
          />
        </>
      )}

      {/* An explicit next rather than an automatic advance: the feedback is the
          point of answering, and it needs a moment to be read. */}
      {allAnswered ? (
        <Button className="self-start" onClick={() => setShowSummary(true)}>
          See results
        </Button>
      ) : current?.correct !== undefined ? (
        <Button
          className="self-start"
          variant="secondary"
          onClick={() => setIndex((value) => value + 1)}
        >
          Next question
        </Button>
      ) : null}
    </div>
  );
}

function QuizSummary({
  attempt,
  deckId,
  deckTitle,
}: {
  attempt: QuizAttempt;
  deckId: string;
  deckTitle: string;
}) {
  const percent = Math.round(
    (attempt.correctCount / Math.max(1, attempt.questionCount)) * 100,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Quiz finished</h1>
        <p className="mt-1 text-ink-muted">{deckTitle}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="font-display text-3xl">
          {attempt.correctCount} / {attempt.questionCount}
        </p>
        <p className="text-ink-muted">
          {percent === 100
            ? "All of them. That is this deck known, as far as a quiz can tell."
            : percent >= 70
              ? "Mostly there. The ones you missed are below."
              : "Worth going back over — the ones you missed are listed below."}
        </p>

        {/*
          Said plainly because it is the whole reason quizzes are separate from
          study: a reader could reasonably worry that a bad quiz just damaged
          their schedule, and it did not.
        */}
        <p className="text-sm text-ink-subtle">
          Your review schedule is unchanged. Only grading a card in study moves
          it — a guess between four options should not decide when you see
          something again.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Every question</h2>

        <ul className="flex flex-col gap-2">
          {attempt.questions.map((question) => (
            <li
              key={question.position}
              className={cn(
                "rounded-md border px-4 py-3",
                question.wasCorrect
                  ? "border-success bg-success-soft"
                  : "border-danger bg-danger-soft",
              )}
            >
              <p className="text-sm font-medium">{question.prompt}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {question.wasCorrect ? (
                  <>Correct: {question.correct}</>
                ) : (
                  <>
                    You said {question.chosen ? `“${question.chosen}”` : "nothing"}
                    . The answer is “{question.correct}”.
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/quizzes" className={buttonStyles()}>
          Take another quiz
        </Link>
        <Link
          href={`/decks/${deckId}`}
          className={buttonStyles({ variant: "secondary" })}
        >
          Back to the deck
        </Link>
      </div>
    </div>
  );
}
