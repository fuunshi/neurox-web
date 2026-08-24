"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { Deck } from "@/lib/api-types";
import { useSubmit } from "@/lib/hooks/use-submit";

/**
 * Renaming and deleting a deck.
 *
 * Deliberately not in the header, which already carries the three things a
 * reader does *with* a deck — studying it, adding to it, leaving it. These are
 * things you do to a deck once you are finished with it, so they sit below the
 * export, in the order they become relevant.
 *
 * Rename expands inline for two fields, the same shape `NewDeck` uses. Delete
 * gets a modal and a red button because it is not reversible from the UI: it
 * takes the deck's cards, and their review history, with it.
 */
export function DeckActions({ deck }: { deck: Deck }) {
  const router = useRouter();
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();

  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(deck.title);
  const [description, setDescription] = useState(deck.description ?? "");

  async function onRename(event: React.FormEvent) {
    event.preventDefault();

    if (!title.trim()) {
      setFieldErrors({ title: "Give the deck a name." });
      return;
    }

    const outcome = await submit(() =>
      apiFetch<Deck>(`decks/${deck.id}`, {
        method: "PATCH",
        body: {
          title: title.trim(),
          // Sent as "" rather than undefined when cleared: an absent field means
          // "leave it alone", so omitting it would make the old description
          // impossible to remove.
          description: description.trim(),
        },
      }),
    );

    if (outcome.ok) {
      setRenaming(false);
      router.refresh();
    }
  }

  async function onDelete() {
    const outcome = await submit(() =>
      apiFetch<void>(`decks/${deck.id}`, { method: "DELETE" }),
    );

    if (outcome.ok) {
      // Away rather than refresh: this page's deck no longer exists, so
      // refreshing here would land on a not-found.
      router.push("/decks");
      router.refresh();
    }
  }

  if (renaming) {
    return (
      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 className="text-sm font-medium">Rename this deck</h2>

        <form onSubmit={onRename} className="flex flex-col gap-4" noValidate>
          <FormBanner error={error} />

          <Field label="Deck name" required error={fieldErrors.title}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
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
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                // Put the fields back, so reopening does not show a
                // half-finished edit that was never saved.
                setTitle(deck.title);
                setDescription(deck.description ?? "");
                setRenaming(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <h2 className="text-sm font-medium">Rename or delete this deck</h2>

      <FormBanner error={error} />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setRenaming(true)}>
          Rename
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this deck?"
        description={
          <>
            <strong className="font-medium text-ink">{deck.title}</strong> and
            every card in it will be deleted, along with their review history.
            Exporting first is the only way to keep the cards.
          </>
        }
        confirmLabel="Delete deck"
        destructive
        pending={pending}
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </section>
  );
}
