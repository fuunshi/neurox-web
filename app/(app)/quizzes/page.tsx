import Link from "next/link";
import { QuizPicker } from "./quiz-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { buttonStyles } from "@/components/ui/button";
import { listDecks, listQuizAttempts } from "@/lib/server/queries";
import { quizFormatLabel } from "@/lib/quiz";

export const metadata = { title: "Quizzes" };

/**
 * Quizzes.
 *
 * The page leads with the one thing a reader needs to know before trusting a
 * score from here: nothing on it touches their review schedule. That is not a
 * footnote — it is the reason this section exists separately from study, and a
 * reader who assumed otherwise would avoid quizzing themselves for fear of
 * damaging their intervals.
 */
export default async function QuizzesPage() {
  const [decks, attempts] = await Promise.all([
    listDecks({ limit: 50 }),
    listQuizAttempts(8),
  ]);

  /*
   * Two cards, not one. Every format needs at least a second card to build a
   * question from — multiple choice and cloze need something to offer as a
   * wrong answer, and matching needs something to pair with. Offering a
   * one-card deck would mean the reader picks it, presses start, and gets a
   * refusal, which is a worse way to learn the rule than not being offered it.
   */
  const quizzable = decks.data.filter((deck) => deck.cardCount >= 2);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl">Quizzes</h1>
        <p className="mt-1 max-w-prose text-ink-muted">
          Find out what you actually know. A quiz never moves a card&apos;s
          schedule — only grading yourself in study does that, because a guess
          between four options should not decide when you see something again.
        </p>
      </div>

      {quizzable.length === 0 ? (
        <EmptyState
          title="Nothing to quiz yet"
          description="A quiz is built from the cards in a deck, and needs at least two: every format has to offer you a wrong answer or something to pair with. Add some cards by hand, or generate them from a source."
          action={
            <Link href="/decks" className={buttonStyles({ size: "sm" })}>
              Go to decks
            </Link>
          }
        />
      ) : (
        <QuizPicker
          decks={quizzable.map((deck) => ({
            id: deck.id,
            title: deck.title,
            cardCount: deck.cardCount,
          }))}
        />
      )}

      {attempts.data.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Recent quizzes"
            description="Newest first. Scores are your own record, not a target."
          />
          <PanelBody>
            <ul className="flex flex-col gap-2">
              {attempts.data.map((attempt) => (
                <li key={attempt.id}>
                  <Link
                    href={`/quizzes/${attempt.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-line px-3.5 py-2.5 text-sm transition-colors hover:border-line-strong hover:bg-surface-2"
                  >
                    <span>
                      <span className="font-medium">{attempt.deckTitle}</span>
                      <span className="ml-2 text-ink-subtle">
                        {quizFormatLabel(attempt.format)}
                      </span>
                    </span>
                    <span className="text-ink-muted">
                      {attempt.status === "COMPLETED"
                        ? `${attempt.correctCount} / ${attempt.questionCount}`
                        : `${attempt.correctCount} / ${attempt.questionCount} so far`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
