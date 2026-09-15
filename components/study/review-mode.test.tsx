import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FlashCard, ReviewRating } from "@/lib/api-types";
import { ReviewMode, type ReviewModeProps } from "./review-mode";

function card(): FlashCard {
  return {
    id: "c1",
    deckId: "deck-1",
    front: "Question",
    back: "Answer",
    hint: null,
    status: "ACTIVE",
    generationJobId: null,
    dueAt: null,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
  } as FlashCard;
}

function renderReview(overrides: Partial<ReviewModeProps> = {}) {
  const onGrade = vi.fn<(rating: ReviewRating) => void>();
  const onReveal = vi.fn();

  render(
    <ReviewMode
      card={card()}
      revealed
      onReveal={onReveal}
      onGrade={onGrade}
      onSkip={() => {}}
      busy={false}
      done={0}
      total={4}
      pendingRating={null}
      {...overrides}
    />,
  );

  // The card itself, matched loosely on the label — "Show the answer" until it
  // is revealed and "Hide the answer" after. The reveal *button* reads "Show
  // answer", without the article, so it does not collide.
  const face = screen.getByRole("button", { name: /the answer$/ });

  return { onGrade, onReveal, face };
}

describe("ReviewMode grading", () => {
  it("offers a control for each of the two grades that carry most reviews", () => {
    renderReview();

    expect(screen.getByRole("button", { name: /^Again/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Good/ })).toBeInTheDocument();
    // Hard and Easy are still on keys 2 and 4 — the point is that a reader is
    // not made to read past four controls to find the two they will use.
    expect(screen.queryByRole("button", { name: /^Hard/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Easy/ })).toBeNull();
  });

  it("offers no grade at all before the answer is showing", () => {
    // Not a disabled button and not an ignored gesture: the controls are not
    // there, which is a plainer way of refusing to grade an unchecked card.
    renderReview({ revealed: false });

    expect(screen.queryByRole("button", { name: /^Again/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Good/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Show answer" })).toBeInTheDocument();
  });

  it("grades Good from its button", async () => {
    const user = userEvent.setup();
    const { onGrade } = renderReview();

    await user.click(screen.getByRole("button", { name: /^Good/ }));

    expect(onGrade).toHaveBeenCalledExactlyOnceWith("GOOD");
  });

  it("grades Again from its button", async () => {
    const user = userEvent.setup();
    const { onGrade } = renderReview();

    await user.click(screen.getByRole("button", { name: /^Again/ }));

    expect(onGrade).toHaveBeenCalledExactlyOnceWith("AGAIN");
  });

  it("reveals from the card as well as from the button", async () => {
    const user = userEvent.setup();
    const { onReveal, face } = renderReview({ revealed: false });

    await user.click(face);

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("has no gesture left to get wrong", () => {
    // The whole class of bug this replaced: a drag could record nothing on a
    // fast flick, or record a grade on a cancelled pointer. There is no pointer
    // handling to assert about, which is the point — so this asserts the
    // replacement is a plain button with no drag wiring.
    const { face } = renderReview();

    expect(face.tagName).toBe("BUTTON");
    expect(face).not.toHaveAttribute("draggable");
    expect(face.style.getPropertyValue("touch-action")).toBe("");
  });

  it("holds the grade while it is being saved", () => {
    // The acknowledgement, and the part that survives reduced motion: the wash
    // is a class, so the meaning does not depend on the animation running.
    const { face } = renderReview({ pendingRating: "GOOD", busy: true });

    expect(face.className).toContain("bg-success-soft");
    expect(face.className).toContain("animate-card-exit");
  });

  // Again and Easy travel furthest, Hard and Good half as far toward the same
  // side — the 1–4 order, so keyboard grading is not a quieter language. One
  // render per case, since a test that mounted four cards would be querying
  // against four answers.
  it.each<[ReviewRating, string]>([
    ["AGAIN", "-110%"],
    ["HARD", "-52%"],
    ["GOOD", "52%"],
    ["EASY", "110%"],
  ])("sends a %s card %.0f of the way out", (rating, x) => {
    const { face } = renderReview({ pendingRating: rating });

    expect(face.style.getPropertyValue("--nx-exit-x")).toBe(x);
  });

  it("treats only Again as a failure, and never uses amber", () => {
    // Hard, Good and Easy all mean the card was recalled; they differ in when
    // it comes back, not in whether it was known. Amber means "needs your
    // attention" everywhere in this product, and a card just answered is not
    // asking for anything.
    const { face } = renderReview({ pendingRating: "AGAIN" });

    expect(face.className).toContain("bg-danger-soft");
    expect(face.className).not.toContain("due");
  });

  it("marks a recalled card in the success tone", () => {
    const { face } = renderReview({ pendingRating: "HARD" });

    expect(face.className).toContain("bg-success-soft");
    expect(face.className).not.toContain("due");
  });

  it("names the grade it is saving, including the one with no button", () => {
    // A reader pressing 2 or 4 needs to see which they pressed just as much as
    // one using the buttons.
    renderReview({ pendingRating: "HARD", busy: true });

    expect(screen.getByText("Hard")).toBeInTheDocument();
  });

  it("takes no new grade while one is in flight", async () => {
    const user = userEvent.setup();
    const { onGrade } = renderReview({ pendingRating: "GOOD", busy: true });

    await user.click(screen.getByRole("button", { name: /^Again/ }));

    expect(onGrade).not.toHaveBeenCalled();
  });
});
