import Link from "next/link";
import { StatTile } from "@/components/stats/stat-tile";
import { Meter } from "@/components/ui/meter";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonStyles } from "@/components/ui/button";
import type { QuizAnalytics } from "@/lib/api-types";
import { formatCount, formatPercent } from "@/lib/format";
import { QUIZ_FORMAT_INFO } from "@/lib/quiz";

/**
 * A short date in a fixed locale.
 *
 * Deliberately not `formatDate` from `lib/format`: that one renders in the
 * reader's locale, which on a server-rendered list means the server's locale
 * decides the first paint and the browser's decides the second — and the two
 * disagree often enough to be visible. Nothing here needs the reader's idea of
 * a month name badly enough to flicker for it.
 */
function shortDate(iso: string | null): string {
  if (!iso) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * How the reader does on quizzes.
 *
 * Accuracy is shown per format rather than as one figure, because the formats
 * are not the same test: multiple choice gives you four options, a matching
 * board gives you the whole deck's worth, and a reader can be good at one and
 * bad at the other. A single number would hide exactly the thing worth acting
 * on.
 *
 * The bars measure correct answers out of questions asked. `null` from the API
 * means nothing has been asked in that format yet, and it says so in words
 * instead of drawing an empty bar next to a real zero.
 */
export function QuizPerformance({ analytics }: { analytics: QuizAnalytics }) {
  const { totals, byFormat, recent, missed } = analytics;

  if (totals.attempts === 0) {
    return (
      <EmptyState
        title="No quizzes yet"
        description="A quiz asks what you already know without moving your review schedule. Once you finish one, this says how you did and which cards keep catching you."
        action={
          <Link href="/quizzes" className={buttonStyles()}>
            Take a quiz
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
        <StatTile
          value={formatPercent(totals.accuracy)}
          label="answered correctly"
          detail={`${formatCount(totals.correct, "answer")} of ${totals.questions}`}
        />
        <StatTile
          value={totals.attempts}
          label={totals.attempts === 1 ? "quiz finished" : "quizzes finished"}
        />
        <StatTile
          value={missed.length}
          label={missed.length === 1 ? "card keeps catching you" : "cards keep catching you"}
          detail={missed.length === 0 ? "None so far" : undefined}
        />
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-ink">By format</h3>

        <ul className="flex flex-col gap-4">
          {byFormat.map((entry) => {
            const info = QUIZ_FORMAT_INFO.find((item) => item.id === entry.format);

            return (
              <li key={entry.format} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">
                    {info?.label ?? entry.format}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {entry.questions === 0
                      ? "Not tried yet"
                      : `${formatPercent(entry.accuracy)} · ${entry.correct} of ${entry.questions} correct`}
                  </span>
                </div>

                {entry.questions > 0 ? (
                  <Meter
                    value={entry.correct}
                    max={entry.questions}
                    label={`${info?.label ?? entry.format}: ${entry.correct} of ${entry.questions} answered correctly`}
                  />
                ) : (
                  <div className="h-2 w-full rounded-full border border-dashed border-line" />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {recent.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">Recently finished</h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                The most recent finished quizzes, newest first.
              </caption>
              <thead>
                <tr className="border-b border-line-strong text-ink-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Finished
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Deck
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Format
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((attempt) => (
                  <tr key={attempt.id} className="border-b border-line">
                    <td className="py-2 pr-4 whitespace-nowrap text-ink-muted">
                      {shortDate(attempt.finishedAt)}
                    </td>
                    <th scope="row" className="py-2 pr-4 font-normal">
                      <Link
                        href={`/decks/${attempt.deckId}`}
                        className="text-accent hover:underline"
                      >
                        {attempt.deckTitle}
                      </Link>
                    </th>
                    <td className="py-2 pr-4 text-ink-muted">
                      {QUIZ_FORMAT_INFO.find(
                        (item) => item.id === attempt.format,
                      )?.label ?? attempt.format}
                    </td>
                    <td className="py-2 tabular-nums whitespace-nowrap">
                      {attempt.correctCount} of {attempt.questionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {missed.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">Cards you miss</h3>
          <p className="text-sm text-ink-muted">
            A quiz never moves your schedule, so a card here is one to look at
            rather than one the app has already rescheduled.
          </p>

          <ul className="flex flex-col divide-y divide-line">
            {missed.map((card) => (
              <li
                key={card.cardId}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
              >
                <span className="min-w-0 flex-1">{card.front}</span>
                <span className="text-sm text-ink-muted">
                  {formatCount(card.count, "miss")} of {card.asked}
                </span>
                <Link
                  href={`/decks/${card.deckId}`}
                  className="text-sm text-accent hover:underline"
                >
                  {card.deckTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
