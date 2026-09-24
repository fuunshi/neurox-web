import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StudySession } from "@/components/study/study-session";
import type { Deck, StudyPool } from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import {
  DEFAULT_STUDY_MODE,
  isStudyModeId,
  STUDY_MODE_COOKIE,
} from "@/lib/study/modes";
import { getDeck, getStudyPool } from "@/lib/server/queries";

/**
 * Study a deck.
 *
 * The pool is what is *due* — active cards whose time has come, including ones
 * never reviewed — rather than every active card. That is the whole point of
 * scheduling: a card you saw an hour ago should not be offered again today just
 * because it exists.
 */
async function loadStudy(
  deckId: string,
  include: "due" | "all",
): Promise<{ deck: Deck; pool: StudyPool }> {
  try {
    const [deck, pool] = await Promise.all([
      getDeck(deckId),
      getStudyPool(deckId, { include }),
    ]);

    return { deck, pool };
  } catch (error) {
    if (error instanceof ApiError && error.kind === "not_found") notFound();
    throw error;
  }
}

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { deckId } = await params;
  const query = await searchParams;
  const raw = query.include;
  // Only the one documented value is honoured; anything else falls back to the
  // schedule rather than being forwarded to the API as a 400.
  const include = (Array.isArray(raw) ? raw[0] : raw) === "all" ? "all" : "due";

  const { deck, pool } = await loadStudy(deckId, include);

  // Read here rather than in an effect: the page is dynamic regardless (it needs
  // a session), so the saved mode can be the initial render and there is no
  // frame showing the wrong one.
  const saved = (await cookies()).get(STUDY_MODE_COOKIE)?.value;
  const initialMode = isStudyModeId(saved) ? saved : DEFAULT_STUDY_MODE;

  if (pool.data.length === 0) {
    return (
      <EmptyState
        className="mx-auto w-full max-w-2xl"
        title="Nothing is due"
        description={
          pool.stats.active === 0
            ? "Only cards you have accepted can be studied. Every card starts as a draft, so open the deck and keep the ones worth remembering."
            : `All ${formatCount(pool.stats.active, "active card")} are scheduled for later. That is the schedule working — coming back too soon is how a deck feels like a chore.`
        }
        // A card's next due date is on the deck screen, so the reader can see
        // when "later" actually is rather than being told to trust it.
        action={
          <div className="flex flex-wrap gap-3">
            <Link href={`/decks/${deck.id}`} className={buttonStyles()}>
              {pool.stats.active === 0
                ? "Review the drafts"
                : "Back to the deck"}
            </Link>
            {pool.stats.active > 0 ? (
              <Link
                href={`/decks/${deck.id}/study?include=all`}
                className={buttonStyles({ variant: "secondary" })}
              >
                Study ahead anyway
              </Link>
            ) : null}
          </div>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <StudySession
        deckId={deck.id}
        deckTitle={deck.title}
        cards={pool.data}
        stats={pool.stats}
        initialMode={initialMode}
      />
    </div>
  );
}
