"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { APP_SECTIONS } from "@/lib/app-nav";
import { cn } from "@/lib/utils/cn";

/** How many results are worth showing at once. Past this the list stops being a
 *  shortcut and becomes a page you read. */
const MAX_RESULTS = 8;

const LIST_ID = "command-palette-results";

interface Command {
  id: string;
  label: string;
  detail?: string;
  href: string;
  group: string;
  keywords?: readonly string[];
}

/** The sections, compiled in — no request, and available before any load.
 *  Settings is here even though the rail leaves it out: the rail is the
 *  workflow, and this is a finder. Someone typing "password" wants it. */
const STATIC_COMMANDS: readonly Command[] = [
  ...APP_SECTIONS.map((section) => ({
    id: section.href,
    label: section.label,
    detail: section.description,
    href: section.href,
    group: "Go to",
    keywords: section.keywords,
  })),
  {
    id: "/settings",
    label: "Settings",
    detail: "Your account, password and sessions.",
    href: "/settings",
    group: "Go to",
    keywords: ["account", "password", "profile", "security"],
  },
];

function matches(command: Command, query: string): boolean {
  if (command.label.toLowerCase().includes(query)) return true;

  return (command.keywords ?? []).some((word) => word.includes(query));
}

/**
 * Find anything, from anywhere.
 *
 * Built on `<dialog>` + `showModal()` rather than the bell's popover, for the
 * reason `ui/dialog.tsx` gives: `showModal()` already provides focus trapping,
 * Esc and inertness of the page behind. That file's warning is the relevant one
 * here — reimplementing those is how dialogs end up dropping keyboard support —
 * and this is a surface whose entire purpose is the keyboard.
 *
 * Focus stays in the input for the whole time it is open. Arrow keys move a
 * highlight rather than the cursor, and `aria-activedescendant` tells a screen
 * reader which row that is; a palette where Tab walks the results is a palette
 * that fights its own arrow keys.
 *
 * Decks and sources load on first open, not on mount. Most pages never open it,
 * and a command index rendered into every layout would be a request on every
 * page for a feature nobody used yet. Both routes are already in the BFF's
 * allow-list.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fetched, setFetched] = useState<readonly Command[]>([]);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // Open and close the element as the state changes, the same way
  // `ConfirmDialog` does — Esc closes the element natively, so the element and
  // the state have to be kept in step from both directions.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        // So the browser's own search or the page's is not opened as well.
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || loaded) return;

    let cancelled = false;

    void (async () => {
      try {
        const [decks, sources] = await Promise.all([
          apiFetch<{ data: { id: string; title: string }[] }>("decks?limit=50"),
          apiFetch<{ data: { id: string; title: string }[] }>("sources?limit=50"),
        ]);

        if (cancelled) return;

        setFetched([
          ...decks.data.map((deck) => ({
            id: `deck:${deck.id}`,
            label: deck.title,
            href: `/decks/${deck.id}`,
            group: "Decks",
          })),
          ...sources.data.map((source) => ({
            id: `source:${source.id}`,
            label: source.title,
            href: `/sources/${source.id}`,
            group: "Sources",
          })),
        ]);
      } catch {
        // Nothing to say and nothing to fix. The sections are compiled in, so
        // failing here costs the reader decks and sources as shortcuts and
        // leaves the feature working.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = [...STATIC_COMMANDS, ...fetched];

    if (!needle) return all.slice(0, MAX_RESULTS);

    return all
      .filter((command) => matches(command, needle))
      .slice(0, MAX_RESULTS);
  }, [query, fetched]);

  function updateQuery(next: string) {
    setQuery(next);
    // The old highlight pointed into a list that no longer exists.
    setActive(0);
  }

  function choose(href: string) {
    setOpen(false);
    setQuery("");
    setActive(0);
    router.push(href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActive(results.length - 1);
      return;
    }

    if (event.key === "Enter") {
      const chosen = results[active];
      if (!chosen) return;
      event.preventDefault();
      choose(chosen.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Search"
        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <SearchIcon className="size-4" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Search"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/45"
      >
        <div className="flex flex-col">
          <input
            // Focus goes straight here: `showModal()` focuses the first
            // focusable element, and an input the reader has to click first
            // would defeat the point of a keyboard surface.
            autoFocus
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            role="combobox"
            aria-expanded
            aria-controls={LIST_ID}
            aria-autocomplete="list"
            aria-activedescendant={
              results[active] ? `${LIST_ID}-${active}` : undefined
            }
            aria-label="Search decks, sources and sections"
            placeholder="Search decks, sources and sections"
            className="h-12 w-full rounded-t-lg border-b border-line bg-transparent px-4 text-base outline-none placeholder:text-ink-subtle"
          />

          <p role="status" className="sr-only">
            {results.length} result{results.length === 1 ? "" : "s"}
          </p>

          <ul id={LIST_ID} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
            {results.map((command, index) => (
              <li
                key={command.id}
                id={`${LIST_ID}-${index}`}
                role="option"
                aria-selected={index === active}
                className={cn(
                  "rounded-md",
                  index === active && "bg-accent-soft",
                )}
              >
                {/* A real link, so the row can be middle-clicked and the href
                    is legible on hover; Enter is handled on the input, since
                    focus never leaves it. */}
                <Link
                  href={command.href}
                  onClick={() => choose(command.href)}
                  tabIndex={-1}
                  className="flex items-baseline justify-between gap-3 px-3 py-2"
                >
                  <span
                    className={cn(
                      "truncate",
                      index === active ? "text-accent" : "text-ink",
                    )}
                  >
                    {command.label}
                  </span>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {command.group}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-subtle">
              Nothing matches — try a deck name or a section.
            </p>
          ) : null}

          <p className="border-t border-line px-4 py-2 text-xs text-ink-subtle">
            <kbd className="rounded-sm border border-line bg-surface-2 px-1">
              ↑↓
            </kbd>{" "}
            to move ·{" "}
            <kbd className="rounded-sm border border-line bg-surface-2 px-1">
              ⏎
            </kbd>{" "}
            to open ·{" "}
            <kbd className="rounded-sm border border-line bg-surface-2 px-1">
              esc
            </kbd>{" "}
            to close
          </p>
        </div>
      </dialog>
    </>
  );
}

/** A magnifier, drawn here for the same reason the flame is: it is not a
 *  section, so it does not belong in `SectionIcon`'s paths. */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}
