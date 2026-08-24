"use client";

import { useState } from "react";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { FlashCard } from "@/lib/api-types";
import { useSubmit } from "@/lib/hooks/use-submit";

/**
 * Write a card by hand.
 *
 * Hand-written cards land as drafts, exactly as generated ones do, and for the
 * same reason: nothing reaches the study queue without being looked at once.
 *
 * Inline rather than in a modal, matching `NewDeck` — two fields and an optional
 * third do not deserve a dialog, and the expanded form is where the reader is
 * already looking.
 */
export function NewCard({
  deckId,
  onCreated,
  trigger = "Add a card",
}: {
  deckId: string;
  onCreated: (card: FlashCard) => void;
  trigger?: string;
}) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [hint, setHint] = useState("");
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();

  function close() {
    setOpen(false);
    setFront("");
    setBack("");
    setHint("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Both sides are checked here rather than one at a time: an empty answer
    // side is not a smaller mistake than an empty question side.
    const missing: Record<string, string> = {};
    if (!front.trim()) missing.front = "Write the question side.";
    if (!back.trim()) missing.back = "Write the answer side.";

    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }

    const outcome = await submit(() =>
      apiFetch<FlashCard>(`decks/${deckId}/cards`, {
        method: "POST",
        body: {
          front: front.trim(),
          back: back.trim(),
          // Omitted rather than sent empty, so the API stores null and the card
          // renders without a hint line at all.
          hint: hint.trim() || undefined,
        },
      }),
    );

    if (outcome.ok) {
      onCreated(outcome.value);
      close();
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      noValidate
    >
      <FormBanner error={error} />

      <Field label="Question" required error={fieldErrors.front}>
        <Textarea
          rows={2}
          value={front}
          onChange={(event) => setFront(event.target.value)}
          maxLength={5000}
          placeholder="What does the mitral valve do?"
          autoFocus
          required
        />
      </Field>

      <Field label="Answer" required error={fieldErrors.back}>
        <Textarea
          rows={2}
          value={back}
          onChange={(event) => setBack(event.target.value)}
          maxLength={5000}
          placeholder="Separates the left atrium from the left ventricle."
          required
        />
      </Field>

      <Field
        label="Hint"
        hint="Shown alongside the question, before you answer."
        error={fieldErrors.hint}
      >
        <Input
          value={hint}
          onChange={(event) => setHint(event.target.value)}
          maxLength={2000}
          placeholder="Between the two left chambers"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Add card
        </Button>
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
