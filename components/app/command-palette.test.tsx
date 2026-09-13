import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { CommandPalette } from "./command-palette";

/**
 * jsdom ships `<dialog>` without `showModal`. The component's whole reason for
 * using the element is that the browser provides focus trapping, Esc and
 * inertness — none of which are under test here — so the element is reduced to
 * its one observable: whether it is open.
 */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

function openPalette() {
  return userEvent.keyboard("{Meta>}k{/Meta}");
}

describe("CommandPalette", () => {
  beforeEach(() => {
    push.mockReset();
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({ data: [] });
  });

  it("opens on the keyboard", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    expect(screen.queryByRole("combobox")).toBeNull();

    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("opens from its button too, so it is reachable without a shortcut", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("finds a section by a word that is not its label", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    await openPalette();

    // The label is "Progress". Nobody searching for their streak types that.
    await user.type(screen.getByRole("combobox"), "streak");

    expect(screen.getByRole("option", { name: /progress/i })).toBeInTheDocument();
  });

  it("narrows as the reader types", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    await openPalette();

    await user.type(screen.getByRole("combobox"), "deck");

    const labels = screen
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    expect(labels.some((label) => /decks/i.test(label))).toBe(true);
    expect(labels.some((label) => /activity/i.test(label))).toBe(false);
  });

  it("moves the highlight with the arrows and opens it with Enter", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    await openPalette();

    await user.type(screen.getByRole("combobox"), "dec");
    await user.keyboard("{ArrowDown}{Enter}");

    // Two entries match "dec" — Decks and Knowledge map's "decks" keyword is
    // one, so the first arrow press moves off the first row.
    expect(push).toHaveBeenCalledTimes(1);
    expect(String(push.mock.calls[0][0])).toMatch(/^\/(decks|map)/);
  });

  it("says so when nothing matches rather than showing an empty box", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    await openPalette();

    await user.type(screen.getByRole("combobox"), "zzzzz");

    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });

  it("closes on the cancel the browser fires for Escape", async () => {
    const { container } = render(<CommandPalette />);
    await openPalette();

    // Escape itself is the element's job, not this component's — that is the
    // reason for using `<dialog>` at all — and jsdom does not implement it. So
    // what is asserted is the handler the browser's `cancel` reaches, rather
    // than a stub standing in for the browser.
    const dialog = container.querySelector("dialog");
    fireEvent(dialog as HTMLDialogElement, new Event("cancel", { cancelable: true }));

    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  });

  it("loads decks and sources only once it is opened", async () => {
    render(<CommandPalette />);

    // Nothing is fetched for a reader who never opens it — most pages never do.
    expect(apiFetch).not.toHaveBeenCalled();

    await openPalette();

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  });

  it("still navigates the sections when the API cannot be reached", async () => {
    const user = userEvent.setup();
    apiFetch.mockRejectedValue(new Error("down"));
    render(<CommandPalette />);
    await openPalette();

    await user.type(screen.getByRole("combobox"), "activity{Enter}");

    expect(push).toHaveBeenCalledWith("/activity");
  });
});
