"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { CursorPage } from "@/lib/api-types";

/**
 * A cursor-paged list that keeps loading.
 *
 * The first page arrives from the server component, so the first paint is
 * complete and the list is not an empty box that fills in; this owns only what
 * happens after "Load more".
 *
 * The cursor is kept exactly as the API returned it. It is opaque — base64 over
 * the last row's `(id, createdAt)` — and rebuilding one from the last item's id
 * produces something the API cannot decode, which it treats as no cursor at all:
 * the first page comes back and gets appended a second time.
 *
 * `basePath` must be fixed for the life of the hook (it is a dependency). It is
 * a string rather than a builder so it cannot be a fresh function each render
 * and restart the effect-free state on every pass.
 */
export function useCursorList<T>(initial: CursorPage<T>, basePath: string) {
  const [items, setItems] = useState(initial.data);
  const [cursor, setCursor] = useState(initial.pagination.nextCursor);
  const [loading, setLoading] = useState(false);

  /** `hasMore` is derived rather than stored: the API returns a cursor exactly
   *  when another page exists, so holding both would be two sources of truth. */
  const hasMore = cursor !== null;

  const loadMore = useCallback(async () => {
    if (!cursor) return;

    setLoading(true);
    try {
      const separator = basePath.includes("?") ? "&" : "?";
      const page = await apiFetch<CursorPage<T>>(
        `${basePath}${separator}cursor=${encodeURIComponent(cursor)}`,
      );

      setItems((current) => [...current, ...page.data]);
      setCursor(page.pagination.nextCursor);
    } catch {
      // Leaving the button in place is the right recovery: the reader can try
      // again, and nothing has been lost.
    } finally {
      setLoading(false);
    }
  }, [basePath, cursor]);

  return { items, setItems, hasMore, loading, loadMore };
}
