import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StudySession } from "@/components/study/study-session";
import type { CursorPage, Deck, FlashCard } from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import {
  DEFAULT_STUDY_MODE,
  isStudyModeId,
  STUDY_MODE_COOKIE,
} from "@/lib/study/modes";
import { getDeck, listCards } from "@/lib/server/queries";

/**
 * Study a deck.
 *
 * Runs over `ACTIVE` cards only — the ones the reader accepted. Drafts are
 * excluded on purpose: a card nobody has reviewed yet is not a card to be tested
 * on.
 */
async function loadStudyCards(deckId: string): Promise<{
  deck: Deck;
  cards: CursorPage<FlashCard>;
}> {
  try {
    const [deck, cards] = await Promise.all([
      getDeck(deckId),
      listCards(deckId, { limit: 50, status: "ACTIVE" }),
    ]);

    return { deck, cards };
  } catch (error) {
    if (error instanceof ApiError && error.kind === "not_found") notFound();
    throw error;
  }
}

export default async function StudyPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const { deck, cards } = await loadStudyCards(deckId);

  // Read here rather than in an effect: the page is dynamic regardless (it needs
  // a session), so the saved mode can be the initial render and there is no
  // frame showing the wrong one.
  const saved = (await cookies()).get(STUDY_MODE_COOKIE)?.value;
  const initialMode = isStudyModeId(saved) ? saved : DEFAULT_STUDY_MODE;

  if (cards.data.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl">Study</h1>
        <EmptyState
          title="Nothing to study in this deck yet"
          description="Only cards you have accepted can be studied. Every card starts as a draft, so open the deck and keep the ones worth remembering."
          action={
            <Link href={`/decks/${deck.id}`} className={buttonStyles()}>
              Review the drafts
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <StudySession
        deckId={deck.id}
        deckTitle={deck.title}
        cards={cards.data}
        initialMode={initialMode}
      />
    </div>
  );
}
