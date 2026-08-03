"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FlashCard } from "@/lib/api-types";
import {
  DEFAULT_STUDY_MODE,
  STUDY_MODE_COOKIE,
  studyMode,
  type StudyModeId,
} from "@/lib/study/modes";
import { GridMode } from "./grid-mode";
import { ModeSwitcher } from "./mode-switcher";
import { SwipeMode } from "./swipe-mode";

/**
 * Owns everything a study session knows: which cards, in what order, and — for
 * modes that show one at a time — where you are.
 *
 * Modes are presenters. They receive cards and report nothing back except a
 * position, which is what keeps adding one cheap.
 *
 * **Nothing here is saved.** The API has no review endpoint and `FlashCard` has
 * no scheduling fields, so there is nowhere to record that a card was seen. The
 * session is honest about that rather than implying progress that would be lost
 * on reload.
 */
export function StudySession({
  deckId,
  deckTitle,
  cards: initialCards,
  initialMode = DEFAULT_STUDY_MODE,
}: {
  deckId: string;
  deckTitle: string;
  cards: FlashCard[];
  initialMode?: StudyModeId;
}) {
  const [mode, setMode] = useState<StudyModeId>(initialMode);
  const [cards, setCards] = useState(initialCards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const sequential = studyMode(mode).sequential;

  const chooseMode = useCallback((next: StudyModeId) => {
    setMode(next);
    // Remembered like the colour scheme: a preference, not session state.
    document.cookie = `${STUDY_MODE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
  }, []);

  const restart = useCallback(() => {
    setIndex(0);
    setFlipped(false);
  }, []);

  const shuffle = useCallback(() => {
    setCards((current) => {
      const next = [...current];
      // Fisher-Yates. Done here rather than during render: an order produced in
      // a render pass would change on every re-render.
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    restart();
  }, [restart]);

  /**
   * Arrow keys and space, bound at the window so they work without hunting for
   * a focus target — which is the difference between a keyboard-usable card and
   * one that merely has buttons on it.
   */
  useEffect(() => {
    if (!sequential) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Leave Space and Enter alone when something focusable has focus, or the
      // button's own activation and this handler would both fire.
      const onControl = target?.closest(
        "button, a, input, select, textarea, [contenteditable]",
      );

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((current) => Math.min(current + 1, cards.length - 1));
        setFlipped(false);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => Math.max(current - 1, 0));
        setFlipped(false);
      } else if ((event.key === " " || event.key === "Enter") && !onControl) {
        event.preventDefault();
        setFlipped((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sequential, cards.length]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl">Study</h1>
          <p className="mt-1 text-ink-muted">
            <Link
              href={`/decks/${deckId}`}
              className="text-accent hover:underline"
            >
              {deckTitle}
            </Link>{" "}
            · {cards.length} active card{cards.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ModeSwitcher value={mode} onChange={chooseMode} />
          <Button variant="secondary" size="sm" onClick={shuffle}>
            Shuffle
          </Button>
          {sequential ? (
            <Button variant="ghost" size="sm" onClick={restart}>
              Start over
            </Button>
          ) : null}
        </div>
      </div>

      {/* Branched explicitly rather than through an id → component map: the two
          take different props, and a converter would hide that. */}
      {mode === "swipe" ? (
        <SwipeMode
          cards={cards}
          index={index}
          onIndexChange={setIndex}
          flipped={flipped}
          onFlippedChange={setFlipped}
        />
      ) : (
        <GridMode cards={cards} />
      )}

      {/* Stated plainly rather than left to be discovered on reload. */}
      <p className="rounded-md border border-line bg-surface-2 px-3.5 py-3 text-sm text-ink-muted">
        This session is not saved. neurox can show you the cards but cannot yet
        remember which ones you have seen — that needs review scheduling, which
        the API does not have. Keep a deck small for now, or use the grid to see
        everything at once.
      </p>
    </div>
  );
}
