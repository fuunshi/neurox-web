import Link from "next/link";
import { APP_SECTIONS } from "@/lib/app-nav";
import {
  levelFromXp,
  masteryPercent,
  streakAtRisk,
  xpFromReviews,
} from "@/lib/gamification";
import { formatCount } from "@/lib/format";
import { buttonStyles } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SectionCard } from "@/components/ui/section-card";
import { ForecastChart } from "@/components/stats/forecast-chart";
import { getStudyOverview, getViewer, listDecks, listSources } from "@/lib/server/queries";

export const metadata = { title: "Home" };

/**
 * Where the app opens.
 *
 * This replaces landing on `/decks`, which dropped a first-time reader into a
 * list with no indication that the app also holds sources, generation, quizzes
 * or a knowledge map. The container cards say what each section is *for*; the
 * header says where the reader is in their own material.
 *
 * The rail is deliberately absent here (see `app-shell.tsx`): these cards are
 * the navigation, and repeating the same seven destinations beside them would
 * make the cards look redundant rather than central.
 *
 * Everything on this page is real data. The one figure that is inferred rather
 * than returned outright is XP, and `lib/gamification.ts` is explicit about how
 * it is derived and where it stops being precise.
 */
export default async function HomePage() {
  const [viewer, overview, decks, sources] = await Promise.all([
    getViewer(),
    getStudyOverview(),
    listDecks({ limit: 6 }),
    // A generous page rather than a count, because "how many sources still have
    // no cards" is a question about the whole library and the API has no
    // aggregate for it yet.
    listSources({ limit: 50 }),
  ]);

  const firstName = viewer.firstName?.trim() || viewer.email.split("@")[0];

  const { totals, streak, daily, forecast } = overview;

  // The API returns a continuous run of days ending today, so the last entry is
  // today — measured against the reader's own timezone on the server, which is
  // the only clock that agrees with the streak itself.
  const reviewedToday = daily.at(-1)?.reviews ?? 0;

  const level = levelFromXp(xpFromReviews(totals.reviews));
  const mastery = masteryPercent(totals.learnedCards, totals.activeCards);
  const readySources = sources.data.filter(
    (source) => source.status === "READY",
  );

  const brandNew = decks.data.length === 0 && sources.data.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      {/* ---------------------------------------------------------- the header */}
      <header className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink-subtle">
              {greeting()}, {firstName}
            </p>
            {/*
              The level is the visual headline, but "Level 1" on its own does
              not say what page this is — a screen reader arriving here would
              hear a number and nothing else. The hidden prefix names the page
              without changing what is drawn.
            */}
            <h1 className="mt-1 font-display text-3xl">
              <span className="sr-only">Home — </span>
              Level {level.level}
            </h1>
          </div>

          <div className="flex gap-6">
            <Figure
              value={String(streak.current)}
              label="day streak"
              detail={
                streak.current === 0
                  ? "Study today to start one"
                  : `Best ${streak.longest}`
              }
            />
            <Figure
              value={String(totals.dueNow)}
              label="due now"
              tone={totals.dueNow > 0 ? "due" : "quiet"}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-xs text-ink-subtle">
            <span>
              {level.xpIntoLevel.toLocaleString()} /{" "}
              {level.xpForLevel.toLocaleString()} XP to level {level.level + 1}
            </span>
            <span>{level.xp.toLocaleString()} XP total</span>
          </div>
          <Meter
            value={level.xpIntoLevel}
            max={level.xpForLevel}
            label={`Progress to level ${level.level + 1}`}
          />
        </div>

        {streakAtRisk(streak.current, reviewedToday) ? (
          <p className="rounded-md border border-due/40 bg-due-soft px-3.5 py-2 text-sm text-due-fg">
            Your {streak.current}-day streak has not been added to today. One
            card is enough to keep it.
          </p>
        ) : null}
      </header>

      {/* ------------------------------------------------------ start studying */}
      {/*
        The first thing on the page, because it is the thing to do now. This was
        the first tile of "Check this out" halfway down, which is where a
        suggestion belongs and not where the next action does.

        It links to the deck list rather than into a session, and that is a real
        limitation rather than a choice: study is per-deck, `Deck` carries no due
        count, and there is no endpoint that ranks decks by what is waiting. See
        README, "Not built yet".
      */}
      {!brandNew && totals.dueNow > 0 ? (
        <Panel>
          <PanelBody className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-3xl">
                {formatCount(totals.dueNow, "card")} due now
              </p>
              <p className="mt-1 max-w-prose text-ink-muted">
                These are on the edge of being forgotten. Reviewing them now is
                worth more than reviewing them tomorrow.
              </p>
            </div>
            <Link href="/decks" className={buttonStyles()}>
              Start studying
            </Link>
          </PanelBody>
        </Panel>
      ) : null}

      {/* -------------------------------------------------- what is in the app */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl">Your workspace</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            {brandNew
              ? "Two ways to start: bring in something to read, or write a deck by hand."
              : "Everything the app does, and what each part is for."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {APP_SECTIONS.map((section) => (
            <SectionCard
              key={section.href}
              href={section.href}
              title={section.label}
              description={section.description}
              icon={section.icon}
              meta={metaFor(section.href, { readySources: readySources.length, dueNow: totals.dueNow })}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ check this out */}
      {brandNew ? null : (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl">Check this out</h2>
            <p className="mt-1 max-w-prose text-sm text-ink-muted">
              Suggestions from your own material — nothing here comes from
              anywhere else.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {readySources.length > 0 ? (
              <Suggestion
                title={`${formatCount(readySources.length, "source")} ready to generate`}
                body="Read and extracted, but no cards drafted from them yet."
                href="/generate"
                action="Draft cards"
              />
            ) : null}

            {mastery !== null && totals.activeCards > 0 ? (
              <Suggestion
                title={`${mastery}% of your cards have graduated`}
                body={`${formatCount(totals.learnedCards, "card")} out of ${formatCount(totals.activeCards, "card")} are no longer in relearning.`}
                href="/stats"
                action="See progress"
              />
            ) : null}

            {decks.data.length > 0 ? (
              <Suggestion
                title={`Your most recent deck: ${decks.data[0].title}`}
                body={
                  decks.data[0].cardCount > 0
                    ? `${formatCount(decks.data[0].cardCount, "card")} in it.`
                    : "It has no cards yet."
                }
                href={`/decks/${decks.data[0].id}`}
                action="Open deck"
              />
            ) : null}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- the numbers */}
      {totals.reviews > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl">Coming up</h2>
          <Panel>
            <PanelHeader
              title="The next fortnight"
              description="How many cards fall due each day."
            />
            <PanelBody>
              <ForecastChart days={forecast} />
            </PanelBody>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The figure shown beside a section card, where one exists.
 *
 * Sparse on purpose. A count is only attached where it is genuinely a property
 * of that section — putting "0" beside every card would fill the page with
 * zeroes and teach nothing.
 */
function metaFor(
  href: string,
  counts: { readySources: number; dueNow: number },
): string | undefined {
  if (href === "/generate" && counts.readySources > 0) {
    return `${counts.readySources} ready`;
  }

  if (href === "/stats" && counts.dueNow > 0) {
    return `${counts.dueNow} due`;
  }

  return undefined;
}

function Figure({
  value,
  label,
  detail,
  tone = "accent",
}: {
  value: string;
  label: string;
  detail?: string;
  tone?: "accent" | "due" | "quiet";
}) {
  return (
    <div className="min-w-16">
      <p
        className={
          tone === "due"
            ? "font-display text-3xl text-due-fg"
            : "font-display text-3xl"
        }
      >
        {value}
      </p>
      <p className="text-xs text-ink-muted">{label}</p>
      {detail ? <p className="text-xs text-ink-subtle">{detail}</p> : null}
    </div>
  );
}

/**
 * A suggestion from the reader's own material.
 *
 * Secondary buttons throughout, now that the one primary action on this page is
 * the quick-start block above: two filled buttons competing for the same click
 * is how a page stops having a next step.
 */
function Suggestion({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-lg border border-line bg-surface p-5">
      <div>
        <h3 className="text-base font-medium">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{body}</p>
      </div>
      <Link
        href={href}
        className={buttonStyles({
          variant: "secondary",
          size: "sm",
          className: "self-start",
        })}
      >
        {action}
      </Link>
    </div>
  );
}

/** The reader's own clock, so the greeting agrees with the day they are in. */
function greeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
