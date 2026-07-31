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
