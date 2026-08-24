import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlashCard, ImportCardsResult } from "@/lib/api-types";

const apiFetch = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { ImportCards } from "./import-cards";

/**
 * Import is the inverse of export, and these tests pin the two things that make
 * it worth having: the file's text is what gets sent (not the file), and what
 * the API reports back is shown rather than swallowed.
 */

function card(id: string): FlashCard {
  return {
    id,
    deckId: "deck-1",
    front: `Question ${id}`,
    back: `Answer ${id}`,
    hint: null,
    status: "DRAFT",
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

function result(overrides: Partial<ImportCardsResult> = {}): ImportCardsResult {
  return {
    created: 2,
    errors: [],
    cards: [card("c1"), card("c2")],
    ...overrides,
  };
}

const CSV = "front,back\nQ one,A one\nQ two,A two\n";

async function importFile(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  content: string,
) {
  await user.click(screen.getByRole("button", { name: "Import cards" }));
  await user.upload(
    screen.getByLabelText(/spreadsheet/i),
    new File([content], name, { type: "text/csv" }),
  );
  await user.click(screen.getByRole("button", { name: "Import" }));
}

describe("ImportCards", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("sends the file's text, with the format taken from its name", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(result());
    const onImported = vi.fn();

    render(<ImportCards deckId="deck-1" onImported={onImported} />);
    await importFile(user, "deck.csv", CSV);

    const [path, options] = apiFetch.mock.calls[0] as [
      string,
      { method: string; body: { content: string; format: string } },
    ];

    expect(path).toBe("decks/deck-1/import");
    expect(options.method).toBe("POST");
    expect(options.body.content).toBe(CSV);
    expect(options.body.format).toBe("csv");
  });

  it("reads a .tsv as tab-separated", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(result());
    const onImported = vi.fn();

    render(<ImportCards deckId="deck-1" onImported={onImported} />);
    await importFile(user, "deck.tsv", "front\tback\nQ\tA\n");

    const [, options] = apiFetch.mock.calls[0] as [
      string,
      { body: { format: string } },
    ];
    expect(options.body.format).toBe("tsv");
  });

  it("hands the created cards back so the list can show them", async () => {
    const user = userEvent.setup();
    const created = [card("c1"), card("c2")];
    apiFetch.mockResolvedValue(result({ cards: created }));
    const onImported = vi.fn();

    render(<ImportCards deckId="deck-1" onImported={onImported} />);
    await importFile(user, "deck.csv", CSV);

    expect(onImported).toHaveBeenCalledWith(created);
  });

  it("names the rows it skipped instead of only counting them", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(
      result({
        created: 2,
        errors: ["Line 4: no answer", "Line 7: no question"],
        cards: [card("c1"), card("c2")],
      }),
    );

    render(<ImportCards deckId="deck-1" onImported={vi.fn()} />);
    await importFile(user, "deck.csv", CSV);

    expect(await screen.findByText(/added 2 cards/i)).toBeInTheDocument();
    expect(screen.getByText(/skipped 2 rows/i)).toBeInTheDocument();
    expect(screen.getByText("Line 4: no answer")).toBeInTheDocument();
    expect(screen.getByText("Line 7: no question")).toBeInTheDocument();
  });

  it("refuses an oversized file without sending it", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();

    render(<ImportCards deckId="deck-1" onImported={onImported} />);

    // Just over the 2 MB the component allows.
    const huge = new File(["x".repeat(2_000_001)], "huge.csv", {
      type: "text/csv",
    });
    await user.click(screen.getByRole("button", { name: "Import cards" }));
    await user.upload(screen.getByLabelText(/spreadsheet/i), huge);
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText(/the limit is 2 mb/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
  });
});
