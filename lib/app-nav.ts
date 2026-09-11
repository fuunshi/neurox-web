/**
 * The app's sections, in one place.
 *
 * Three surfaces read this: the sidebar rail, the mobile nav row, and the
 * container cards on the home page. They used to be three separate ideas — the
 * nav was a bare list of labels in the top bar, and nothing anywhere said what
 * any of the sections was *for*. A reader landing in the app for the first time
 * had to open each one to find out.
 *
 * So the description is part of the definition rather than something each
 * surface writes for itself. It is also why this is a plain module and not a
 * component: the home page renders these server-side, the sidebar renders them
 * client-side, and a shared module is the only thing both can import.
 *
 * Order is deliberate — it follows the actual workflow. You bring in material,
 * turn it into cards, study them, and check how it is going. Settings is absent
 * on purpose: it is account maintenance rather than part of the loop, and it
 * lives in the user menu where people look for it.
 */

export type SectionIconId =
  | "decks"
  | "sources"
  | "generate"
  | "quizzes"
  | "progress"
  | "map"
  | "activity";

export interface AppSection {
  href: string;
  /** Short enough for a sidebar rail. */
  label: string;
  /** One sentence saying what the section is for. Shown on the home cards. */
  description: string;
  icon: SectionIconId;
  /**
   * Other words a reader might reach for.
   *
   * The command palette matches on these as well as the label, because the
   * label is not always the word in someone's head: nobody searches "Progress"
   * for their streak, and nobody searches "Knowledge map" for a graph. Optional,
   * and additive — the rail and the home cards ignore it.
   */
  keywords?: readonly string[];
}

export const APP_SECTIONS: readonly AppSection[] = [
  {
    href: "/decks",
    label: "Decks",
    description:
      "Your collections of cards. This is where you study, and where a deck's schedule lives.",
    icon: "decks",
    keywords: ["cards", "study", "review", "library"],
  },
  {
    href: "/sources",
    label: "Sources",
    description:
      "The material you read from — a pasted chapter, an uploaded PDF or document.",
    icon: "sources",
    keywords: ["notes", "reading", "upload", "material", "pdf"],
  },
  {
    href: "/generate",
    label: "Generate",
    description:
      "Turn a source into draft cards. Nothing reaches a deck until you accept it.",
    icon: "generate",
    keywords: ["draft", "ai", "write", "create"],
  },
  {
    href: "/quizzes",
    label: "Quizzes",
    description:
      "Find out what you actually know. Quizzes never move your review schedule.",
    icon: "quizzes",
    keywords: ["test", "multiple choice", "matching", "practice"],
  },
  {
    href: "/stats",
    label: "Progress",
    description:
      "Your streak, when you study, how your quizzes go and what is coming up — all read from the review log.",
    icon: "progress",
    keywords: ["streak", "stats", "retention", "analytics", "forecast"],
  },
  {
    href: "/map",
    label: "Knowledge map",
    description:
      "How your sources, decks and cards connect to one another.",
    icon: "map",
    keywords: ["graph", "connections", "network"],
  },
  {
    href: "/activity",
    label: "Activity",
    description: "Everything that has happened, newest first.",
    icon: "activity",
    keywords: ["history", "log", "feed", "recent"],
  },
] as const;

/**
 * True when `pathname` is inside `href`.
 *
 * The `/` guard matters: without it `/decks-archive` would match `/decks`.
 */
export function isSectionActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The mobile nav is a scrolling row, so it carries a shorter label than the
 * sidebar — the descriptions would not fit and are not readable at a glance
 * anyway. Settings is included here and not in `APP_SECTIONS` because the
 * mobile nav has no user menu row of its own at the top.
 */
export const MOBILE_NAV = [
  ...APP_SECTIONS.map(({ href, label }) => ({ href, label })),
  { href: "/settings", label: "Settings" },
] as const;
