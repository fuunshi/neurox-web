"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { QuizAttempt, QuizFormat } from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import { QUIZ_FORMAT_INFO } from "@/lib/quiz";
import { cn } from "@/lib/utils/cn";

/**
 * Choose a deck and a format, and start.
 *
 * Radio groups rather than dropdowns, for both choices. Three formats is
 * exactly what a radio group is for — every option visible, one keystroke
 * between them — and the deck list is the same control the theme and study-mode
 * switchers already use, so this is the app's existing vocabulary rather than a
 * fourth kind of picker.
 */
export function QuizPicker({
  decks,
}: {
  decks: { id: string; title: string; cardCount: number }[];
}) {
  const router = useRouter();
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [format, setFormat] = useState<QuizFormat>("MULTIPLE_CHOICE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function start() {
    setBusy(true);
    setError(null);

    try {
      const attempt = await apiFetch<QuizAttempt>(`quizzes/decks/${deckId}`, {
        method: "POST",
        body: { format },
      });

      router.push(`/quizzes/${attempt.id}`);
    } catch (thrown) {
      setError(
        thrown instanceof ApiError
          ? thrown
          : new ApiError({
              kind: "unknown",
              messages: ["That quiz could not be started."],
            }),
      );
      setBusy(false);
    }
  }

  const selectedDeck = decks.find((deck) => deck.id === deckId);

  return (
    <div className="flex flex-col gap-6">
      <FormBanner error={error} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Which deck?</legend>

        <ul className="flex flex-col gap-2">
          {decks.map((deck) => (
            <li key={deck.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm transition-colors",
                  deck.id === deckId
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="deck"
                    value={deck.id}
                    checked={deck.id === deckId}
                    onChange={() => setDeckId(deck.id)}
                    className="accent-accent"
                  />
                  {deck.title}
                </span>
                <span className="shrink-0 text-xs text-ink-subtle">
                  {formatCount(deck.cardCount, "card")}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">How should it ask?</legend>

        <ul className="flex flex-col gap-2">
          {QUIZ_FORMAT_INFO.map((info) => (
            <li key={info.id}>
              <label
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-md border px-4 py-3 transition-colors",
                  info.id === format
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <input
                    type="radio"
                    name="format"
                    value={info.id}
                    checked={info.id === format}
                    onChange={() => setFormat(info.id)}
                    className="accent-accent"
                  />
                  {info.label}
                </span>
                <span className="pl-6 text-sm text-ink-muted">
                  {info.description}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={start} loading={busy} disabled={!deckId}>
          Start the quiz
        </Button>
        <p className="text-sm text-ink-subtle">
          {selectedDeck && selectedDeck.cardCount < 2
            ? "This deck needs at least two cards before it can be quizzed."
            : "Nothing here changes your review schedule."}
        </p>
      </div>
    </div>
  );
}
