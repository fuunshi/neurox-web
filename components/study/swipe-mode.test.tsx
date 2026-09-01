import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FlashCard, ReviewRating } from "@/lib/api-types";
import { SwipeMode, type SwipeModeProps } from "./swipe-mode";

/**
 * jsdom implements neither pointer capture nor a usable PointerEvent, and the
 * card uses both. These stubs make a drag expressible; what is under test is the
 * component's handling of one, not the browser's gesture plumbing.
 */
beforeAll(() => {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

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

function renderSwipe(overrides: Partial<SwipeModeProps> = {}) {
  const onGrade = vi.fn<(rating: ReviewRating) => void>();

  render(
    <SwipeMode
      card={card()}
      revealed
      onReveal={() => {}}
      onGrade={onGrade}
      onSkip={() => {}}
      busy={false}
      done={0}
      total={4}
      pendingRating={null}
      {...overrides}
    />,
  );

  // The gesture lives on the wrapper; the button inside it is the card itself.
  // Matched loosely on the label, which is "Show the answer" until it is
  // revealed and "Hide the answer" after.
  const surface = screen
    .getByRole("button", { name: /the answer$/ })
    .parentElement as HTMLElement;

  return { onGrade, surface };
}

/** Drags the card from the centre to `toX` and releases it. */
function drag(surface: HTMLElement, toX: number) {
  fireEvent.pointerDown(surface, { button: 0, clientX: 0, pointerId: 1 });
  fireEvent.pointerMove(surface, { clientX: toX, pointerId: 1 });
  fireEvent.pointerUp(surface, { clientX: toX, pointerId: 1 });
}

describe("SwipeMode grading", () => {
  it("offers only the two grades the gesture can reach", () => {
    renderSwipe();

    // Hard and Easy are still on keys 2 and 4 — the point is that a reader is
    // not made to read past four controls to find the two they will use.
    expect(screen.getByRole("button", { name: /^Again/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Good/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Hard/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Easy/ })).toBeNull();
  });

  it("names the key beside each button, so the other two are still discoverable", () => {
    renderSwipe();

    expect(screen.getByText(/Keys 1–4 grade/)).toBeInTheDocument();
  });

  it("grades Good when the card is thrown right", () => {
    const { onGrade, surface } = renderSwipe();

    drag(surface, 120);

    expect(onGrade).toHaveBeenCalledWith("GOOD");
  });

  it("grades Again when the card is thrown left", () => {
    const { onGrade, surface } = renderSwipe();

    drag(surface, -120);

    expect(onGrade).toHaveBeenCalledWith("AGAIN");
  });

  it("records nothing when the drag does not pass the threshold", () => {
    const { onGrade, surface } = renderSwipe();

    // Short enough to be a shaky hand rather than a decision.
    drag(surface, 30);

    expect(onGrade).not.toHaveBeenCalled();
  });

  it("refuses a drag before the answer is showing", () => {
    const { onGrade, surface } = renderSwipe({ revealed: false });

    drag(surface, 120);

    // Grading a card you have not checked is guessing at your own memory.
    expect(onGrade).not.toHaveBeenCalled();
  });

  it("holds the grade while it is being saved", () => {
    // The acknowledgement, and the part that survives reduced motion: the card
    // takes the colour whether or not the animation runs.
    const { surface } = renderSwipe({ pendingRating: "GOOD", busy: true });
    const cardFace = surface.querySelector("button") as HTMLElement;

    expect(cardFace.className).toContain("animate-card-good");
    expect(cardFace.className).toContain("bg-success-soft");
  });

  it("marks Again in the danger tone rather than amber", () => {
    const { surface } = renderSwipe({ pendingRating: "AGAIN", busy: true });
    const cardFace = surface.querySelector("button") as HTMLElement;

    expect(cardFace.className).toContain("animate-card-again");
    expect(cardFace.className).toContain("bg-danger-soft");
    // Amber means "needs your attention" everywhere in this product, and a card
    // just graded is the opposite of that.
    expect(cardFace.className).not.toContain("due");
  });

  it("takes no new drag while a grade is in flight", () => {
    const { onGrade, surface } = renderSwipe({ pendingRating: "GOOD", busy: true });

    drag(surface, 120);

    expect(onGrade).not.toHaveBeenCalled();
  });
});
