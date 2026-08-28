import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CursorPage } from "@/lib/api-types";

const apiFetch = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { useCursorList } from "./use-cursor-list";

/**
 * The cursor is opaque, and these tests exist because treating it as if it were
 * not is a live bug this codebase has already had: the review screen built its
 * own cursor from the last card's id, the API could not decode it, and the same
 * first page came back and was appended a second time.
 *
 * So the assertions are about what is *sent* as much as what is rendered.
 */

interface Row {
  id: string;
}

/** A page whose cursor is deliberately not derivable from the data — a real
 *  cursor is base64 over `(id, createdAt)`, not an id. */
function page(ids: string[], nextCursor: string | null): CursorPage<Row> {
  return {
    data: ids.map((id) => ({ id })),
    pagination: { nextCursor, hasMore: nextCursor !== null, limit: 2 },
  };
}

describe("useCursorList", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("starts from the server's page without fetching again", () => {
    const { result } = renderHook(() =>
      useCursorList<Row>(page(["a", "b"], "opaque-cursor"), "rows?limit=2"),
    );

    expect(result.current.items.map((row) => row.id)).toEqual(["a", "b"]);
    expect(result.current.hasMore).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("reports no more pages when the API sends no cursor", () => {
    const { result } = renderHook(() =>
      useCursorList<Row>(page(["a"], null), "rows?limit=2"),
    );

    // Not `pagination.hasMore`, which could disagree with the cursor.
    expect(result.current.hasMore).toBe(false);
  });

  it("sends the API's own cursor back, verbatim", async () => {
    const cursor = "eyJpZCI6ImIiLCJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxIn0=";
    apiFetch.mockResolvedValue(page(["c"], null));

    const { result } = renderHook(() =>
      useCursorList<Row>(page(["a", "b"], cursor), "rows?limit=2"),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    const [path] = apiFetch.mock.calls[0] as [string];
    expect(path).toBe(`rows?limit=2&cursor=${encodeURIComponent(cursor)}`);

    // The exact regression, written out: the last row's id is "b", and building
    // a cursor from it is what produced a second copy of the first page.
    expect(path).not.toBe(`rows?limit=2&cursor=${encodeURIComponent("b")}`);
  });

  it("appends the next page and advances the cursor", async () => {
    apiFetch.mockResolvedValue(page(["c", "d"], "second-cursor"));

    const { result } = renderHook(() =>
      useCursorList<Row>(page(["a", "b"], "first-cursor"), "rows?limit=2"),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items.map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(result.current.hasMore).toBe(true);

    apiFetch.mockResolvedValue(page(["e"], null));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(apiFetch.mock.calls[1]?.[0]).toBe(
      "rows?limit=2&cursor=second-cursor",
    );
    expect(result.current.hasMore).toBe(false);
  });

  it("keeps what it has when a page fails, and offers the button again", async () => {
    apiFetch.mockRejectedValue(new Error("upstream down"));

    const { result } = renderHook(() =>
      useCursorList<Row>(page(["a", "b"], "first-cursor"), "rows?limit=2"),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((row) => row.id)).toEqual(["a", "b"]);
    // Still true, so the reader can try again rather than being told there is
    // nothing more.
    expect(result.current.hasMore).toBe(true);
  });

  it("does nothing when there is no cursor to follow", async () => {
    const { result } = renderHook(() =>
      useCursorList<Row>(page(["a"], null), "rows?limit=2"),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });
});
