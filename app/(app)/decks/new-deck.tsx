"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { Deck } from "@/lib/api-types";
import { useSubmit } from "@/lib/hooks/use-submit";

/**
 * Create a deck, inline.
 *
 * Shown expanded only once asked for: a deck is created once and used for a long
 * time, so the form does not belong permanently on the page, but neither does it
 * deserve a modal for two fields.
 */
export function NewDeck() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!title.trim()) {
      setFieldErrors({ title: "Give the deck a name." });
      return;
    }

    const outcome = await submit(() =>
      apiFetch<Deck>("decks", {
        method: "POST",
        body: {
          title: title.trim(),
          // Sent as undefined rather than "" so the API sees an absent field.
          description: description.trim() || undefined,
        },
      }),
    );

    if (outcome.ok) {
      setTitle("");
      setDescription("");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>New deck</Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      noValidate
    >
      <FormBanner error={error} />

      <Field label="Deck name" required error={fieldErrors.title}>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Cardiac physiology"
          autoFocus
          required
        />
      </Field>

      <Field label="Description" error={fieldErrors.description}>
        <Textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this deck covers, and where the material came from."
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Create deck
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setDescription("");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
