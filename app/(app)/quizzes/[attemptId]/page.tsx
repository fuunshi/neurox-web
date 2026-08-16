import { notFound, redirect } from "next/navigation";
import { QuizSession } from "@/components/quiz/quiz-session";
import { ApiError } from "@/lib/errors";
import { getDeck, getQuizAttempt } from "@/lib/server/queries";

export const metadata = { title: "Quiz" };

/**
 * One quiz attempt.
 *
 * Fetched without caching — a quiz is a live thing, and a cached paper would
 * show a reader their answers from before they gave them.
 *
 * A 404 from the API means the attempt is not this reader's, or does not exist;
 * both are the same answer to give, and distinguishing them would confirm the
 * existence of somebody else's quiz.
 */
export default async function QuizAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  let attempt;
  try {
    attempt = await getQuizAttempt(attemptId);
  } catch (error) {
    if (error instanceof ApiError && error.kind === "not_found") notFound();
    throw error;
  }

  // The deck is only needed for its title, and a quiz whose deck has gone is
  // still a quiz — so a missing deck sends the reader to the deck list rather
  // than failing the page.
  let deckTitle = "this deck";
  try {
    const deck = await getDeck(attempt.deckId);
    deckTitle = deck.title;
  } catch (error) {
    if (!(error instanceof ApiError && error.kind === "not_found")) throw error;
    redirect("/quizzes");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <QuizSession
        deckId={attempt.deckId}
        deckTitle={deckTitle}
        initialAttempt={attempt}
      />
    </div>
  );
}
