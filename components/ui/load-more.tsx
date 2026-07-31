"use client";

import { Button } from "./button";

/**
 * Cursor pagination control.
 *
 * A button rather than infinite scroll: the API returns `hasMore` and a cursor,
 * never a total, so a page cannot honestly claim "showing 20 of 431". It says
 * how many are shown and offers more.
 *
 * It also never appends on its own — an auto-appending list at the bottom of a
 * page fights the reader who is trying to reach the footer.
 */
export function LoadMore({
  shown,
  hasMore,
  loading,
  onLoadMore,
  noun,
}: {
  shown: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  /** Singular noun for the count, e.g. "card". */
  noun: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-ink-subtle" aria-live="polite">
        Showing {shown} {noun}
        {shown === 1 ? "" : "s"}
      </p>

      {hasMore ? (
        <Button variant="secondary" size="sm" loading={loading} onClick={onLoadMore}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
