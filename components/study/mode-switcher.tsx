"use client";

import { useRef } from "react";
import { STUDY_MODES, type StudyModeId } from "@/lib/study/modes";

/**
 * Picks the presentation.
 *
 * A radio group rather than tabs, because these are alternative views of the
 * same thing, not sections of a document — and a radio group is what announces
 * "one of these is selected" correctly.
 *
 * Split away from the theme switcher on purpose: a theme is a stored preference
 * that CSS can act on before hydration, while a mode decides which component
 * renders. They look alike and behave differently, so they share no code.
 */
export function ModeSwitcher({
  value,
  onChange,
}: {
  value: StudyModeId;
  onChange: (mode: StudyModeId) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;

    if (step === 0) return;
    event.preventDefault();

    const next = (index + step + STUDY_MODES.length) % STUDY_MODES.length;
    onChange(STUDY_MODES[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="How to read these cards"
      className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
    >
      {STUDY_MODES.map((mode, index) => (
        <button
          key={mode.id}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === mode.id}
          tabIndex={value === mode.id ? 0 : -1}
          title={mode.hint}
          onClick={() => onChange(mode.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={
            value === mode.id
              ? "cursor-pointer rounded-md bg-accent-soft px-3 py-1.5 text-sm text-accent"
              : "cursor-pointer rounded-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
          }
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
