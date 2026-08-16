import {
  levelFromXp,
  masteryPercent,
  streakAtRisk,
  xpFromReviews,
  XP_PER_REVIEW,
} from "./gamification";
import { describe, expect, it } from "vitest";

describe("levelFromXp", () => {
  it("starts a new account at level 1 with nothing earned", () => {
    const level = levelFromXp(0);

    expect(level.level).toBe(1);
    expect(level.xpIntoLevel).toBe(0);
    expect(level.xpForLevel).toBe(100);
  });

  it("advances exactly on the threshold, not one past it", () => {
    // The off-by-one that matters: XP equal to the requirement must advance,
    // and one less must not.
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
  });

  it("reports progress within the current level", () => {
    const level = levelFromXp(150);

    expect(level.level).toBe(2);
    expect(level.xpIntoLevel).toBe(50);
    expect(level.xpForLevel).toBe(200);
  });

  it("gets progressively harder to advance", () => {
    // Linear in the level, so cumulative cost is quadratic — the shape that
    // keeps the number meaningful after the first week.
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(300).level).toBe(3);
    expect(levelFromXp(600).level).toBe(4);
    expect(levelFromXp(1000).level).toBe(5);
  });

  it("treats a negative total as nothing rather than going backwards", () => {
    expect(levelFromXp(-50).level).toBe(1);
    expect(levelFromXp(-50).xp).toBe(0);
  });

  it("never reports more progress than the level requires", () => {
    for (let xp = 0; xp < 5000; xp += 37) {
      const level = levelFromXp(xp);

      expect(level.xpIntoLevel).toBeLessThan(level.xpForLevel);
      expect(level.xpIntoLevel).toBeGreaterThanOrEqual(0);
    }
  });

  it("is monotonic — more XP never means a lower level", () => {
    let previous = 0;

    for (let xp = 0; xp < 5000; xp += 13) {
      const { level } = levelFromXp(xp);

      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});

describe("xpFromReviews", () => {
  it("awards a fixed amount per review", () => {
    expect(xpFromReviews(10)).toBe(10 * XP_PER_REVIEW);
  });

  it("treats a negative count as nothing", () => {
    // The overview's totals come from a count query, but a client-side default
    // of -1 would otherwise produce negative XP and a level below 1.
    expect(xpFromReviews(-5)).toBe(0);
  });
});

describe("masteryPercent", () => {
  it("is the learned share of active cards", () => {
    expect(masteryPercent(25, 100)).toBe(25);
    expect(masteryPercent(1, 3)).toBe(33);
  });

  it("is null rather than zero when there is nothing to measure", () => {
    // Zero would claim the reader has learned nothing, which is a different
    // and much worse statement than "there is no material yet".
    expect(masteryPercent(0, 0)).toBeNull();
    expect(masteryPercent(5, 0)).toBeNull();
  });

  it("caps at 100 when the figures disagree", () => {
    // Guarded rather than assumed: learned exceeding active would be a backend
    // bug, and rendering "140%" is a worse way to find out than clamping.
    expect(masteryPercent(120, 100)).toBe(100);
  });
});

describe("streakAtRisk", () => {
  it("is at risk when a streak exists and today is untouched", () => {
    expect(streakAtRisk(5, 0)).toBe(true);
  });

  it("is not at risk once today has been studied", () => {
    expect(streakAtRisk(5, 12)).toBe(false);
  });

  it("is not at risk when there is no streak to lose", () => {
    expect(streakAtRisk(0, 0)).toBe(false);
  });
});
