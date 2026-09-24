import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { listDecks } from "@/lib/server/queries";

export const metadata = { title: "Decks" };

export default async function DecksPage() {
  const { data: decks } = await listDecks();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Decks</h1>
          <p className="mt-1 text-ink-muted">
            Each deck holds the cards for one subject.
          </p>
        </div>
        <Link href="/generate" className={buttonStyles()}>
          Generate cards
        </Link>
      </div>

      {decks.length === 0 ? (
        <EmptyState
          title="No decks yet"
          description="Bring a PDF, a Word document or a page of notes and neurox will draft cards from it. You keep the ones worth keeping."
          action={
            <Link href="/sources" className={buttonStyles()}>
              Add your first source
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link
                href={`/decks/${deck.id}`}
                className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
              >
                <span className="font-display text-lg">{deck.title}</span>
                {deck.description ? (
                  <span className="line-clamp-2 text-sm text-ink-muted">
                    {deck.description}
                  </span>
                ) : null}
                <span className="mt-auto pt-2">
                  <Chip tone={deck.cardCount === 0 ? "due" : "neutral"}>
                    {deck.cardCount === 0
                      ? "No cards"
                      : `${deck.cardCount} card${deck.cardCount === 1 ? "" : "s"}`}
                  </Chip>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
