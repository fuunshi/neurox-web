"use client";

import { useState } from "react";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadMore } from "@/components/ui/load-more";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type {
  CardImprovement,
  CardStatus,
  FlashCard,
  GenerationJob,
} from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";

/** Amber for drafts because a draft is something awaiting your attention — the
 *  same meaning amber carries everywhere else in the product. */
const STATUS_TONE: Record<CardStatus, ChipTone> = {
  DRAFT: "due",
  ACTIVE: "accent",
  ARCHIVED: "neutral",
};

const STATUS_LABEL: Record<CardStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

type Filter = "ALL" | CardStatus;

export function CardReview({
  deckId,
  initialCards,
  initialHasMore,
  lastJob,
}: {
  deckId: string;
  initialCards: FlashCard[];
  initialHasMore: boolean;
  lastJob: GenerationJob | null;
}) {
  const [cards, setCards] = useState(initialCards);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loadingMore, setLoadingMore] = useState(false);
  const { pending, error, submit } = useSubmit();

  const visible = cards.filter(
    (card) => filter === "ALL" || card.status === filter,
  );
  const drafts = cards.filter((card) => card.status === "DRAFT").length;

  /**
   * Replaces one card in place, keeping the previous value so a failed request
   * can put it back. Written by hand rather than with a query library: the list
   * comes from the server component, and the only client state that matters is
   * this one array.
   */
  function replaceCard(next: FlashCard, previous: FlashCard) {
    setCards((current) =>
      current.map((card) => (card.id === next.id ? next : card)),
    );

    void (async () => {
      const outcome = await submit(() =>
        apiFetch<FlashCard>(`cards/${next.id}`, {
          method: "PATCH",
          body: {
            front: next.front,
            back: next.back,
            hint: next.hint ?? undefined,
            status: next.status,
          },
        }),
      );

      // Put the original back so the list never disagrees with the server.
      if (!outcome.ok) {
        setCards((current) =>
          current.map((card) => (card.id === previous.id ? previous : card)),
        );
      }
    })();
  }

  async function removeCard(card: FlashCard) {
    const snapshot = cards;
    setCards((current) => current.filter((item) => item.id !== card.id));

    const outcome = await submit(() =>
      apiFetch<void>(`cards/${card.id}`, { method: "DELETE" }),
    );

    if (!outcome.ok) setCards(snapshot);
  }

  async function loadMore() {
    const last = cards[cards.length - 1];
    if (!last) return;

    setLoadingMore(true);
    try {
      const page = await apiFetch<{
        data: FlashCard[];
        pagination: { hasMore: boolean };
      }>(`decks/${deckId}/cards?limit=50&cursor=${encodeURIComponent(last.id)}`);

      setCards((current) => [...current, ...page.data]);
      setHasMore(page.pagination.hasMore);
    } catch {
      // Leaving the button in place is the right recovery: the reader can try
      // again, and nothing has been lost.
    } finally {
      setLoadingMore(false);
    }
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        title="No cards in this deck"
        description="Bring a source and draft cards from it, or add one by hand. Generated cards land here as drafts for you to review."
        action={
          <a
            href={`/generate?deck=${deckId}`}
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 font-medium text-accent-ink hover:bg-accent-hover"
          >
            Draft cards from a source
          </a>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* A finished job that produced nothing is worth saying once, above the
          cards, rather than leaving the reader to wonder where the cards are. */}
      {lastJob?.status === "SUCCEEDED" && lastJob.cardsCreated === 0 ? (
        <FormBanner tone="due">
          The last run read its source but found nothing to ask about. That
          reader needs definitions in the form “X is Y”, “X: Y”, or a Markdown
          heading above the defining sentence.
        </FormBanner>
      ) : null}

      <FormBanner error={error} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {(["ALL", "DRAFT", "ACTIVE", "ARCHIVED"] as const).map((value) => {
            const count =
              value === "ALL"
                ? cards.length
                : cards.filter((card) => card.status === value).length;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={
                  filter === value
                    ? "cursor-pointer rounded-md bg-accent-soft px-3 py-1.5 text-sm text-accent"
                    : "cursor-pointer rounded-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
                }
              >
                {value === "ALL" ? "All" : STATUS_LABEL[value]} ({count}
                {/* Counts come from the cards loaded so far. While more remain
                    unloaded, every one of them is a lower bound, and a bare
                    number would claim to be a total. */}
                {hasMore ? "+" : ""})
              </button>
            );
          })}
        </div>

        {drafts > 0 ? (
          <p className="text-sm text-due-fg">
            {formatCount(drafts, "draft")} awaiting review
          </p>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            busy={pending}
            onSave={replaceCard}
            onDelete={removeCard}
          />
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-ink-muted">
          No {STATUS_LABEL[filter as CardStatus].toLowerCase()} cards.
        </p>
      ) : null}

      <LoadMore
        shown={cards.length}
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        noun="card"
      />
    </div>
  );
}

