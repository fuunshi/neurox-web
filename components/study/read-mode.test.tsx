import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FlashCard } from "@/lib/api-types";
import { ReadMode } from "./read-mode";

function card(n: number): FlashCard {
  return {
    id: `card-${n}`,
    deckId: "deck-1",
    front: `Question ${n}`,
    back: `Answer ${n}`,
    hint: `Hint ${n}`,
    status: "ACTIVE",
    generationJobId: null,
    dueAt: null,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
  } as FlashCard;
}

function cards(count: number): FlashCard[] {
  return Array.from({ length: count }, (_, i) => card(i + 1));
}

const noPagination = {
  hasMore: false,
  loadingMore: false,
  onLoadMore: () => {},
};

describe("ReadMode", () => {
  it("shows the answer without the reader asking for it", () => {
    // The whole point of the mode: no reveal, no click.
    render(<ReadMode cards={[card(1)]} {...noPagination} />);

    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("Answer 1")).toBeInTheDocument();
  });

  it("offers nothing that would record a review", () => {
    // Read never grades, so no grade control may appear — a reader who spent an
    // hour here must not find an answer was silently recorded.
    render(<ReadMode cards={[card(1)]} {...noPagination} />);

    for (const label of ["Again", "Hard", "Good", "Easy", "Show answer"]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("keeps the hint out, which is a choice and not an oversight", () => {
    // A hint is a nudge toward recall, and Read is the mode that gave recall up.
    render(<ReadMode cards={[card(1)]} {...noPagination} />);

    expect(screen.queryByText(/Hint 1/)).toBeNull();
  });

  it("starts with a window rather than the whole deck", () => {
    // Five hundred cards in the DOM at once is a document nobody scrolls.
    render(<ReadMode cards={cards(30)} {...noPagination} />);

    expect(screen.getByText("Question 20")).toBeInTheDocument();
    expect(screen.queryByText("Question 21")).toBeNull();
  });

  it("grows the window from what it already holds before asking the network", () => {
    const onLoadMore = vi.fn();

    render(<ReadMode cards={cards(30)} {...noPagination} onLoadMore={onLoadMore} />);

    // 30 are loaded but only 20 shown, so the next twenty come from memory.
    return userEvent
      .click(screen.getByRole("button", { name: /load more/i }))
      .then(() => {
        expect(onLoadMore).not.toHaveBeenCalled();
        expect(screen.getByText("Question 30")).toBeInTheDocument();
      });
  });

  it("reaches for the next page once the loaded cards run out", async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();

    render(
      <ReadMode
        cards={cards(20)}
        hasMore
        loadingMore={false}
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: /load more/i }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("says on the screen that reading does not grade", () => {
    render(<ReadMode cards={[card(1)]} {...noPagination} />);

    expect(screen.getByText(/does not grade anything/i)).toBeInTheDocument();
  });
});
