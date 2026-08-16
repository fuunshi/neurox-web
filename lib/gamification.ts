/**
 * Levels, derived from the review log.
 *
 * **Derived, not stored.** Every figure here is a pure function of data the
 * overview already returns, so there is no points ledger that can drift from
 * the reviews it claims to describe and no migration to add one. If the numbers
 * look wrong, the log is the only place to look — which is the property that
 * makes a progress figure trustworthy.
 *
 * The honest limitation: XP is currently per *review recorded*, because that is
 * the only figure `StudyOverview.totals` exposes. A rating-weighted model —
 * where recalling a card you were about to forget is worth more than an easy
 * one — needs the per-rating counts that the backend does not return yet. When
 * it does, `XP_PER_REVIEW` becomes a lookup and nothing else here changes.
 */

/** XP awarded per recorded review. */
export const XP_PER_REVIEW = 10;

/**
 * XP needed to *advance from* `level` to the next one.
 *
 * Linear in the level, which makes cumulative XP quadratic — so early levels
 * come quickly and later ones take real work. That shape is deliberate: a flat
 * curve makes the number meaningless after a month, and a steeper one makes the
 * second level feel unreachable.
 */
export function xpToAdvanceFrom(level: number): number {
  return 100 * level;
}

export interface Level {
  /** 1-based. There is no level 0 — a new account is level 1 with no XP. */
  level: number;
  /** Total XP earned. */
  xp: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP the current level needs in total to advance. */
  xpForLevel: number;
}

/**
 * The level a given XP total corresponds to.
 *
 * Walks rather than solving the quadratic, because the loop is bounded by the
 * number of levels a real account can reach and reading it is trivial; the
 * closed form is an optimisation nobody needs and a place for an off-by-one to
 * hide. The cap stops a pathological total from spinning.
 */
export function levelFromXp(xp: number): Level {
  const safeXp = Math.max(0, Math.floor(xp));

  let level = 1;
  let remaining = safeXp;

  // A guard rather than a real limit: with the curve above, level 100 is
  // 495,000 XP, which is roughly half a million reviews.
  while (level < 100 && remaining >= xpToAdvanceFrom(level)) {
    remaining -= xpToAdvanceFrom(level);
    level += 1;
  }

  return {
    level,
    xp: safeXp,
    xpIntoLevel: remaining,
    xpForLevel: xpToAdvanceFrom(level),
  };
}

/** Total XP from a number of recorded reviews. */
export function xpFromReviews(reviews: number): number {
  return Math.max(0, reviews) * XP_PER_REVIEW;
}

/**
 * How far through the material a reader is, as a percentage.
 *
 * "Learned" is the backend's own notion — a card that has graduated out of
 * relearning — so this is a ratio of two figures the API already agrees on,
 * rather than a second definition that could disagree with the deck pages.
 *
 * Returns null rather than zero when there is nothing to divide by. Zero would
 * read as "you have learned nothing", which is a different and much worse claim
 * than "there is no material yet" — the same reasoning `retentionRate` uses on
 * the backend.
 */
export function masteryPercent(
  learnedCards: number,
  activeCards: number,
): number | null {
  if (activeCards <= 0) return null;

  // Clamped rather than trusted. Learned exceeding active would mean the
  // backend's two counts disagree, and rendering "140% mastered" is a worse way
  // to discover that than showing a full bar.
  const percent = Math.round((learnedCards / activeCards) * 100);
  return Math.min(100, Math.max(0, percent));
}

/**
 * Whether a streak is at risk today.
 *
 * A streak is built by reviewing on consecutive days, so "at risk" is a streak
 * that exists and has not been added to today. Deliberately not computed from
 * the clock: the backend owns the day boundary via the reader's profile
 * timezone, and a client that disagreed with it by an hour would nag someone
 * who had already studied.
 */
export function streakAtRisk(currentStreak: number, reviewedToday: number): boolean {
  return currentStreak > 0 && reviewedToday === 0;
}
