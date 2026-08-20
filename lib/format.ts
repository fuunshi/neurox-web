/**
 * Display formatting.
 *
 * Dates are rendered in the reader's locale, so anything using these must run on
 * the client or after hydration — a server-rendered `toLocaleDateString` uses
 * the *server's* locale and mismatches on hydration. Every call site here is
 * either a client component or a value that only appears after an interaction.
 */

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/** "3 days ago". Falls back to "just now" for anything under a minute. */
export function relativeTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";

  const delta = date.getTime() - Date.now();

  for (const [unit, ms] of UNITS) {
    if (Math.abs(delta) >= ms) {
      return RELATIVE.format(Math.round(delta / ms), unit);
    }
  }

  return "just now";
}

export function formatDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Binary units, which is what a file manager shows and therefore what a reader
 *  will compare against. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";

  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * A rate as a percentage, or an em dash when there is nothing to rate.
 *
 * The API sends `null` rather than `0` for "no questions asked yet", and this
 * is the only place that decides how that reads. Rendering it as `0%` would
 * turn "you have not tried this" into "you got everything wrong", which is the
 * kind of thing someone acts on.
 */
export function formatPercent(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";

  return `${Math.round(rate * 100)}%`;
}

/** File extensions the API accepts. Kept beside the copy that states them. */
export const ACCEPTED_EXTENSIONS = [
  ".txt",
  ".text",
  ".md",
  ".markdown",
  ".pdf",
  ".docx",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PASTED_CHARS = 500_000;

/**
 * How long until a card comes back, as a reader would say it.
 *
 * Deliberately coarse above a month: "in 3 months" is useful, "in 94 days" is
 * false precision about a date the scheduler will move anyway.
 */
export function formatInterval(days: number): string {
  if (days <= 0) return "later today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `in ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return `in ${months} ${months === 1 ? "month" : "months"}`;
  }
  const years = Math.round(days / 365);
  return `in ${years} ${years === 1 ? "year" : "years"}`;
}

/** The order the grades appear in, and what each means. Kept beside the
 *  formatter so the buttons and any copy about them cannot drift apart. */
export const REVIEW_GRADES = [
  { rating: "AGAIN", label: "Again", key: "1", hint: "Blanked or wrong" },
  { rating: "HARD", label: "Hard", key: "2", hint: "Recalled, with effort" },
  { rating: "GOOD", label: "Good", key: "3", hint: "Recalled" },
  { rating: "EASY", label: "Easy", key: "4", hint: "Immediate" },
] as const;

/** What the API recorded for a source, as words a reader recognises. */
export function sourceStatusLabel(status: string): string {
  switch (status) {
    case "READY":
      return "Ready";
    case "FAILED":
      return "Could not be read";
    case "EXTRACTING":
      return "Reading";
    default:
      return "Waiting";
  }
}

/** "markdown" rather than "MARKDOWN" — the API's enum is not English. */
export function sourceTypeLabel(type: string): string {
  return type.toLowerCase();
}