function CardRow({
  card,
  busy,
  onSave,
  onDelete,
}: {
  card: FlashCard;
  busy: boolean;
  onSave: (next: FlashCard, previous: FlashCard) => void;
  onDelete: (card: FlashCard) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState({
    front: card.front,
    back: card.back,
    hint: card.hint ?? "",
  });

  const [improving, setImproving] = useState(false);
  const [suggestion, setSuggestion] = useState<CardImprovement | null>(null);
  const [improveError, setImproveError] = useState<ApiError | null>(null);

  function commit() {
    const next: FlashCard = {
      ...card,
      front: draft.front.trim(),
      back: draft.back.trim(),
      hint: draft.hint.trim() || null,
    };

    // Refuse an empty side rather than sending it: the API requires both, and a
    // card with no answer is not a card.
    if (!next.front || !next.back) return;

    setEditing(false);
    onSave(next, card);
  }

  /**
   * Asks for a rewrite. The suggestion is only ever a proposal — accepting it
   * goes through the same save path as a hand edit, which is what resets the
   * schedule, so there is one way a card changes rather than two.
   */
  async function requestImprovement() {
    setImproving(true);
    setImproveError(null);

    try {
      const result = await apiFetch<CardImprovement>(
        `cards/${card.id}/improve`,
        { method: "POST" },
      );
      setSuggestion(result);
    } catch (thrown) {
      setImproveError(
        thrown instanceof ApiError
          ? thrown
          : new ApiError({
              kind: "unknown",
              messages: ["That suggestion could not be fetched."],
            }),
      );
    } finally {
      setImproving(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {editing ? (
        <div className="flex flex-col gap-3">
          <Field label="Front" required>
            <Input
              value={draft.front}
              onChange={(e) => setDraft({ ...draft, front: e.target.value })}
            />
          </Field>
          <Field label="Back" required>
            <Textarea
              rows={3}
              value={draft.back}
              onChange={(e) => setDraft({ ...draft, back: e.target.value })}
            />
          </Field>
          <Field label="Hint">
            <Input
              value={draft.hint}
              onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={commit} disabled={busy}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDraft({
                  front: card.front,
                  back: card.back,
                  hint: card.hint ?? "",
                });
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            {/* Also offered here, for any card: editing is exactly when someone
                is already thinking about the wording. */}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || improving}
              onClick={requestImprovement}
            >
              {improving ? "Thinking…" : "Suggest a rewrite"}
            </Button>
          </div>

          {improveError ? <FormBanner error={improveError} /> : null}
        </div>
      ) : suggestion ? (
        /* The proposal, shown against nothing but itself: an accept/discard
           choice with the original behind it would make "keep the old wording"
           the default by inertia, and the reader came here because the old
           wording is not working. */
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">Suggested rewrite.</span>{" "}
            {suggestion.reason}
          </p>

          <div className="flex flex-col gap-2 rounded-md border border-accent/40 bg-accent-soft/50 p-3">
            <p className="font-display text-lg leading-snug">
              {suggestion.front}
            </p>
            <p className="border-t border-accent/25 pt-2 text-ink-muted">
              {suggestion.back}
            </p>
            {suggestion.hint ? (
              <p className="text-sm text-ink-subtle">
                Hint: {suggestion.hint}
              </p>
            ) : null}
          </div>

          <p className="text-xs text-ink-subtle">
            From {suggestion.model}. Accepting it replaces the wording and
            resets this card&rsquo;s schedule, because the intervals were earned
            by recalling the old text.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                onSave(
                  {
                    ...card,
                    front: suggestion.front,
                    back: suggestion.back,
                    hint: suggestion.hint,
                  },
                  card,
                );
                setSuggestion(null);
              }}
            >
              Use this wording
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSuggestion(null)}
            >
              Keep mine
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-lg leading-snug">{card.front}</p>
            <Chip tone={STATUS_TONE[card.status]}>
              {STATUS_LABEL[card.status]}
            </Chip>
          </div>

          <p className="border-t border-line pt-3 text-ink-muted">{card.back}</p>

          {card.hint ? (
            <p className="text-sm text-ink-subtle">Hint: {card.hint}</p>
          ) : null}

          {/* Lapses are worth surfacing here rather than on the study screen:
              a card forgotten three times is usually a card that needs
              rewriting, and this is the screen where rewriting happens. */}
          {/* The rewrite suggestion is offered only where it is the obvious next
              step — a card you keep forgetting — and from edit mode for any
              card. On every card it would be a fifth button in a row of five,
              which is how a useful action becomes wallpaper. */}
          {card.lapses >= 2 ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-due-fg">
                Forgotten {card.lapses} times — the wording may be the problem
                rather than your memory.
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || improving}
                onClick={requestImprovement}
              >
                {improving ? "Thinking…" : "Suggest a rewrite"}
              </Button>
            </div>
          ) : null}

          {improveError ? <FormBanner error={improveError} /> : null}

          <div className="flex flex-wrap items-center gap-2">
            {card.status === "DRAFT" ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onSave({ ...card, status: "ACTIVE" }, card)}
              >
                Keep it
              </Button>
            ) : null}

            {card.status === "ACTIVE" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onSave({ ...card, status: "DRAFT" }, card)}
              >
                Back to drafts
              </Button>
            ) : null}

            {card.status === "ARCHIVED" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onSave({ ...card, status: "ACTIVE" }, card)}
              >
                Restore
              </Button>
            ) : null}

            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>

            {card.status !== "ARCHIVED" ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onSave({ ...card, status: "ARCHIVED" }, card)}
              >
                Archive
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(true)}
              aria-label={`Delete card: ${card.front}`}
            >
              Delete
            </Button>

            {card.generationJobId ? (
              <span className="ml-auto text-xs text-ink-subtle">
                Generated — edit it into shape
              </span>
            ) : null}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this card?"
        description={
          <>
            <span className="font-display">{card.front}</span> will be removed
            from the deck. This cannot be undone from here.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={busy}
        onConfirm={() => {
          setConfirming(false);
          onDelete(card);
        }}
        onCancel={() => setConfirming(false)}
      />
    </li>
  );
}
