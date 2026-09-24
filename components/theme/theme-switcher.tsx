"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { THEMES, type ThemeId } from "@/lib/theme/themes";
import {
  getServerSnapshot,
  getSnapshot,
  setTheme,
  subscribe,
} from "@/lib/theme/store";
import { cn } from "@/lib/utils/cn";

/**
 * Three schemes as a radio group.
 *
 * The highlighted option is driven by CSS (`[data-theme]` on `<html>`), not by
 * React state, so it is already correct in the first painted frame — before
 * hydration runs. React only listens, so that `aria-checked` stays honest for
 * assistive tech once JS is up.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Roving focus: arrows move between options and select as they go, which is
  // what a radio group is expected to do.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      const step =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;

      if (step === 0) return;
      event.preventDefault();

      const next = (index + step + THEMES.length) % THEMES.length;
      setTheme(THEMES[next].id);
      optionRefs.current[next]?.focus();
    },
    [],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Color scheme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5",
        className,
      )}
    >
      {THEMES.map((theme: (typeof THEMES)[number], index: number) => (
        <button
          key={theme.id}
          ref={(node) => {
            optionRefs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={active === theme.id}
          tabIndex={active === theme.id ? 0 : -1}
          data-scheme-option={theme.id}
          onClick={() => setTheme(theme.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
          title={theme.hint}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors"
        >
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-full border border-line-strong p-[2px]"
            style={{ backgroundColor: theme.swatch.bg }}
          >
            <span
              className="block size-full rounded-full"
              style={{ backgroundColor: theme.swatch.accent }}
            />
          </span>
          <span className="hidden sm:inline">{theme.label}</span>
        </button>
      ))}
    </div>
  );
}

export type { ThemeId };
