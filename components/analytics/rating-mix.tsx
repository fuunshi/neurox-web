import type { ReviewAnalytics } from "@/lib/api-types";
import { REVIEW_GRADES } from "@/lib/format";

/**
 * How the reader grades themselves.
 *
 * The names and the one-line meanings come from `REVIEW_GRADES`, which is what
 * the study screen's buttons are built from — a breakdown that called the four
 * grades something else would be describing a different app.
 *
 * No colour coding. Four grades would need four categorical hues, and this app
 * has a validated pair, not a validated four; the counts read fine as numbers
 * and inventing a palette to decorate them would be the wrong trade.
 */
export function RatingMix({
  ratings,
}: {
  ratings: ReviewAnalytics["ratings"];
}) {
  const total = ratings.reduce((sum, entry) => sum + entry.count, 0);

  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <h3 className="text-sm font-medium text-ink">How you grade yourself</h3>

      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        {REVIEW_GRADES.map((grade) => {
          const entry = ratings.find((item) => item.rating === grade.rating);
          const count = entry?.count ?? 0;

          return (
            <div key={grade.rating} className="flex flex-col gap-0.5">
              <dt className="text-sm text-ink-muted" title={grade.hint}>
                {grade.label}
              </dt>
              <dd className="font-display text-xl tabular-nums text-ink">
                {count}
                <span className="ml-2 text-sm font-normal text-ink-subtle">
                  {Math.round((count / total) * 100)}%
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="max-w-prose text-sm text-ink-subtle">
        Grades are in the last 90 days. Again is the only one that costs you the
        session — it brings the card straight back.
      </p>
    </div>
  );
}
