import type { NoteDetail } from "@/lib/api-types";
import { formatCount } from "@/lib/format";
import Link from "next/link";

/**
 * What a note is, above the note.
 *
 * The reading time is only shown when it is known — it is computed when a note
 * is written, and a missing value means it has not been, not that the note is
 * instant. Rendering "0 min read" there would be a small lie of exactly the
 * kind `formatPercent` refuses to tell about an unrated card.
 *
 * **The dates do not use `formatDate` from `lib/format.ts`, on purpose.** That
 * helper formats in the reader's locale, which is right for a client component
 * and wrong here: these pages are prerendered on the server, so an unqualified
 * `toLocaleDateString` would bake *the server's* locale into HTML that every
 * reader then receives. A fixed locale is the only correct answer for a page
 * that is built once and served to everyone — the same reasoning, and the same
 * `en-GB`, as `components/analytics/quiz-performance.tsx`.
 */
export function ArticleHeader({ note }: { note: NoteDetail }) {
  const published = note.publishedAt ? formatDateOnly(note.publishedAt) : null;
  const updated = formatDateOnly(note.updatedAt);
  const showUpdated = published !== null && updated !== published;

  return (
    <header className="flex flex-col gap-4">
      <h1 className="text-3xl text-balance sm:text-4xl">{note.title}</h1>

      {note.excerpt ? (
        <p className="max-w-[var(--measure-prose)] text-lg text-ink-muted">
          {note.excerpt}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-subtle">
        <Link
          href={`/${note.nodePath}`}
          className="text-ink-muted transition-colors hover:text-accent hover:underline"
        >
          {note.nodeTitle}
        </Link>

        {published ? (
          <>
            <Dot />
            <time dateTime={note.publishedAt ?? undefined}>{published}</time>
          </>
        ) : null}

        {showUpdated ? (
          <>
            <Dot />
            <span>Updated {updated}</span>
          </>
        ) : null}

        {note.readingMinutes ? (
          <>
            <Dot />
            <span>{formatCount(note.readingMinutes, "minute")} read</span>
          </>
        ) : null}
      </div>
    </header>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-ink-subtle/50">
      ·
    </span>
  );
}

/** Day, month and year, from an ISO string, without the reader's locale. */
function formatDateOnly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
