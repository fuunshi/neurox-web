"use client";

import { useState } from "react";
import Link from "next/link";
import { FormBanner } from "@/components/auth/form-banner";
import { Button, buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api/client";
import type { GenerationJob } from "@/lib/api-types";
import { useJobPoll } from "@/lib/hooks/use-job-poll";
import { useSubmit } from "@/lib/hooks/use-submit";

/** A cap, not a target — the API's own maximum is 50. */
const CARD_LIMITS = [10, 25, 50] as const;

export function GenerateForm({
  decks,
  sources,
  preselectSourceId,
}: {
  decks: Array<{ id: string; title: string }>;
  sources: Array<{ id: string; title: string; characters: number }>;
  preselectSourceId?: string;
}) {
  const { pending, error, submit, fieldErrors, setFieldErrors } = useSubmit();
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [sourceId, setSourceId] = useState(
    preselectSourceId && sources.some((s) => s.id === preselectSourceId)
      ? preselectSourceId
      : (sources[0]?.id ?? ""),
  );
  const [maxCards, setMaxCards] = useState<number>(25);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);

  const poll = useJobPoll(jobId, job);
  const current = poll.job ?? job;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!deckId || !sourceId) {
      setFieldErrors({
        deckId: deckId ? "" : "Choose a deck.",
        sourceId: sourceId ? "" : "Choose a source.",
      });
      return;
    }

    const outcome = await submit(() =>
      apiFetch<GenerationJob>(`generation/decks/${deckId}`, {
        method: "POST",
        body: { sourceId, maxCards },
      }),
    );

    if (outcome.ok) {
      setJob(outcome.value);
      setJobId(outcome.value.id);
    }
  }

  // ---------------------------------------------------------------- finished
  if (current && current.status === "SUCCEEDED") {
    return (
      <Panel>
        <PanelBody className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Chip tone={current.cardsCreated > 0 ? "accent" : "due"}>
              {current.status}
            </Chip>
            <p className="font-display text-lg">
              {current.cardsCreated > 0
                ? `${current.cardsCreated} draft card${current.cardsCreated === 1 ? "" : "s"} written`
                : "Nothing worth asking about"}
            </p>
          </div>

          {/* A zero-card result is a legitimate outcome, not an error — the
              heuristic reader only recognises specific shapes of sentence. It is
              explained rather than dressed up as a failure. */}
          <p className="text-ink-muted">
            {current.cardsCreated > 0 ? (
              <>
                They are in the deck as drafts. Read them, fix the wording, and
                accept the ones worth keeping — a generated card is a proposal.
              </>
            ) : (
              <>
                The text was read, but no question could be written from it. This
                reader needs definitions in the form “X is Y”, “X: Y”, or a
                Markdown heading above the sentence that defines it. Prose that
                explains a concept across several sentences needs the Gemini
                generator.
              </>
            )}
          </p>

          <p className="text-sm text-ink-subtle">
            Written by the <strong>{current.provider}</strong> generator
            {current.model ? ` (${current.model})` : ""}. Understood{" "}
            {current.cardsRequested ?? 0} cards at most.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/decks/${current.deckId}`}
              className={buttonStyles()}
            >
              Review the drafts
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setJobId(null);
                setJob(null);
              }}
            >
              Generate again
            </Button>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  if (current && (current.status === "FAILED" || current.status === "CANCELLED")) {
    return (
      <Panel>
        <PanelBody className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Chip tone={current.status === "FAILED" ? "danger" : "neutral"}>
              {current.status}
            </Chip>
            <p className="font-display text-lg">
              {current.status === "FAILED"
                ? "That run did not finish"
                : "That run was cancelled"}
            </p>
          </div>

          {current.error ? (
            <p className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-fg">
              {current.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setJobId(null);
                setJob(null);
              }}
            >
              Try again
            </Button>
            <Link
              href="/sources"
              className={buttonStyles({ variant: "secondary" })}
            >
              Check your sources
            </Link>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  if (current) {
    return (
      <Panel>
        <PanelBody className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Spinner className="size-5 text-accent" />
            <p className="font-display text-lg">
              {current.status === "RUNNING"
                ? "Writing cards"
                : "Waiting to start"}
            </p>
          </div>

          {/* Deliberately no percentage. `cardsCreated` is only written at the
              end, so any progress bar here would be invented. */}
          <p className="text-ink-muted">
            Reading the source a chunk at a time. This takes longer on a large
            document, and longer still with a model behind it.
          </p>

          {current.provider ? (
            <p className="text-sm text-ink-subtle">
              Generator: {current.provider}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={async () => {
                await apiFetch(`generation/jobs/${current.id}/cancel`, {
                  method: "POST",
                }).catch(() => undefined);
              }}
            >
              Stop
            </Button>
            <Link
              href={`/decks/${current.deckId}`}
              className={buttonStyles({ variant: "quiet" })}
            >
              Go to the deck
            </Link>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  // ------------------------------------------------------------------ the form
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FormBanner error={error} />
      {poll.error ? <FormBanner error={poll.error} /> : null}

      <Field label="Deck" required error={fieldErrors.deckId}>
        <Select value={deckId} onChange={(e) => setDeckId(e.target.value)}>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.title}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Source"
        required
        error={fieldErrors.sourceId}
        hint={
          sources.find((s) => s.id === sourceId)?.characters
            ? `${sources.find((s) => s.id === sourceId)?.characters.toLocaleString()} characters will be read`
            : undefined
        }
      >
        <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.title}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Most cards to write"
        hint="An upper bound. A source with little to say produces fewer."
      >
        <Select
          value={String(maxCards)}
          onChange={(e) => setMaxCards(Number(e.target.value))}
        >
          {CARD_LIMITS.map((limit) => (
            <option key={limit} value={limit}>
              {limit}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" loading={pending} className="self-start">
        Draft the cards
      </Button>
    </form>
  );
}
