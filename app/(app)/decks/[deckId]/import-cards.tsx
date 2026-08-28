"use client";

import { useState } from "react";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import type { FlashCard, ImportCardsResult, ImportFormat } from "@/lib/api-types";
import { useSubmit } from "@/lib/hooks/use-submit";

/** Mirrors the API's own ceiling. A larger file is refused rather than quietly
 *  cut short — an import that silently stopped partway would leave the reader
 *  believing a deck was complete when it was not. */
const MAX_IMPORT_BYTES = 2_000_000;

/** The file types this reads. Tab-separated is what Anki exports, which is the
 *  main reason to import rather than retype. */
const ACCEPTED = [".csv", ".tsv", ".txt"];

function formatFor(fileName: string): ImportFormat | undefined {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tsv") || lower.endsWith(".txt")) return "tsv";
  if (lower.endsWith(".csv")) return "csv";
  // Unknown extension: let the API sniff the delimiter from the header.
  return undefined;
}

/**
 * Bring cards in from a spreadsheet.
 *
 * The inverse of the export on the deck page, and deliberately the same shape:
 * the columns it reads are the columns the export writes, so a deck exported as
 * CSV and imported into another deck comes back with its questions, answers,
 * hints and scheduling intact.
 *
 * It reports what it did. "Added 12" alone hides the interesting case — the
 * three rows that were skipped because one column was empty.
 */
export function ImportCards({
  deckId,
  onImported,
}: {
  deckId: string;
  onImported: (cards: FlashCard[]) => void;
}) {
  const [open, setOpen] = useState(false);
  /**
   * Bumped to remount the file input, which clears its selection.
   *
   * Setting `.value = ""` would need a ref, and the shared `Input` takes none —
   * widening it for this one caller would be the tail wagging the dog.
   * Remounting clears the chooser just as well, and the new element still sits
   * inside `Field`, so it stays labelled.
   */
  const [inputKey, setInputKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportCardsResult | null>(null);
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();

  function close() {
    setOpen(false);
    setFile(null);
    setResult(null);
    setInputKey((key) => key + 1);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!file) {
      setFieldErrors({ file: "Choose a file first." });
      return;
    }

    if (file.size > MAX_IMPORT_BYTES) {
      setFieldErrors({
        file: `That file is ${(file.size / 1_000_000).toFixed(1)} MB. The limit is 2 MB — split it and import the parts.`,
      });
      return;
    }

    // Read here rather than sending the file: the API takes the text, which
    // keeps this a plain JSON request and means the parsing rules live in one
    // place on the server.
    const content = await file.text();

    const outcome = await submit(() =>
      apiFetch<ImportCardsResult>(`decks/${deckId}/import`, {
        method: "POST",
        body: { content, format: formatFor(file.name) },
      }),
    );

    if (outcome.ok) {
      setResult(outcome.value);
      onImported(outcome.value.cards);
      setFile(null);
      // Clear the chooser, so importing the same file again is possible.
      setInputKey((key) => key + 1);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Import cards
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

      {result ? (
        <div className="flex flex-col gap-1 rounded-md border border-line bg-surface-2 px-3.5 py-2.5 text-sm">
          <p className="text-ink">
            Added {result.created} {result.created === 1 ? "card" : "cards"}.
            {result.errors.length > 0
              ? ` Skipped ${result.errors.length} ${
                  result.errors.length === 1 ? "row" : "rows"
                }.`
              : ""}
          </p>

          {/* Named rather than counted: "3 rows skipped" without saying which
              leaves the reader to guess what did not make it. */}
          {result.errors.length > 0 ? (
            <ul className="flex flex-col gap-0.5 text-ink-muted">
              {result.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Field
        label="Spreadsheet"
        required
        error={fieldErrors.file}
        hint="CSV or TSV. The columns are the ones the export writes, so an exported deck imports back exactly."
      >
        {/* `Input` rather than a raw `<input>`: it takes the id `Field` mints,
            which is what associates this control with its label. A bare input
            renders visually identically and is unlabelled to a screen reader. */}
        <Input
          key={inputKey}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="block w-full cursor-pointer px-3 py-2 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-sm file:text-accent"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Import
        </Button>
        <Button type="button" variant="secondary" onClick={close}>
          {result ? "Done" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}
