import type { ReactNode } from "react";
import type { SectionIconId } from "@/lib/app-nav";

// Re-exported so a caller rendering an icon does not need to reach into the nav
// module for the type as well.
export type { SectionIconId };

/**
 * The mark for each section.
 *
 * Hand-drawn paths rather than an icon package, for the same reason the charts
 * are hand-built: seven glyphs is not a dependency's worth of value, and every
 * one of them then inherits `currentColor` and the project's stroke weight
 * instead of needing to be themed.
 *
 * They are geometric rather than pictorial on purpose. At 20px a literal
 * drawing of a card stack or a document turns to mush, so each is a shape that
 * reads as a silhouette — the same reasoning the wordmark uses.
 *
 * `aria-hidden` throughout: every icon here sits beside its own label, so
 * announcing it would read the section name twice.
 */
const PATHS: Record<SectionIconId, ReactNode> = {
  decks: (
    <>
      <rect x="3" y="4.5" width="14" height="9.5" rx="2" />
      <path d="M6.5 17.5h7" />
    </>
  ),
  sources: (
    <>
      <path d="M5.5 2.75h5.25l4 4v10.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z" />
      <path d="M10.75 2.75v4h4" />
    </>
  ),
  generate: (
    <>
      <path d="M5.5 2.75h5.25l4 4v10.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z" />
      <path d="M10.5 10v5M8 12.5h5" />
    </>
  ),
  quizzes: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="4.5" />
      <path d="M8.3 8.1a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.25" />
      <path d="M10 13.7h.01" />
    </>
  ),
  progress: (
    <>
      <path d="M4 16.5V10M8 16.5V4.5M12 16.5v-4M16 16.5V7.5" />
    </>
  ),
  map: (
    <>
      <circle cx="5.25" cy="6" r="2.25" />
      <circle cx="14.75" cy="6" r="2.25" />
      <circle cx="10" cy="14.5" r="2.25" />
      <path d="M6.9 7.6 8.9 12.6M13.1 7.6 11.1 12.6M7.5 6h5" />
    </>
  ),
  activity: (
    <>
      <path d="M2.75 10h3.1l1.9-5.25L10.9 15l1.9-5h4.45" />
    </>
  ),
};

export function SectionIcon({
  name,
  className,
}: {
  name: SectionIconId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
