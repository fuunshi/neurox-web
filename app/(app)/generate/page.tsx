import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listDecks, listSources } from "@/lib/server/queries";
import { GenerateForm } from "./generate-form";

export const metadata = { title: "Generate cards" };

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.source;
  const preselect = Array.isArray(raw) ? raw[0] : raw;
  // "Draft more cards" and the deck review screen both link here with a deck,
  // so that a generation lands where the reader was already looking.
  const rawDeck = params.deck;
  const preselectDeck = Array.isArray(rawDeck) ? rawDeck[0] : rawDeck;

  // Two reads rather than three: the viewport also needs decks, and both are
  // cached per request.
  const [{ data: decks }, { data: sources }] = await Promise.all([
    listDecks({ limit: 50 }),
    listSources({ limit: 50 }),
  ]);

  const readySources = sources.filter((source) => source.status === "READY");

  if (decks.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl">Generate cards</h1>
        <EmptyState
          className="mt-6"
          title="You need a deck first"
          description="Generated cards have to land somewhere. A deck holds the cards for one subject."
          action={
            <Link href="/decks" className={buttonStyles()}>
              Go to decks
            </Link>
          }
        />
      </div>
    );
  }

  if (readySources.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl">Generate cards</h1>
        <EmptyState
          className="mt-6"
          title="Nothing to read from yet"
          description="Add a source first — a PDF, a Word document, a Markdown file or a page of pasted notes. Cards are written from its text."
          action={
            <Link href="/sources" className={buttonStyles()}>
              Add a source
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl">Generate cards</h1>
        <p className="mt-1 max-w-prose text-ink-muted">
          Cards arrive as drafts in the deck you choose. Nothing reaches a study
          pile until you accept it.
        </p>
      </div>

      <GenerateForm
        decks={decks.map((deck) => ({ id: deck.id, title: deck.title }))}
        sources={readySources.map((source) => ({
          id: source.id,
          title: source.title,
          characters: source.characterCount ?? 0,
        }))}
        preselectSourceId={preselect}
        preselectDeckId={preselectDeck}
      />
    </div>
  );
}
