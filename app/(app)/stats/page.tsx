import Link from "next/link";
import { Leeches } from "@/components/analytics/leeches";
import { QuizPerformance } from "@/components/analytics/quiz-performance";
import { RatingMix } from "@/components/analytics/rating-mix";
import { WhenYouStudy } from "@/components/analytics/when-you-study";
import { buttonStyles } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { ActivityChart } from "@/components/stats/activity-chart";
import { ForecastChart } from "@/components/stats/forecast-chart";
import { StatTile } from "@/components/stats/stat-tile";
import { formatCount, formatPercent } from "@/lib/format";
import {
  getQuizAnalytics,
  getReviewAnalytics,
  getStudyOverview,
} from "@/lib/server/queries";

export const metadata = { title: "Progress" };

export default async function StatsPage() {
  // Three separate reads rather than one composite endpoint: the overview is
  // about the schedule, the other two about the history, and each is cached
  // and throttled on its own. They go out together, so the page waits once.
  const [overview, reviews, quizzes] = await Promise.all([
    getStudyOverview(),
    getReviewAnalytics(),
    getQuizAnalytics(),
  ]);

  const { totals, streak, daily, forecast, timezone } = overview;

  const nothingYet = totals.reviews === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Progress</h1>
          <p className="mt-1 max-w-prose text-ink-muted">
            What you have done, and what is coming. Days are counted in{" "}
            {timezone.replace(/_/g, " ")} — the timezone on your profile, so a
            streak does not reset at somebody else&rsquo;s midnight.
          </p>
        </div>

        {totals.dueNow > 0 ? (
          <Link href="/decks" className={buttonStyles()}>
            Study {totals.dueNow} due
          </Link>
        ) : null}
      </div>

      {nothingYet ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-muted">
          Nothing studied yet. Once you grade a few cards, this page fills in —
          the numbers come from every review, so they are a record rather than an
          estimate.
        </p>
      ) : null}

      {/* The streak is the one figure worth emphasis; the rest are quieter, so
          there is a single thing to look at first. */}
      <Panel>
        <PanelBody className="flex flex-wrap items-end gap-x-12 gap-y-8">
          <StatTile
            value={streak.current}
            label="day streak"
            detail={
              streak.longest > streak.current
                ? `Longest: ${formatCount(streak.longest, "day")}`
                : "Your longest run so far"
            }
            className="min-w-40"
          />

          <StatTile
            value={formatPercent(totals.retention)}
            label="recalled"
            detail={
              totals.retention === null
                ? "Nothing graded yet"
                : "Of reviews in the last 30 days"
            }
          />

          <StatTile
            value={totals.learnedCards}
            label="cards learned"
            detail={`${formatCount(totals.activeCards, "active card")} in total`}
          />

          <StatTile
            value={totals.reviews}
            label="reviews recorded"
            detail="All time"
          />
        </PanelBody>
      </Panel>

      {/* Worth stating plainly, and worth stating here rather than at the foot
          of the page: it explains the "recalled" figure directly above it. */}
      <p className="text-sm text-ink-subtle">
        Retention counts a review as recalled unless you graded it Again. It is
        measured over the same 30 days the chart below shows, so the figure and
        the bars can never disagree.
      </p>

      <Panel>
        <PanelHeader
          title="Review activity"
          description="The last 30 days. Bars are reviews, split into what you recalled and what you did not."
        />
        <PanelBody>
          <ActivityChart days={daily} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Coming up"
          description="When your cards are next due, so a heavy day is visible before it arrives."
        />
        <PanelBody>
          <ForecastChart days={forecast} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="How you study"
          description={`The last ${reviews.windowDays} days, by weekday and hour — bucketed in ${reviews.timezone.replace(/_/g, " ")}, the timezone on your profile rather than the server's clock.`}
        />
        <PanelBody className="flex flex-col gap-6">
          <WhenYouStudy analytics={reviews} />
          <RatingMix ratings={reviews.ratings} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Quizzes"
          description="Quizzes never move your review schedule, so this is what you knew on the day — separate from the streak above."
        />
        <PanelBody>
          <QuizPerformance analytics={quizzes} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Cards you keep forgetting"
          description="Failed repeatedly in review. These are the ones worth rewriting rather than repeating."
        />
        <PanelBody>
          <Leeches analytics={reviews} />
        </PanelBody>
      </Panel>
    </div>
  );
}
