import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { ActivityChart } from "@/components/stats/activity-chart";
import { ForecastChart } from "@/components/stats/forecast-chart";
import { StatTile } from "@/components/stats/stat-tile";
import { formatCount } from "@/lib/format";
import { getStudyOverview } from "@/lib/server/queries";

export const metadata = { title: "Progress" };

export default async function StatsPage() {
  const overview = await getStudyOverview();
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
            value={
              totals.retention === null
                ? "—"
                : `${Math.round(totals.retention * 100)}%`
            }
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

      {/* Worth stating plainly, because the numbers invite the question. */}
      <p className="text-sm text-ink-subtle">
        Retention counts a review as recalled unless you graded it Again. It is
        measured over the same 30 days the chart shows, so the figure and the
        bars can never disagree.
      </p>
    </div>
  );
}
