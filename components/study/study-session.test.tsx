import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DeckStats,
  FlashCard,
  ReviewResult,
  StudyPool,
} from "@/lib/api-types";

const apiFetch = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { StudySession } from "./study-session";

/**
 * The last grade of a session must be undoable.
 *
 * Grading the final card empties the queue, and the session swaps in its
 * summary — which used to mean the one grade that ended the session was the one
 * grade that could not be taken back. These tests hold that door open.
 */

function card(id: string): FlashCard {
  return {
    id,
    deckId: "deck-1",
    front: `Question ${id}`,
    back: `Answer ${id}`,
    hint: null,
    status: "ACTIVE",
    generationJobId: null,
    dueAt: null,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const stats: DeckStats = {
  total: 1,
  active: 1,
  draft: 0,
  archived: 0,
  due: 1,
  newCards: 1,
  learned: 0,
  learning: 0,
  reviewedInLastDay: 0,
};

function gradeResult(rating: ReviewResult["rating"]): ReviewResult {
  return {
    cardId: "c1",
    rating,
    scheduling: {
      intervalDays: 3,
      dueAt: "2026-01-04T00:00:00.000Z",
      repetitions: 1,
      lapses: 0,
    },
  };
}

function pool(cards: FlashCard[], nextCursor: string | null = null): StudyPool {
  return {
    data: cards,
    pagination: { nextCursor, hasMore: nextCursor !== null, limit: 50 },
    stats,
  };
}

function renderSession(cards: FlashCard[], nextCursor: string | null = null) {
  return render(
    <StudySession
      deckId="deck-1"
      deckTitle="Cardiac physiology"
      pool={pool(cards, nextCursor)}
      include="due"
      initialMode="swipe"
    />,
  );
}

/**
 * Reveal the current card and grade it "Good".
 *
 * The name is exact because two controls say almost the same thing: the card
 * itself carries `aria-label="Show the answer"`, and the button below it reads
 * "Show answer". A fuzzy match finds both.
 */
async function revealAndGrade(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Show answer" }));
  await user.click(screen.getByRole("button", { name: /^Good/ }));
}

describe("StudySession undo", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("offers undo on a mid-session grade", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(gradeResult("GOOD"));

    renderSession([card("c1"), card("c2")]);
    await revealAndGrade(user);

    expect(
      await screen.findByRole("button", { name: "Undo" }),
    ).toBeInTheDocument();
  });

  it("still offers undo after the card that ended the session", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(gradeResult("GOOD"));

    renderSession([card("c1")]);
    await revealAndGrade(user);

    // The summary is up, and the grade that produced it is still reversible.
    expect(await screen.findByText(/session finished/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("returns the card to the session when the final grade is undone", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(gradeResult("GOOD"));

    renderSession([card("c1")]);
    await revealAndGrade(user);
    expect(await screen.findByText(/session finished/i)).toBeInTheDocument();

    apiFetch.mockResolvedValue(undefined);
    await user.click(screen.getByRole("button", { name: "Undo" }));

    // Back to studying, with the card the grade had removed.
    expect(await screen.findByText("Question c1")).toBeInTheDocument();
    expect(screen.queryByText(/session finished/i)).not.toBeInTheDocument();

    const [path, options] = apiFetch.mock.calls[1] as [
      string,
      { method: string },
    ];
    expect(path).toBe("cards/c1/review/undo");
    expect(options.method).toBe("POST");
  });

  it("says what the grade did, so the schedule is not magic", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(gradeResult("GOOD"));

    renderSession([card("c1")]);
    await revealAndGrade(user);

    expect(await screen.findByText(/next review/i)).toBeInTheDocument();
  });
});

describe("StudySession continuation", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("carries on into the next page instead of ending early", async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) =>
      path.includes("/review")
        ? Promise.resolve(gradeResult("GOOD"))
        : Promise.resolve(pool([card("c2")], null)),
    );

    renderSession([card("c1")], "next-page-cursor");
    await revealAndGrade(user);

    // The session did not finish: there were cards after this page.
    expect(await screen.findByText("Question c2")).toBeInTheDocument();
    expect(screen.queryByText(/session finished/i)).not.toBeInTheDocument();

    const paths = apiFetch.mock.calls.map((call) => call[0] as string);
    expect(paths.some((path) => path.includes("cursor=next-page-cursor"))).toBe(
      true,
    );
  });

  it("finishes once the pages are exhausted", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(gradeResult("GOOD"));

    // No cursor: one page was the whole pool.
    renderSession([card("c1")]);
    await revealAndGrade(user);

    expect(await screen.findByText(/session finished/i)).toBeInTheDocument();
  });

  it("ends visibly rather than looping when the next page fails", async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) =>
      path.includes("/review")
        ? Promise.resolve(gradeResult("GOOD"))
        : Promise.reject(new Error("upstream down")),
    );

    renderSession([card("c1")], "next-page-cursor");
    await revealAndGrade(user);

    // It stops, says so, and does not keep asking: a rejected fetch must not
    // leave the session spinning on a cursor it can never advance.
    expect(
      await screen.findByText(/could not be loaded/i),
    ).toBeInTheDocument();

    const poolRequests = apiFetch.mock.calls.filter((call) =>
      String(call[0]).includes("/study"),
    );
    expect(poolRequests).toHaveLength(1);
  });
});
